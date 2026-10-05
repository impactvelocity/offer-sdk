// In-memory implementation of the hosted Offer API (api/src). Same paths, status codes,
// response shapes and auth rules, so the dashboard behaves identically against either.
//
// Extra routes are served here that the hosted API does not have yet (marked "proposed"):
// GET /apps/:appId/analytics/timeseries, /analytics/events, and CRUD for saved
// analytics reports under /analytics/reports.
//
// Dashboard agent chat threads (/apps/:appId/agent/threads) mirror api/src/routes/agent-threads.ts.
//
// Webhooks (endpoints, deliveries, the event log) mirror api/src/routes/webhooks.ts.

import {
  db,
  deleteApp,
  deleteDoc,
  getCount,
  getDoc,
  increment,
  insertDoc,
  listDocs,
  mergeDoc,
  updateDoc,
  type DocTable,
  type Json,
  type MockWebhookEndpoint,
} from "./db";
import { prefixedId } from "./ids";
import {
  attempt,
  createSecret,
  deliveryJson,
  emit,
  emitUsageThresholds,
  endpointJson,
  eventPayload,
  MAX_ENDPOINTS_PER_APP,
  parseEvents,
  sendTest,
  urlError,
} from "./webhooks";
import {
  ALL_EVENTS,
  diffPrevious,
  isWebhookEventType,
  sampleEventData,
  WEBHOOK_EVENTS,
  type WebhookEventType,
} from "@/lib/webhooks/catalog";

// Without a configured key the admin key is random per process, so the public mock
// endpoint never accepts a guessable admin credential.
export const MOCK_ADMIN_KEY = process.env.OFFER_API_ADMIN_KEY || prefixedId("admin", 40);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: () => Json;
  /** The body when there is one, else {}. */
  optionalBody: () => Json;
  method: string;
  path: string;
}

type Handler = (ctx: Ctx) => Response | Promise<Response>;

const json = (body: unknown, status = 200) => Response.json(body, { status });

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const omit = (obj: Json, keys: string[]) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

