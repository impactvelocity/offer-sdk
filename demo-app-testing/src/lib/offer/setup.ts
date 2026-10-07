import "server-only";
import { appApi, clientFor, isStatus, OfferApiError, type AppApi } from "./client";
import { ADDONS, ENTITLEMENTS, INCENTIVES, OFFERS, PLANS, WEBHOOK_EVENTS } from "./catalog";
import { BLOG_URL, OFFER_ADMIN_KEY, WEBHOOK_URL, offerConfig, writeSettings, type OfferConfig } from "./config";

// `rails generate offer:install`: creates the app and its catalog through the
// API, printing a line per step in the style of Rails generators.

export type Verb = "create" | "exist" | "attach" | "update" | "skip" | "error" | "connect" | "publish";
export interface GeneratorLine {
  verb: Verb;
  what: string;
  detail?: string;
}

async function step(out: GeneratorLine[], what: string, fn: () => Promise<unknown>, verb: Verb = "create") {
  try {
    await fn();
    out.push({ verb, what });
  } catch (err) {
    if (isStatus(err, 409)) out.push({ verb: "exist", what });
    else out.push({ verb: "error", what, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function createApp(out: GeneratorLine[], name: string): Promise<OfferConfig> {
  // POST /apps needs no key: the app doesn't exist yet.
  const app = await clientFor().request<{ id: string; api_key: string; public_key: string }>("/apps", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  await writeSettings({ app_id: app.id, secret_key: app.api_key, public_key: app.public_key, webhook_id: null, webhook_secret: null });
  out.push({ verb: "create", what: `app ${app.id}`, detail: name });
  return { appId: app.id, secretKey: app.api_key, publicKey: app.public_key };
}

async function catalog(out: GeneratorLine[], api: AppApi) {
  // The app's own checkout page: 402 "limit reached" responses link here.
  await step(out, `app checkout_url → ${BLOG_URL}/pricing`, () => api.patch("", { checkout_url: `${BLOG_URL}/pricing` }), "update");

  for (const e of ENTITLEMENTS) {
    await step(out, `entitlement ${e.id} (${e.type})`, () => api.post("/entitlements", e));
  }
  await step(
    out,
    "entitlement posts overage → block, upgrade via launch_50",
    () => api.patch("/entitlements/posts", { overage: { mode: "block", offer_id: "launch_50" } }),
    "update",
  );

  for (const a of ADDONS) await step(out, `addon ${a.id}`, () => api.post("/addons", a));

  for (const { entitlements, addons, ...plan } of PLANS) {
    await step(out, `plan ${plan.id}`, () => api.post("/plans", plan));
    for (const e of entitlements) {
      const max = "max" in e ? (e.max === null ? "unlimited" : e.max) : "on";
      await step(out, `${plan.id} ← ${e.id} (${max})`, () => api.post(`/plans/${plan.id}/entitlements`, e), "attach");
    }
    for (const id of addons) await step(out, `${plan.id} ← addon ${id}`, () => api.post(`/plans/${plan.id}/addons`, { id }), "attach");
  }
  // Public vs private meta: /plan strips privateMetaKeys, /full-plan keeps them.
  await step(
    out,
    "pro meta { badge, internal_price_id (private) }",
    async () => {
      await api.patch("/plans/pro/meta", { badge: "PRO", internal_price_id: "price_pro_internal" });
      await api.patch("/plans/pro", { privateMetaKeys: ["internal_price_id"] });
    },
    "update",
  );

  for (const i of INCENTIVES) await step(out, `incentive ${i.id}`, () => api.post("/incentives", i));
  for (const o of OFFERS) await step(out, `offer ${o.id} (draft)`, () => api.post("/offers", o));
}

async function paypal(out: GeneratorLine[], api: AppApi) {
  const { PAYPAL_CLIENT_ID: client_id, PAYPAL_CLIENT_SECRET: client_secret } = process.env;
  if (!client_id || !client_secret) {
    out.push({ verb: "skip", what: "paypal", detail: "set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to connect a sandbox app" });
    return;
  }
  await step(out, "paypal sandbox", () => api.put("/paypal", { client_id, client_secret, env: "sandbox" }), "connect");
  for (const o of OFFERS) await step(out, `offer ${o.id}`, () => api.post(`/offers/${o.id}/publish`), "publish");
}

async function webhook(out: GeneratorLine[], api: AppApi, config: OfferConfig) {
  if (config.webhookId) {
    try {
      await api.get(`/webhooks/${config.webhookId}`);
      out.push({ verb: "exist", what: `webhook ${config.webhookId}` });
      return;
    } catch (err) {
      if (!isStatus(err, 404)) throw err;
    }
  }
  try {
    const endpoint = await api.post<{ id: string; secret: string }>("/webhooks", {
      url: WEBHOOK_URL,
      events: WEBHOOK_EVENTS,
      description: "Rails blog receiver",
    });
    await writeSettings({ webhook_id: endpoint.id, webhook_secret: endpoint.secret });
    out.push({ verb: "create", what: `webhook ${endpoint.id}`, detail: WEBHOOK_URL });
  } catch (err) {
    out.push({ verb: "error", what: "webhook", detail: err instanceof Error ? err.message : String(err) });
  }
}

export async function runSetup(name: string): Promise<GeneratorLine[]> {
  const out: GeneratorLine[] = [];
  let config = await offerConfig();
  if (config) out.push({ verb: "exist", what: `app ${config.appId}` });
  else config = await createApp(out, name);

  const api = appApi(config);
  await catalog(out, api);
  await paypal(out, api);
  await webhook(out, api, config);
  return out;
}

// ─── Dashboard workspaces (admin key) ──────────────────

export interface Org {
  id: string;
  app_ids: string[];
}

export async function listOrgs(): Promise<Org[] | string> {
  if (!OFFER_ADMIN_KEY) return "OFFER_ADMIN_KEY isn't set";
  try {
    return await clientFor(OFFER_ADMIN_KEY).request<Org[]>("/orgs");
  } catch (err) {
    return err instanceof OfferApiError ? `${err.status} ${err.message}` : String(err);
  }
}

/** Shows the blog's app in a dashboard workspace by adding it to that org's app_ids. */
export async function attachToOrg(orgId: string, appId: string) {
  const admin = clientFor(OFFER_ADMIN_KEY);
  const org = await admin.request<Org>(`/orgs/${encodeURIComponent(orgId)}`);
  if (org.app_ids.includes(appId)) return;
  await admin.request(`/orgs/${encodeURIComponent(orgId)}`, {
    method: "PATCH",
    body: JSON.stringify({ app_ids: [...org.app_ids, appId] }),
  });
}
