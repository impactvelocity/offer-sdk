import { Hono } from "hono";
import sql from "../db/client.ts";
import { changeDoc, deleteDoc, getDoc, insertDoc } from "../db/docs.ts";
import { searchNamespaces } from "../db/search.ts";
import { omit, pagination, readJson, readObject } from "../lib/http.ts";
import { buildNamespacePlan } from "../lib/namespace-plan.ts";
import { emit, emitAccountChanges } from "../lib/webhooks.ts";

const namespaces = new Hono();

const notFound = { error: "Namespace not found" };

// GET /apps/:appId/namespaces?q=*&page=1&per_page=20&plan=pro&has_incentive=true&incentive=summer-promo&offer=5050
namespaces.get("/", async (c) => {
  const { page, perPage } = pagination(c);
  const result = await searchNamespaces({
    appId: c.req.param("appId")!,
    q: c.req.query("q"),
    plan: c.req.query("plan"),
    incentive: c.req.query("incentive"),
    offer: c.req.query("offer"),
    hasIncentive: c.req.query("has_incentive") === "true" ? true : undefined,
    page,
    perPage,
  });
  return c.json({ data: result.hits, total: result.found, page, per_page: perPage });
});

// GET /apps/:appId/namespaces/count
namespaces.get("/count", async (c) => {
  const [{ count }] = await sql`
    select count(*)::int as count from namespaces where app_id = ${c.req.param("appId")!}`;
  return c.json({ count });
});

// GET /apps/:appId/namespaces/with-incentive?incentive=summer-promo&page=1&per_page=20
namespaces.get("/with-incentive", async (c) => {
  const { page, perPage } = pagination(c);
  const result = await searchNamespaces({
    appId: c.req.param("appId")!,
    hasIncentive: true,
    incentive: c.req.query("incentive"),
    page,
    perPage,
  });
  return c.json({ data: result.hits, total: result.found, page, per_page: perPage });
});

// GET /apps/:appId/namespaces/:namespaceId
namespaces.get("/:namespaceId", async (c) => {
  const doc = await getDoc("namespaces", c.req.param("appId")!, c.req.param("namespaceId"));
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// POST /apps/:appId/namespaces
namespaces.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { id, name, plan: planId, incentive: incentiveId } = (await readJson(c)) ?? {};
  if (typeof id !== "string" || !id) return c.json({ error: "id is required" }, 400);

  const [[app], plan, incentive] = await Promise.all([
    sql`select 1 from apps where id = ${appId}`,
    getDoc("plans", appId, planId),
    incentiveId ? getDoc("incentives", appId, incentiveId) : null,
  ]);
  if (!app) return c.json({ error: "App not found" }, 404);
  if (!plan) return c.json({ error: `Plan "${planId}" not found` }, 404);

  const namespace = {
    id,
    app_id: appId,
    name,
    plan: planId,
    // An unknown incentive is silently dropped, as in the legacy API.
    incentive: incentive ? incentiveId : null,
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("namespaces", appId, id, namespace))) {
    return c.json({ error: `Namespace with id "${id}" already exists` }, 409);
  }

  await emit(appId, "account.created", { object: namespace });
  return c.json(namespace, 201);
});

// PATCH /apps/:appId/namespaces/:namespaceId
namespaces.patch("/:namespaceId", async (c) => {
  const appId = c.req.param("appId")!;
  const namespaceId = c.req.param("namespaceId");

  if (!(await getDoc("namespaces", appId, namespaceId))) return c.json(notFound, 404);

  const payload = omit(await readObject(c), ["id", "app_id"]);

  if (payload.plan && !(await getDoc("plans", appId, payload.plan))) {
    return c.json({ error: `Plan "${payload.plan}" not found` }, 404);
  }
  if (payload.incentive && !(await getDoc("incentives", appId, payload.incentive))) {
    return c.json({ error: `Incentive "${payload.incentive}" not found` }, 404);
  }

  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => ({ ...doc, ...payload }));
  if (!change) return c.json(notFound, 404);
  await emitAccountChanges(appId, change.before, change.after);
  return c.json(change.after);
});

// DELETE /apps/:appId/namespaces/:namespaceId/incentive
namespaces.delete("/:namespaceId/incentive", async (c) => {
  const appId = c.req.param("appId")!;
  const change = await changeDoc("namespaces", appId, c.req.param("namespaceId"), (doc) => ({
    ...doc,
    incentive: null,
  }));
  if (!change) return c.json(notFound, 404);
  await emitAccountChanges(appId, change.before, change.after);
  return c.json(change.after);
});

// GET /apps/:appId/namespaces/:namespaceId/plan
// Meta keys listed in the plan's privateMetaKeys are stripped from the response.
namespaces.get("/:namespaceId/plan", async (c) => {
  const result = await buildNamespacePlan(c.req.param("appId")!, c.req.param("namespaceId"));
  if (result === null) return c.json(notFound, 404);
  if (result === "plan_not_found") return c.json({ error: "Plan not found" }, 404);

  const privateKeys = new Set(result.plan.privateMetaKeys);
  const meta = Object.fromEntries(Object.entries(result.plan.meta).filter(([k]) => !privateKeys.has(k)));
  const { privateMetaKeys: _, ...plan } = result.plan;

  return c.json({ ...result, plan: { ...plan, meta } });
});

// GET /apps/:appId/namespaces/:namespaceId/full-plan
// Same as /plan but includes private meta fields.
namespaces.get("/:namespaceId/full-plan", async (c) => {
  const result = await buildNamespacePlan(c.req.param("appId")!, c.req.param("namespaceId"));
  if (result === null) return c.json(notFound, 404);
  if (result === "plan_not_found") return c.json({ error: "Plan not found" }, 404);
  return c.json(result);
});

// DELETE /apps/:appId/namespaces/:namespaceId
// Also removes the namespace's usage counters (usage events are kept for analytics).
namespaces.delete("/:namespaceId", async (c) => {
  const appId = c.req.param("appId")!;
  const deleted = await deleteDoc("namespaces", appId, c.req.param("namespaceId"));
  if (!deleted) return c.json(notFound, 404);
  await emit(appId, "account.deleted", { object: deleted });
  return c.json({ deleted: true });
});

export default namespaces;