function pagination(query: URLSearchParams) {
  const page = Math.max(parseInt(query.get("page") ?? "1", 10) || 1, 1);
  const perPage = Math.min(parseInt(query.get("per_page") ?? "20", 10) || 20, 100);
  return { page, perPage };
}

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return "([^/]+)";
    })}/?$`,
  );
  routes.push({ method, pattern, keys, handler });
}

/** plan.updated / incentive.updated with the old values of changed fields, when anything changed. */
function emitUpdated(type: "plan.updated" | "incentive.updated", appId: string, before: Json, after: Json) {
  const previous = diffPrevious(before, after);
  if (Object.keys(previous).length) emit(appId, type, { object: after, previous });
}

/** account.updated plus the specific plan/incentive events a change implies. */
function emitAccountChanges(appId: string, before: Json, after: Json) {
  const previous = diffPrevious(before, after);
  if (!Object.keys(previous).length) return;
  emit(appId, "account.updated", { object: after, previous });
  if (before.plan !== after.plan) emit(appId, "account.plan_changed", { object: after, previous: { plan: before.plan } });
  if ((before.incentive ?? null) !== (after.incentive ?? null)) {
    emit(appId, after.incentive ? "account.incentive_applied" : "account.incentive_removed", {
      object: after,
      previous: { incentive: before.incentive ?? null },
    });
  }
}

// ---------------------------------------------------------------------------
// Apps

route("GET", "/apps/:appId", ({ params }) => {
  const app = db.apps.get(params.appId);
  return app ? json(app) : json({ error: "App not found" }, 404);
});

route("POST", "/apps", ({ body }) => {
  const { name, plan } = body();
  const app = {
    id: prefixedId("app", 6),
    name,
    plan,
    api_key: prefixedId("key", 32),
    public_key: prefixedId("pub", 32),
    created_at: new Date().toISOString(),
  };
  db.apps.set(app.id, app);
  return json(app, 201);
});

route("PATCH", "/apps/:appId", ({ params, body }) => {
  const app = db.apps.get(params.appId);
  if (!app) return json({ error: "App not found" }, 404);
  const next = { ...app, ...omit(body(), ["id", "api_key", "public_key", "created_at"]) };
  db.apps.set(params.appId, next);
  return json(next);
});

route("DELETE", "/apps/:appId", ({ params }) =>
  deleteApp(params.appId) ? json({ deleted: true }) : json({ error: "App not found" }, 404),
);

route("POST", "/apps/:appId/keys/regenerate", ({ params }) => {
  const app = db.apps.get(params.appId);
  if (!app) return json({ error: "App not found" }, 404);
  app.api_key = prefixedId("key", 32);
  return json({ api_key: app.api_key });
});

route("POST", "/apps/:appId/public-key/regenerate", ({ params }) => {
  const app = db.apps.get(params.appId);
  if (!app) return json({ error: "App not found" }, 404);
  app.public_key = prefixedId("pub", 32);
  return json({ public_key: app.public_key });
});

// ---------------------------------------------------------------------------
// Orgs (admin only)

route("GET", "/orgs", () => json([...db.orgs.values()]));

route("GET", "/orgs/:orgId", ({ params }) => {
  const org = db.orgs.get(params.orgId);
  return org ? json(org) : json({ error: "Org not found" }, 404);
});

route("POST", "/orgs", ({ body }) => {
  const { id, app_ids = [] } = body();
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);
  if (db.orgs.has(id)) return json({ error: `Org with id "${id}" already exists` }, 409);
  const org = { id, app_ids, created_at: new Date().toISOString() };
  db.orgs.set(id, org);
  return json(org, 201);
});

route("PATCH", "/orgs/:orgId", ({ params, body }) => {
  const org = db.orgs.get(params.orgId);
  if (!org) return json({ error: "Org not found" }, 404);
  const next = { ...org, ...omit(body(), ["id", "created_at"]) };
  db.orgs.set(params.orgId, next);
  return json(next);
});

route("GET", "/orgs/:orgId/apps", ({ params }) => {
  const org = db.orgs.get(params.orgId);
  if (!org) return json({ error: "Org not found" }, 404);
  return json(org.app_ids.map((id) => db.apps.get(id)).filter(Boolean));
});

route("DELETE", "/orgs/:orgId", ({ params }) =>
  db.orgs.delete(params.orgId) ? json({ deleted: true }) : json({ error: "Org not found" }, 404),
);

// ---------------------------------------------------------------------------
// Entitlements & addons

const badType = { error: 'type must be "usage" or "boolean"' };

route("GET", "/apps/:appId/entitlements", ({ params }) => json(listDocs("entitlements", params.appId)));

route("GET", "/apps/:appId/entitlements/:id", ({ params }) => {
  const doc = getDoc("entitlements", params.appId, params.id);
  return doc ? json(doc) : json({ error: "Entitlement not found" }, 404);
});

route("POST", "/apps/:appId/entitlements", ({ params, body }) => {
  const { id: rawId, type, name, description } = body();
  if (typeof rawId !== "string") return json({ error: "id is required" }, 400);
  if (type !== "usage" && type !== "boolean") return json(badType, 400);
  const id = slugify(rawId);
  const doc = { id, app_id: params.appId, type, name, description, created_at: new Date().toISOString() };
  if (!insertDoc("entitlements", params.appId, id, doc)) {
    return json({ error: `Entitlement with id "${id}" already exists` }, 409);
  }
  return json(doc, 201);
});

route("PATCH", "/apps/:appId/entitlements/:id", ({ params, body }) => {
  const payload = omit(body(), ["id", "app_id"]);
  if (payload.type && payload.type !== "usage" && payload.type !== "boolean") return json(badType, 400);
  const doc = mergeDoc("entitlements", params.appId, params.id, payload);
  return doc ? json(doc) : json({ error: "Entitlement not found" }, 404);
});

route("DELETE", "/apps/:appId/entitlements/:id", ({ params }) =>
  deleteDoc("entitlements", params.appId, params.id)
    ? json({ deleted: true })
    : json({ error: "Entitlement not found" }, 404),
);

route("GET", "/apps/:appId/addons", ({ params }) => json(listDocs("addons", params.appId)));

route("GET", "/apps/:appId/addons/:id", ({ params }) => {
  const doc = getDoc("addons", params.appId, params.id);
  return doc ? json(doc) : json({ error: "Addon not found" }, 404);
});

route("POST", "/apps/:appId/addons", ({ params, body }) => {
  const { id: rawId, name, description } = body();
  if (typeof rawId !== "string") return json({ error: "id is required" }, 400);
  const id = slugify(rawId);
  const doc = { id, app_id: params.appId, name, description, created_at: new Date().toISOString() };
  if (!insertDoc("addons", params.appId, id, doc)) return json({ error: `Addon with id "${id}" already exists` }, 409);
  return json(doc, 201);
});

route("PATCH", "/apps/:appId/addons/:id", ({ params, body }) => {
  const doc = mergeDoc("addons", params.appId, params.id, omit(body(), ["id", "app_id"]));
  return doc ? json(doc) : json({ error: "Addon not found" }, 404);
});

route("DELETE", "/apps/:appId/addons/:id", ({ params }) =>
  deleteDoc("addons", params.appId, params.id) ? json({ deleted: true }) : json({ error: "Addon not found" }, 404),
);

// ---------------------------------------------------------------------------
// Plans & incentives

const pricingCard = (plan: Json) => ({ plan_id: plan.id, isFree: plan.isFree ?? false, ...(plan.pricingCard ?? {}) });

route("GET", "/apps/:appId/plans", ({ params }) => json(listDocs("plans", params.appId)));

route("GET", "/apps/:appId/plans/pricing", ({ params }) =>
  json(
    listDocs("plans", params.appId)
      .filter((p) => p.pricingCard)
      .map(pricingCard),
  ),
);

route("GET", "/apps/:appId/plans/:planId", ({ params }) => {
  const doc = getDoc("plans", params.appId, params.planId);
  return doc ? json(doc) : json({ error: "Plan not found" }, 404);
});

route("POST", "/apps/:appId/plans", ({ params, body }) => {
  const { id: rawId, name, description, note, pricingCard: card, isFree } = body();
  if (typeof rawId !== "string") return json({ error: "id is required" }, 400);
  const id = slugify(rawId);
  const plan = {
    id,
    app_id: params.appId,
    name,
    description,
    note: note ?? null,
    isFree: isFree ?? false,
    pricingCard: card ?? null,
    addons: [],
    entitlements: [],
    meta: {},
    created_at: new Date().toISOString(),
  };
  if (!insertDoc("plans", params.appId, id, plan)) return json({ error: `Plan with id "${id}" already exists` }, 409);
  emit(params.appId, "plan.created", { object: plan });
  return json(plan, 201);
});

route("GET", "/apps/:appId/plans/:planId/pricing", ({ params }) => {
  const doc = getDoc("plans", params.appId, params.planId);
  if (!doc) return json({ error: "Plan not found" }, 404);
  if (!doc.pricingCard) return json({ error: "No pricing card set" }, 404);
  return json(pricingCard(doc));
});

route("GET", "/apps/:appId/plans/:planId/namespaces", ({ params, query }) => {
  const { page, perPage } = pagination(query);
  const result = searchNamespaces({ appId: params.appId, plan: params.planId, page, perPage });
  return json({
    data: result.hits.map((d) => ({ id: d.namespace_id, name: d.name })),
    total: result.found,
    page,
    per_page: perPage,
  });
});

route("PATCH", "/apps/:appId/plans/:planId", ({ params, body }) => {
  const before = getDoc("plans", params.appId, params.planId);
  const doc = mergeDoc("plans", params.appId, params.planId, omit(body(), ["id", "app_id"]));
  if (!before || !doc) return json({ error: "Plan not found" }, 404);
  emitUpdated("plan.updated", params.appId, before, doc);
  return json(doc);
});

route("PATCH", "/apps/:appId/plans/:planId/meta", ({ params, body }) => {
  const payload = body();
  const before = getDoc("plans", params.appId, params.planId);
  const doc = updateDoc("plans", params.appId, params.planId, (plan) => ({
    ...plan,
    meta: { ...(plan.meta ?? {}), ...payload },
  }));
  if (!before || !doc) return json({ error: "Plan not found" }, 404);
  emitUpdated("plan.updated", params.appId, before, doc);
  return json(doc);
});

route("DELETE", "/apps/:appId/plans/:planId", ({ params }) => {
  const before = getDoc("plans", params.appId, params.planId);
  if (!before || !deleteDoc("plans", params.appId, params.planId)) return json({ error: "Plan not found" }, 404);
  emit(params.appId, "plan.deleted", { object: before });
  return json({ deleted: true });
});

route("GET", "/apps/:appId/incentives", ({ params }) => json(listDocs("incentives", params.appId)));

route("GET", "/apps/:appId/incentives/:incentiveId", ({ params }) => {
  const doc = getDoc("incentives", params.appId, params.incentiveId);
  return doc ? json(doc) : json({ error: "Incentive not found" }, 404);
});

route("POST", "/apps/:appId/incentives", ({ params, body }) => {
  const { id: rawId, name, description, entitlements = [], addons = [] } = body();
  if (typeof rawId !== "string") return json({ error: "id is required" }, 400);
  const id = slugify(rawId);
  const doc = {
    id,
    app_id: params.appId,
    name,
    description,
    entitlements,
    addons,
    created_at: new Date().toISOString(),
  };
  if (!insertDoc("incentives", params.appId, id, doc)) {
    return json({ error: `Incentive with id "${id}" already exists` }, 409);
  }
  emit(params.appId, "incentive.created", { object: doc });
  return json(doc, 201);
});

route("PATCH", "/apps/:appId/incentives/:incentiveId", ({ params, body }) => {
  const before = getDoc("incentives", params.appId, params.incentiveId);
  const doc = mergeDoc("incentives", params.appId, params.incentiveId, omit(body(), ["id", "app_id"]));
  if (!before || !doc) return json({ error: "Incentive not found" }, 404);
  emitUpdated("incentive.updated", params.appId, before, doc);
  return json(doc);
});

route("DELETE", "/apps/:appId/incentives/:incentiveId", ({ params }) => {
  const before = getDoc("incentives", params.appId, params.incentiveId);
  if (!before || !deleteDoc("incentives", params.appId, params.incentiveId)) {
    return json({ error: "Incentive not found" }, 404);
  }
  emit(params.appId, "incentive.deleted", { object: before });
  return json({ deleted: true });
});

// Entitlement/addon attachments, shared by plans and incentives.
for (const [table, param, label] of [
  ["plans", "planId", "Plan"],
  ["incentives", "incentiveId", "Incentive"],
] as const) {
  const base = `/apps/:appId/${table}/:${param}`;
  const notFound = { error: `${label} not found` };
  const on = `this ${label.toLowerCase()}`;
  const event = table === "plans" ? "plan.updated" : "incentive.updated";

  /** updateDoc that also emits plan.updated / incentive.updated. */
  const update = (appId: string, ownerId: string, fn: (doc: Json) => Json) => {
    const before = getDoc(table, appId, ownerId);
    const updated = updateDoc(table, appId, ownerId, fn);
    if (before && updated) emitUpdated(event, appId, before, updated);
    return updated;
  };

  route("POST", `${base}/entitlements`, ({ params, body }) => {
    const ownerId = params[param];
    if (!getDoc(table, params.appId, ownerId)) return json(notFound, 404);
    const { id, max } = body() ?? {};
    const entitlement = getDoc("entitlements", params.appId, id);
    if (!entitlement) return json({ error: `Entitlement "${id}" not found` }, 404);
    const entry = entitlement.type === "usage" ? { id, max: max ?? null } : { id };
    const updated = update(params.appId, ownerId, (doc) => {
      const list: Json[] = doc.entitlements ?? [];
      if (list.some((e) => e.id === id)) throw new ApiError(409, `Entitlement "${id}" is already on ${on}`);
      return { ...doc, entitlements: [...list, entry] };
    });
    return updated ? json(updated) : json(notFound, 404);
  });

  route("PATCH", `${base}/entitlements/:entitlementId`, ({ params, body }) => {
    const ownerId = params[param];
    const doc = getDoc(table, params.appId, ownerId);
    if (!doc) return json(notFound, 404);
    if (!(doc.entitlements ?? []).some((e: Json) => e.id === params.entitlementId)) {
      return json({ error: `Entitlement "${params.entitlementId}" not on ${on}` }, 404);
    }
    const { max } = body() ?? {};
    const updated = update(params.appId, ownerId, (d) => ({
      ...d,
      entitlements: (d.entitlements ?? []).map((e: Json) => (e.id === params.entitlementId ? { ...e, max } : e)),
    }));
    return updated ? json(updated) : json(notFound, 404);
  });

  route("DELETE", `${base}/entitlements/:entitlementId`, ({ params }) => {
    const updated = update(params.appId, params[param], (d) => ({
      ...d,
      entitlements: (d.entitlements ?? []).filter((e: Json) => e.id !== params.entitlementId),
    }));
    return updated ? json(updated) : json(notFound, 404);
  });

  route("POST", `${base}/addons`, ({ params, body }) => {
    const ownerId = params[param];
    if (!getDoc(table, params.appId, ownerId)) return json(notFound, 404);
    const { id } = body() ?? {};
    if (!getDoc("addons", params.appId, id)) return json({ error: `Addon "${id}" not found` }, 404);
    const updated = update(params.appId, ownerId, (doc) => {
      const list: string[] = doc.addons ?? [];
      if (list.includes(id)) throw new ApiError(409, `Addon "${id}" is already on ${on}`);
      return { ...doc, addons: [...list, id] };
    });
    return updated ? json(updated) : json(notFound, 404);
  });

  route("DELETE", `${base}/addons/:addonId`, ({ params }) => {
    const updated = update(params.appId, params[param], (d) => ({
      ...d,
      addons: (d.addons ?? []).filter((id: string) => id !== params.addonId),
    }));
    return updated ? json(updated) : json(notFound, 404);
  });
}

// ---------------------------------------------------------------------------
// Namespaces (accounts)

function searchNamespaces(params: {
  appId: string;
  q?: string | null;
  plan?: string | null;
  incentive?: string | null;
  hasIncentive?: boolean;
  page?: number;
  perPage?: number;
}) {
  const page = params.page ?? 1;
  const perPage = Math.min(params.perPage ?? 20, 100);
  const q = params.q?.trim().toLowerCase();
  const pattern = q && q !== "*" ? q : null;

  const matches = listDocs("namespaces", params.appId)
    .filter(
      (ns) =>
        (!params.plan || ns.plan === params.plan) &&
        (!params.incentive || ns.incentive === params.incentive) &&
        (!params.hasIncentive || ns.incentive) &&
        (!pattern || String(ns.name ?? "").toLowerCase().includes(pattern) || ns.id.toLowerCase().includes(pattern)),
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || a.id.localeCompare(b.id));

  const hits = matches.slice((page - 1) * perPage, page * perPage).map((ns) => ({
    id: ns.id,
    namespace_id: ns.id,
    name: ns.name,
    plan: ns.plan,
    has_incentive: !!ns.incentive,
    ...(ns.incentive ? { incentive: ns.incentive } : {}),
    created_at: Math.floor(new Date(ns.created_at).getTime() / 1000),
  }));
  return { hits, found: matches.length };
}

route("GET", "/apps/:appId/namespaces", ({ params, query }) => {
  const { page, perPage } = pagination(query);
  const result = searchNamespaces({
    appId: params.appId,
    q: query.get("q"),
    plan: query.get("plan"),
    incentive: query.get("incentive"),
    hasIncentive: query.get("has_incentive") === "true" ? true : undefined,
    page,
    perPage,
  });
  return json({ data: result.hits, total: result.found, page, per_page: perPage });
});

route("GET", "/apps/:appId/namespaces/count", ({ params }) =>
  json({ count: listDocs("namespaces", params.appId).length }),
);

route("GET", "/apps/:appId/namespaces/with-incentive", ({ params, query }) => {
  const { page, perPage } = pagination(query);
  const result = searchNamespaces({
    appId: params.appId,
    hasIncentive: true,
    incentive: query.get("incentive"),
    page,
    perPage,
  });
  return json({ data: result.hits, total: result.found, page, per_page: perPage });
});

route("GET", "/apps/:appId/namespaces/:namespaceId", ({ params }) => {
  const doc = getDoc("namespaces", params.appId, params.namespaceId);
  return doc ? json(doc) : json({ error: "Namespace not found" }, 404);
});

route("POST", "/apps/:appId/namespaces", ({ params, body }) => {
  const { id, name, plan: planId, incentive: incentiveId } = body();
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);
  if (!db.apps.has(params.appId)) return json({ error: "App not found" }, 404);
  if (!getDoc("plans", params.appId, planId)) return json({ error: `Plan "${planId}" not found` }, 404);
  const incentive = incentiveId ? getDoc("incentives", params.appId, incentiveId) : null;
  const namespace = {
    id,
    app_id: params.appId,
    name,
    plan: planId,
    // An unknown incentive is silently dropped, as in the hosted API.
    incentive: incentive ? incentiveId : null,
    created_at: new Date().toISOString(),
  };
  if (!insertDoc("namespaces", params.appId, id, namespace)) {
    return json({ error: `Namespace with id "${id}" already exists` }, 409);
  }
  emit(params.appId, "account.created", { object: namespace });
  return json(namespace, 201);
});

route("PATCH", "/apps/:appId/namespaces/:namespaceId", ({ params, body }) => {
  const before = getDoc("namespaces", params.appId, params.namespaceId);
  if (!before) return json({ error: "Namespace not found" }, 404);
  const payload = omit(body(), ["id", "app_id"]);
  if (payload.plan && !getDoc("plans", params.appId, payload.plan)) {
    return json({ error: `Plan "${payload.plan}" not found` }, 404);
  }
  if (payload.incentive && !getDoc("incentives", params.appId, payload.incentive)) {
    return json({ error: `Incentive "${payload.incentive}" not found` }, 404);
  }
  const doc = mergeDoc("namespaces", params.appId, params.namespaceId, payload);
  if (!doc) return json({ error: "Namespace not found" }, 404);
  emitAccountChanges(params.appId, before, doc);
  return json(doc);
});

route("DELETE", "/apps/:appId/namespaces/:namespaceId/incentive", ({ params }) => {
  const before = getDoc("namespaces", params.appId, params.namespaceId);
  const doc = mergeDoc("namespaces", params.appId, params.namespaceId, { incentive: null });
  if (!before || !doc) return json({ error: "Namespace not found" }, 404);
  emitAccountChanges(params.appId, before, doc);
  return json(doc);
});

function buildNamespacePlan(appId: string, namespaceId: string) {
  const namespace = getDoc("namespaces", appId, namespaceId);
  if (!namespace) return null;
  const plan = getDoc("plans", appId, namespace.plan);
  const incentive = namespace.incentive ? getDoc("incentives", appId, namespace.incentive) : null;
  if (!plan) return "plan_not_found" as const;

  // The incentive overrides the plan's max for matching ids and adds new ones.
  const merged = new Map<string, Json>();
  for (const e of plan.entitlements ?? []) merged.set(e.id, e);
  for (const e of incentive?.entitlements ?? []) merged.set(e.id, e);

  const addons = [...new Set([...(plan.addons ?? []), ...(incentive?.addons ?? [])])];

  const entitlements = [...merged.values()].map((e) => {
    const detail = getDoc("entitlements", appId, e.id);
    const usage = getCount(appId, namespaceId, e.id);
    const max = e.max ?? null;
    return {
      id: e.id,
      feature: e.id,
      name: detail?.name ?? e.id,
      type: detail?.type ?? "usage",
      usage,
      max,
      left: max !== null ? Math.max(0, max - usage) : null,
      can: max !== null ? usage < max : true,
    };
  });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      isFree: plan.isFree ?? false,
      meta: (plan.meta ?? {}) as Json,
      privateMetaKeys: (plan.privateMetaKeys ?? []) as string[],
    },
    incentive: namespace.incentive ?? null,
    addons,
    entitlements,
  };
}

route("GET", "/apps/:appId/namespaces/:namespaceId/plan", ({ params }) => {
  const result = buildNamespacePlan(params.appId, params.namespaceId);
  if (result === null) return json({ error: "Namespace not found" }, 404);
  if (result === "plan_not_found") return json({ error: "Plan not found" }, 404);
  const privateKeys = new Set(result.plan.privateMetaKeys);
  const meta = Object.fromEntries(Object.entries(result.plan.meta).filter(([k]) => !privateKeys.has(k)));
  return json({ ...result, plan: { ...omit(result.plan, ["privateMetaKeys"]), meta } });
});

route("GET", "/apps/:appId/namespaces/:namespaceId/full-plan", ({ params }) => {
  const result = buildNamespacePlan(params.appId, params.namespaceId);
  if (result === null) return json({ error: "Namespace not found" }, 404);
  if (result === "plan_not_found") return json({ error: "Plan not found" }, 404);
  return json(result);
});

route("DELETE", "/apps/:appId/namespaces/:namespaceId", ({ params }) => {
  const before = getDoc("namespaces", params.appId, params.namespaceId);
  if (!before || !deleteDoc("namespaces", params.appId, params.namespaceId)) {
    return json({ error: "Namespace not found" }, 404);
  }
  emit(params.appId, "account.deleted", { object: before });
  return json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Usage

function usageContext(params: Record<string, string>) {
  const namespace = getDoc("namespaces", params.appId, params.namespaceId);
  const entitlement = getDoc("entitlements", params.appId, params.entitlementId);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  if (!entitlement) throw new ApiError(404, "Entitlement not found");
  if (entitlement.type !== "usage") throw new ApiError(400, "Entitlement is not a usage type");
  return { appId: params.appId, namespaceId: params.namespaceId, entitlementId: params.entitlementId };
}

const usageBase = "/apps/:appId/namespaces/:namespaceId/usage";

route("GET", usageBase, ({ params }) => {
  const namespace = getDoc("namespaces", params.appId, params.namespaceId);
  if (!namespace) return json({ error: "Namespace not found" }, 404);
  const plan = getDoc("plans", params.appId, namespace.plan);
  const ids: string[] = (plan?.entitlements ?? []).map((e: Json) => e.id);
  return json(Object.fromEntries(ids.map((id) => [id, getCount(params.appId, params.namespaceId, id)])));
});

route("GET", `${usageBase}/:entitlementId`, ({ params }) => {
  const { appId, namespaceId, entitlementId } = usageContext(params);
  return json({ entitlement: entitlementId, count: getCount(appId, namespaceId, entitlementId) });
});

/** Bumps the counter, then fires usage limit webhooks if a threshold was crossed. */
function trackUsage(params: Record<string, string>, operation: "add" | "remove" | "amount", amount: number) {
  const { appId, namespaceId, entitlementId } = usageContext(params);
  const count = increment(appId, namespaceId, entitlementId, operation, amount);
  emitUsageThresholds(appId, namespaceId, entitlementId, amount);
  return json({ entitlement: entitlementId, count });
}

route("POST", `${usageBase}/:entitlementId/add`, ({ params }) => trackUsage(params, "add", 1));

route("POST", `${usageBase}/:entitlementId/remove`, ({ params }) => trackUsage(params, "remove", -1));

route("POST", `${usageBase}/:entitlementId/amount`, ({ params, body }) => {
  usageContext(params);
  const { amount } = body() ?? {};
  if (typeof amount !== "number" || !Number.isInteger(amount)) return json({ error: "amount must be an integer" }, 400);
  return trackUsage(params, "amount", amount);
});

// ---------------------------------------------------------------------------
// Analytics

const INTERVAL_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "60d": 60, "6m": 180, year: 365, alltime: 0 };

function intervalSince(interval: string) {
  if (!(interval in INTERVAL_DAYS)) {
    throw new ApiError(400, `interval must be one of: ${Object.keys(INTERVAL_DAYS).join(", ")}`);
  }
  const days = INTERVAL_DAYS[interval];
  return days ? Date.now() - days * 86_400_000 : null;
}

function eventsFor(appId: string, since: number | null, filters: { namespace?: string | null; entitlement?: string | null }) {
  return db.events.filter(
    (e) =>
      e.app_id === appId &&
      (!filters.namespace || e.namespace_id === filters.namespace) &&
      (!filters.entitlement || e.entitlement_id === filters.entitlement) &&
      (since === null || new Date(e.created_at).getTime() >= since),
  );
}

function summarize<K extends string>(events: typeof db.events, key: (e: (typeof db.events)[number]) => string, name: K) {
  const groups = new Map<string, { calls: number; total_amount: number }>();
  for (const e of events) {
    const g = groups.get(key(e)) ?? { calls: 0, total_amount: 0 };
    g.calls += 1;
    g.total_amount += e.amount;
    groups.set(key(e), g);
  }
  return [...groups.entries()]
    .map(([id, g]) => ({ [name]: id, ...g }) as Record<K, string> & { calls: number; total_amount: number })
    .sort((a, b) => b.calls - a.calls || String(a[name]).localeCompare(String(b[name])));
}

route("GET", "/apps/:appId/analytics", ({ params, query }) => {
  const interval = query.get("interval");
  if (!interval) return json({ error: "interval is required" }, 400);
  const events = eventsFor(params.appId, intervalSince(interval), { namespace: query.get("namespace") });
  return json(summarize(events, (e) => e.entitlement_id, "entitlement_id"));
});

route("GET", "/apps/:appId/analytics/top-namespaces", ({ params, query }) => {
  const since = intervalSince(query.get("interval") ?? "7d");
  const limit = parseInt(query.get("limit") ?? "10", 10);
  if (isNaN(limit) || limit < 1 || limit > 100) return json({ error: "limit must be between 1 and 100" }, 400);
  const events = eventsFor(params.appId, since, { entitlement: query.get("entitlement") });
  return json(summarize(events, (e) => e.namespace_id, "namespace_id").slice(0, limit));
});

// Daily (<= 60d) or weekly buckets of usage per entitlement.
route("GET", "/apps/:appId/analytics/timeseries", ({ params, query }) => {
  const interval = query.get("interval") ?? "30d";
  const since = intervalSince(interval);
  const weekly = !["7d", "30d", "60d"].includes(interval);
  const events = eventsFor(params.appId, since, {
    namespace: query.get("namespace"),
    entitlement: query.get("entitlement"),
  });
  const bucket = (iso: string) => {
    const d = new Date(iso);
    d.setUTCHours(0, 0, 0, 0);
    if (weekly) d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const rows = summarize(events, (e) => `${bucket(e.created_at)}|${e.entitlement_id}`, "key").map(({ key, ...rest }) => {
    const [date, entitlement_id] = key.split("|");
    return { date, entitlement_id, ...rest };
  });
  return json(rows.sort((a, b) => a.date.localeCompare(b.date) || a.entitlement_id.localeCompare(b.entitlement_id)));
});

// Most recent usage events, optionally for one namespace.
route("GET", "/apps/:appId/analytics/events", ({ params, query }) => {
  const limit = Math.min(Math.max(parseInt(query.get("limit") ?? "50", 10) || 50, 1), 200);
  const events = eventsFor(params.appId, null, {
    namespace: query.get("namespace"),
    entitlement: query.get("entitlement"),
  });
  return json(
    events
      .slice(-limit)
      .reverse()
      .map((e) => omit(e, ["app_id"])),
  );
});

// Saved analytics reports. A report is just a view of the analytics page
// (which entitlements, which period); the numbers are always computed live.

const MAX_REPORTS_PER_APP = 50;
const reportNotFound = { error: "Report not found" };

/** Validates report fields; `partial` allows any subset (PATCH). Returns the clean fields or an error. */
function reportFields(input: Json, partial: boolean): Json | { error: string } {
  const out: Json = {};
  if (!partial || "name" in input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 80) return { error: "name is required (1–80 characters)" };
    out.name = name;
  }
  if (!partial || "entitlements" in input) {
    const ids = input.entitlements ?? [];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
      return { error: "entitlements must be an array of entitlement ids" };
    }
    if (ids.length > 20) return { error: "A report can include at most 20 entitlements" };
    out.entitlements = [...new Set(ids as string[])];
  }
  if (!partial || "interval" in input) {
    const interval = input.interval ?? "30d";
    if (!(interval in INTERVAL_DAYS)) {
      return { error: `interval must be one of: ${Object.keys(INTERVAL_DAYS).join(", ")}` };
    }
    out.interval = interval;
  }
  return out;
}

route("GET", "/apps/:appId/analytics/reports", ({ params }) => json(listDocs("reports", params.appId)));

route("POST", "/apps/:appId/analytics/reports", ({ params, body }) => {
  const fields = reportFields(body() ?? {}, false);
  if ("error" in fields) return json(fields, 400);
  if (listDocs("reports", params.appId).length >= MAX_REPORTS_PER_APP) {
    return json({ error: `An app can have at most ${MAX_REPORTS_PER_APP} saved reports` }, 400);
  }
  const now = new Date().toISOString();
  const doc = { id: prefixedId("rpt", 16), app_id: params.appId, ...fields, created_at: now, updated_at: now };
  insertDoc("reports", params.appId, doc.id, doc);
  return json(doc, 201);
});

route("GET", "/apps/:appId/analytics/reports/:id", ({ params }) => {
  const doc = getDoc("reports", params.appId, params.id);
  return doc ? json(doc) : json(reportNotFound, 404);
});

route("PATCH", "/apps/:appId/analytics/reports/:id", ({ params, body }) => {
  const fields = reportFields(body() ?? {}, true);
  if ("error" in fields) return json(fields, 400);
  const doc = mergeDoc("reports", params.appId, params.id, { ...fields, updated_at: new Date().toISOString() });
  return doc ? json(doc) : json(reportNotFound, 404);
});

route("DELETE", "/apps/:appId/analytics/reports/:id", ({ params }) =>
  deleteDoc("reports", params.appId, params.id) ? json({ deleted: true }) : json(reportNotFound, 404),
);

// ---------------------------------------------------------------------------
// History import (admin only): backdates accounts and records past usage events.
// Mirrors api/src/routes/history-import.ts.

route("POST", "/apps/:appId/import", ({ params, body }) => {
  const input = body() ?? {};
  const namespaces: Json[] = Array.isArray(input.namespaces) ? input.namespaces : [];
  const events: Json[] = Array.isArray(input.usage_events) ? input.usage_events : [];
  if (namespaces.length > 10_000 || events.length > 10_000) return json({ error: "At most 10000 items per request" }, 400);

  const validDate = (v: unknown) => typeof v === "string" && !isNaN(Date.parse(v)) && Date.parse(v) <= Date.now() + 60_000;
  for (const [i, e] of events.entries()) {
    if (!getDoc("namespaces", params.appId, e.namespace_id)) return json({ error: `Unknown accounts: ${e.namespace_id}` }, 404);
    if (getDoc("entitlements", params.appId, e.entitlement_id)?.type !== "usage") {
      return json({ error: `Unknown or non-usage entitlements: ${e.entitlement_id}` }, 400);
    }
    if (!["add", "remove", "amount"].includes(e.operation) || !Number.isInteger(e.amount) || !validDate(e.created_at)) {
      return json({ error: `usage_events[${i}] is invalid` }, 400);
    }
  }
  if (namespaces.some((n) => typeof n.id !== "string" || !validDate(n.created_at))) {
    return json({ error: "namespaces need an id and a past created_at" }, 400);
  }

  let backdated = 0;
  for (const n of namespaces) {
    if (mergeDoc("namespaces", params.appId, n.id, { created_at: new Date(n.created_at).toISOString() })) backdated++;
  }
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => Date.parse(a.e.created_at) - Date.parse(b.e.created_at) || a.i - b.i);
  for (const { e } of ordered) increment(params.appId, e.namespace_id, e.entitlement_id, e.operation, e.amount, new Date(e.created_at));
  db.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return json({ imported: { namespaces: backdated, usage_events: events.length } });
});

// ---------------------------------------------------------------------------
// Webhooks

const webhookNotFound = { error: "Webhook endpoint not found" };

function findEndpoint(appId: string, id: string) {
  const endpoint = db.webhooks.get(id);
  return endpoint?.app_id === appId ? endpoint : null;
}

function clampLimit(query: URLSearchParams, fallback: number) {
  return Math.min(Math.max(parseInt(query.get("limit") ?? String(fallback), 10) || fallback, 1), 100);
}

route("GET", "/event-types", () =>
  json(WEBHOOK_EVENTS.map((e) => ({ ...e, sample: sampleEventData(e.type, "app_123") }))),
);

route("GET", "/apps/:appId/webhooks", ({ params }) =>
  json(
    [...db.webhooks.values()]
      .filter((e) => e.app_id === params.appId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(endpointJson),
  ),
);

route("POST", "/apps/:appId/webhooks", ({ params, body }) => {
  const { url, events, description, source = "custom", enabled = true } = body();
  if (!db.apps.has(params.appId)) return json({ error: "App not found" }, 404);
  const badUrl = urlError(url);
  if (badUrl) return json({ error: badUrl }, 400);
  const parsed = parseEvents(events);
  if (typeof parsed === "string") return json({ error: parsed }, 400);
  if (source !== "custom" && source !== "zapier") return json({ error: 'source must be "custom" or "zapier"' }, 400);
  if ([...db.webhooks.values()].filter((e) => e.app_id === params.appId).length >= MAX_ENDPOINTS_PER_APP) {
    return json({ error: `An app can have at most ${MAX_ENDPOINTS_PER_APP} webhook endpoints` }, 400);
  }
  const now = new Date().toISOString();
  const endpoint: MockWebhookEndpoint = {
    id: prefixedId("whk", 16),
    app_id: params.appId,
    url,
    description: typeof description === "string" && description.trim() ? description.trim() : null,
    events: parsed,
    enabled: enabled !== false,
    source,
    secret: createSecret(),
    disabled_reason: null,
    created_at: now,
    updated_at: now,
  };
  db.webhooks.set(endpoint.id, endpoint);
  return json(endpointJson(endpoint), 201);
});

route("GET", "/apps/:appId/webhooks/:webhookId", ({ params }) => {
  const endpoint = findEndpoint(params.appId, params.webhookId);
  return endpoint ? json(endpointJson(endpoint)) : json(webhookNotFound, 404);
});

route("PATCH", "/apps/:appId/webhooks/:webhookId", ({ params, body }) => {
  const endpoint = findEndpoint(params.appId, params.webhookId);
  if (!endpoint) return json(webhookNotFound, 404);
  const payload = body();
  const next = { ...endpoint };
  if ("url" in payload) {
    const badUrl = urlError(payload.url);
    if (badUrl) return json({ error: badUrl }, 400);
    next.url = payload.url;
  }
  if ("events" in payload) {
    const parsed = parseEvents(payload.events);
    if (typeof parsed === "string") return json({ error: parsed }, 400);
    next.events = parsed;
  }
  if ("description" in payload) {
    next.description = typeof payload.description === "string" && payload.description.trim() ? payload.description.trim() : null;
  }
  if (typeof payload.enabled === "boolean") {
    next.enabled = payload.enabled;
    if (payload.enabled) next.disabled_reason = null;
  }
  next.updated_at = new Date().toISOString();
  db.webhooks.set(endpoint.id, next);
  return json(endpointJson(next));
});

route("DELETE", "/apps/:appId/webhooks/:webhookId", ({ params }) => {
  if (!findEndpoint(params.appId, params.webhookId)) return json(webhookNotFound, 404);
  db.webhooks.delete(params.webhookId);
  db.webhookDeliveries = db.webhookDeliveries.filter((d) => d.endpoint_id !== params.webhookId);
  return json({ deleted: true });
});

route("POST", "/apps/:appId/webhooks/:webhookId/secret/regenerate", ({ params }) => {
  const endpoint = findEndpoint(params.appId, params.webhookId);
  if (!endpoint) return json(webhookNotFound, 404);
  endpoint.secret = createSecret();
  endpoint.updated_at = new Date().toISOString();
  return json({ secret: endpoint.secret });
});

route("POST", "/apps/:appId/webhooks/:webhookId/test", async ({ params, optionalBody }) => {
  const endpoint = findEndpoint(params.appId, params.webhookId);
  if (!endpoint) return json(webhookNotFound, 404);
  const fallback = endpoint.events[0] === ALL_EVENTS ? "account.created" : endpoint.events[0];
  const type = optionalBody().type ?? fallback;
  if (!isWebhookEventType(type)) return json({ error: `Unknown event type "${String(type)}"` }, 400);
  const delivery = await sendTest(endpoint, type, sampleEventData(type as WebhookEventType, params.appId));
  return json(delivery ? deliveryJson(delivery) : null);
});

route("GET", "/apps/:appId/webhooks/:webhookId/deliveries", ({ params, query }) => {
  if (!findEndpoint(params.appId, params.webhookId)) return json(webhookNotFound, 404);
  const status = query.get("status");
  return json(
    db.webhookDeliveries
      .filter((d) => d.endpoint_id === params.webhookId && (!status || d.status === status))
      .slice(-clampLimit(query, 50))
      .reverse()
      .map(deliveryJson),
  );
});

route("POST", "/apps/:appId/webhooks/:webhookId/deliveries/:deliveryId/retry", async ({ params }) => {
  if (!findEndpoint(params.appId, params.webhookId)) return json(webhookNotFound, 404);
  const delivery = db.webhookDeliveries.find((d) => d.id === params.deliveryId && d.endpoint_id === params.webhookId);
  if (!delivery) return json({ error: "Delivery not found" }, 404);
  const updated = await attempt(delivery.id, { final: true });
  return json(updated ? deliveryJson(updated) : null);
});

route("GET", "/apps/:appId/events", ({ params, query }) => {
  const type = query.get("type");
  if (type && !isWebhookEventType(type)) return json({ error: `Unknown event type "${type}"` }, 400);
  return json(
    db.webhookEvents
      .filter((e) => e.app_id === params.appId && !e.test && (!type || e.type === type))
      .slice(-clampLimit(query, 20))
      .reverse()
      .map(eventPayload),
  );
});

// ---------------------------------------------------------------------------
// Agent chat threads (mirrors api/src/routes/agent-threads.ts). Admin key only.

const threadNotFound = { error: "Thread not found" };
const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_THREAD_TITLE = 120;

const threadSummary = ({ messages, ...rest }: Json) => ({ ...rest, message_count: (messages as unknown[]).length });

route("GET", "/apps/:appId/agent/threads", ({ params, query }) => {
  const userId = query.get("user_id");
  if (!userId) return json({ error: "user_id is required" }, 400);
  return json(
    listDocs("agent_threads", params.appId)
      .filter((t) => t.user_id === userId)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, clampLimit(query, 50))
      .map(threadSummary),
  );
});

route("GET", "/apps/:appId/agent/threads/:threadId", ({ params }) => {
  const doc = getDoc("agent_threads", params.appId, params.threadId);
  return doc ? json(doc) : json(threadNotFound, 404);
});

route("PUT", "/apps/:appId/agent/threads/:threadId", ({ params, body }) => {
  if (!THREAD_ID.test(params.threadId)) return json({ error: "Invalid thread id" }, 400);
  const input = body();
  if (typeof input.user_id !== "string" || !input.user_id) return json({ error: "user_id is required" }, 400);
  if (!Array.isArray(input.messages)) return json({ error: "messages must be an array" }, 400);
  if ("title" in input && typeof input.title !== "string") return json({ error: "title must be a string" }, 400);
  const title = typeof input.title === "string" ? input.title.trim().slice(0, MAX_THREAD_TITLE) : null;

  // Strictly increasing, so the newest save always sorts first even within one millisecond.
  const last = listDocs("agent_threads", params.appId).reduce((max, t) => (t.updated_at > max ? t.updated_at : max), "");
  const now = new Date(Math.max(Date.now(), last ? Date.parse(last) + 1 : 0)).toISOString();
  const existing = getDoc("agent_threads", params.appId, params.threadId);
  if (existing && existing.user_id !== input.user_id) return json({ error: "Thread belongs to another user" }, 409);
  const doc = existing
    ? { ...existing, messages: input.messages, title: title ?? existing.title, updated_at: now }
    : {
        app_id: params.appId,
        id: params.threadId,
        user_id: input.user_id,
        title: title ?? "",
        messages: input.messages,
        created_at: now,
        updated_at: now,
      };
  if (existing) updateDoc("agent_threads", params.appId, params.threadId, () => doc);
  else insertDoc("agent_threads", params.appId, params.threadId, doc);
  return json(threadSummary(doc));
});

route("PATCH", "/apps/:appId/agent/threads/:threadId", ({ params, body }) => {
  const { title } = body();
  if (typeof title !== "string") return json({ error: "title is required" }, 400);
  const doc = mergeDoc("agent_threads", params.appId, params.threadId, { title: title.trim().slice(0, MAX_THREAD_TITLE) });
  return doc ? json(threadSummary(doc)) : json(threadNotFound, 404);
});

route("DELETE", "/apps/:appId/agent/threads/:threadId", ({ params }) =>
  deleteDoc("agent_threads", params.appId, params.threadId) ? json({ deleted: true }) : json(threadNotFound, 404),
);

// ---------------------------------------------------------------------------
// Auth (mirrors api/src/lib/auth.ts) and dispatch

function publicKeyAllowed(method: string, path: string) {
  const isGet = method === "GET";
  return (
    (isGet && (path.endsWith("/plan") || path.endsWith("/full-plan"))) ||
    path.includes("/usage") ||
    (isGet && path.includes("/pricing"))
  );
}

function authorize(method: string, path: string, key: string | null): boolean {
  if (key === MOCK_ADMIN_KEY) return true;
  if (/^\/apps\/[^/]+\/agent\//.test(path)) return false;
  if (/^\/apps\/[^/]+\/import\/?$/.test(path)) return false; // admin only
  if (method === "POST" && path.replace(/\/$/, "") === "/apps") return true;
  if (path.startsWith("/orgs")) return false;
  const appId = path.match(/^\/apps\/([^/]+)/)?.[1];
  if (!appId || !key) return false;
  const app = db.apps.get(appId);
  if (!app) return false;
  if (app.api_key === key) return true;
  return app.public_key === key && publicKeyAllowed(method, path);
}

export interface MockRequest {
  method: string;
  path: string;
  query?: URLSearchParams;
  body?: unknown;
  /** Bearer key; the BFF passes the admin key. */
  apiKey: string | null;
}

export async function handleMockRequest({ method, path, query, body, apiKey }: MockRequest): Promise<Response> {
  if (path === "/" || path === "") return new Response("Offer API (mock).");
  if (path === "/health") return json({ ok: true, mock: true });

  const isAppRoute = /^\/apps\/[^/]+/.test(path) || path.startsWith("/orgs");
  if (isAppRoute && !authorize(method, path, apiKey)) return json({ error: "Unauthorized" }, 401);

  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(path);
    if (!match) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    const ctx: Ctx = {
      params,
      query: query ?? new URLSearchParams(),
      method,
      path,
      body: () => {
        if (body === undefined || body === null) throw new ApiError(400, "Invalid JSON body");
        if (typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Body must be a JSON object");
        return body as Json;
      },
      optionalBody: () => (body === undefined || body === null ? {} : ctx.body()),
    };
    try {
      return await r.handler(ctx);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      console.error("[offer-api mock]", err);
      return json({ error: "Internal server error" }, 500);
    }
  }
  return json({ error: "Not found" }, 404);
}

export type { DocTable };
