// End-to-end tests against a real Postgres. Needs DATABASE_URL pointing at a
// throwaway database: every table is truncated before the run.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

process.env.ADMIN_API_KEY = "test-admin-key";
// Webhook tests deliver to a receiver on 127.0.0.1.
process.env.WEBHOOKS_ALLOW_PRIVATE_URLS = "true";

const { default: app } = await import("../src/app.ts");
const { default: sql } = await import("../src/db/client.ts");
const { migrate } = await import("../src/db/migrate.ts");
const { attemptDelivery, claimDueDeliveries, isPrivateHost } = await import("../src/lib/webhooks.ts");
const { startWebhookWorker } = await import("../src/lib/webhook-worker.ts");

const ADMIN = "test-admin-key";

async function call(method: string, path: string, opts: { key?: string | null; body?: unknown } = {}) {
  const key = opts.key === undefined ? ADMIN : opts.key;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

let appId: string;
let apiKey: string;
let publicKey: string;

// Local webhook receiver: the path picks the response status.
type Received = { path: string; headers: Headers; body: string };
const received: Received[] = [];
const receiver = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const path = new URL(req.url).pathname;
    received.push({ path, headers: req.headers, body: await req.text() });
    const status = ({ "/ok": 200, "/fail": 500, "/gone": 410 } as Record<string, number>)[path] ?? 404;
    return new Response(path === "/fail" ? "boom" : "ok", { status });
  },
});
const hook = (path: string) => `http://127.0.0.1:${receiver.port}${path}`;

beforeAll(async () => {
  await migrate();
  // The webhook_* and analytics_reports tables cascade from apps; auth_* from users and workspaces.
  await sql`truncate apps, orgs, usage_events, auth_user, auth_organization, auth_verification cascade`;
});

afterAll(async () => {
  receiver.stop(true);
  await sql.close();
});

describe("public routes", () => {
  test("root, health, openapi", async () => {
    expect((await call("GET", "/", { key: null })).json).toBe("Offer API.");
    expect((await call("GET", "/health", { key: null })).json).toEqual({ ok: true });
    expect((await call("GET", "/openapi.json", { key: null })).json.openapi).toBe("3.1.0");
  });
});

describe("apps", () => {
  test("create without auth", async () => {
    const res = await call("POST", "/apps", { key: null, body: { name: "My SaaS", plan: "pro" } });
    expect(res.status).toBe(201);
    expect(res.json.id).toMatch(/^app_[A-Za-z]{6}$/);
    expect(res.json.api_key).toMatch(/^key_[A-Za-z]{32}$/);
    expect(res.json.public_key).toMatch(/^pub_[A-Za-z]{32}$/);
    ({ id: appId, api_key: apiKey, public_key: publicKey } = res.json);
  });

  test("auth", async () => {
    expect((await call("GET", `/apps/${appId}`, { key: null })).status).toBe(401);
    expect((await call("GET", `/apps/${appId}`, { key: "nope" })).status).toBe(401);
    expect((await call("GET", `/apps/${appId}`, { key: publicKey })).status).toBe(401);
    expect((await call("GET", `/apps/${appId}`, { key: apiKey })).json.name).toBe("My SaaS");
    expect((await call("GET", `/apps/${appId}`)).status).toBe(200);
  });

  test("key from another app is rejected", async () => {
    const other = await call("POST", "/apps", { key: null, body: { name: "Other" } });
    expect((await call("GET", `/apps/${appId}`, { key: other.json.api_key })).status).toBe(401);
    await call("DELETE", `/apps/${other.json.id}`);
  });

  test("patch merges and protects keys", async () => {
    const res = await call("PATCH", `/apps/${appId}`, {
      key: apiKey,
      body: { name: "Renamed", extra: 1, api_key: "hijack" },
    });
    expect(res.json).toMatchObject({ id: appId, name: "Renamed", plan: "pro", extra: 1, api_key: apiKey });
  });

  test("regenerate keys", async () => {
    const res = await call("POST", `/apps/${appId}/keys/regenerate`, { key: apiKey });
    expect(res.json.api_key).not.toBe(apiKey);
    expect((await call("GET", `/apps/${appId}`, { key: apiKey })).status).toBe(401);
    apiKey = res.json.api_key;
    expect((await call("GET", `/apps/${appId}`, { key: apiKey })).json.api_key).toBe(apiKey);

    const pub = await call("POST", `/apps/${appId}/public-key/regenerate`, { key: apiKey });
    expect(pub.json.public_key).not.toBe(publicKey);
    publicKey = pub.json.public_key;
  });

  test("404s", async () => {
    expect((await call("GET", "/apps/app_missing")).status).toBe(404);
    expect((await call("PATCH", "/apps/app_missing", { body: {} })).status).toBe(404);
  });

  test("invalid JSON is a 400", async () => {
    const res = await app.request(`/apps/${appId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: "{nope",
    });
    expect(res.status).toBe(400);
  });
});

describe("catalog", () => {
  test("entitlements", async () => {
    const created = await call("POST", `/apps/${appId}/entitlements`, {
      key: apiKey,
      body: { id: "API Calls", type: "usage", name: "API calls" },
    });
    expect(created.status).toBe(201);
    expect(created.json.id).toBe("api_calls");

    await call("POST", `/apps/${appId}/entitlements`, {
      key: apiKey,
      body: { id: "sso", type: "boolean", name: "SSO" },
    });
    await call("POST", `/apps/${appId}/entitlements`, {
      key: apiKey,
      body: { id: "seats", type: "usage", name: "Seats" },
    });

    expect(
      (await call("POST", `/apps/${appId}/entitlements`, { key: apiKey, body: { id: "x", type: "bad" } })).status,
    ).toBe(400);
    expect(
      (await call("POST", `/apps/${appId}/entitlements`, { key: apiKey, body: { id: "sso", type: "boolean" } }))
        .status,
    ).toBe(409);

    const list = await call("GET", `/apps/${appId}/entitlements`, { key: apiKey });
    expect(list.json.map((e: any) => e.id)).toEqual(["api_calls", "sso", "seats"]);

    const patched = await call("PATCH", `/apps/${appId}/entitlements/sso`, {
      key: apiKey,
      body: { description: "Single sign-on" },
    });
    expect(patched.json).toMatchObject({ id: "sso", type: "boolean", description: "Single sign-on" });
    expect(
      (await call("PATCH", `/apps/${appId}/entitlements/sso`, { key: apiKey, body: { type: "nah" } })).status,
    ).toBe(400);
  });

  test("addons", async () => {
    expect(
      (await call("POST", `/apps/${appId}/addons`, { key: apiKey, body: { id: "priority-support", name: "PS" } }))
        .json.id,
    ).toBe("prioritysupport");
    await call("POST", `/apps/${appId}/addons`, { key: apiKey, body: { id: "white_label", name: "WL" } });
    expect((await call("GET", `/apps/${appId}/addons/white_label`, { key: apiKey })).json.name).toBe("WL");
    expect((await call("GET", `/apps/${appId}/addons`, { key: apiKey })).json).toHaveLength(2);
  });

  test("plans", async () => {
    const created = await call("POST", `/apps/${appId}/plans`, {
      key: apiKey,
      body: {
        id: "Pro",
        name: "Pro",
        description: "For teams",
        pricingCard: { title: "Pro", price: 29 },
      },
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      id: "pro",
      isFree: false,
      note: null,
      entitlements: [],
      addons: [],
      meta: {},
    });
    await call("POST", `/apps/${appId}/plans`, { key: apiKey, body: { id: "free", name: "Free", isFree: true } });

    // entitlements on plan
    let plan = await call("POST", `/apps/${appId}/plans/pro/entitlements`, {
      key: apiKey,
      body: { id: "api_calls", max: 3 },
    });
    expect(plan.json.entitlements).toEqual([{ id: "api_calls", max: 3 }]);
    plan = await call("POST", `/apps/${appId}/plans/pro/entitlements`, { key: apiKey, body: { id: "sso", max: 9 } });
    expect(plan.json.entitlements).toEqual([{ id: "api_calls", max: 3 }, { id: "sso" }]);
    plan = await call("POST", `/apps/${appId}/plans/pro/entitlements`, { key: apiKey, body: { id: "seats" } });
    expect(plan.json.entitlements[2]).toEqual({ id: "seats", max: null });

    expect(
      (await call("POST", `/apps/${appId}/plans/pro/entitlements`, { key: apiKey, body: { id: "sso" } })).status,
    ).toBe(409);
    expect(
      (await call("POST", `/apps/${appId}/plans/pro/entitlements`, { key: apiKey, body: { id: "ghost" } })).status,
    ).toBe(404);
    expect(
      (await call("POST", `/apps/${appId}/plans/nope/entitlements`, { key: apiKey, body: { id: "sso" } })).json,
    ).toEqual({ error: "Plan not found" });

    plan = await call("PATCH", `/apps/${appId}/plans/pro/entitlements/seats`, { key: apiKey, body: { max: 5 } });
    expect(plan.json.entitlements[2]).toEqual({ id: "seats", max: 5 });
    expect(
      (await call("PATCH", `/apps/${appId}/plans/pro/entitlements/ghost`, { key: apiKey, body: { max: 1 } })).json,
    ).toEqual({ error: 'Entitlement "ghost" not on this plan' });

    plan = await call("DELETE", `/apps/${appId}/plans/pro/entitlements/seats`, { key: apiKey });
    expect(plan.json.entitlements.map((e: any) => e.id)).toEqual(["api_calls", "sso"]);

    // addons on plan
    plan = await call("POST", `/apps/${appId}/plans/pro/addons`, { key: apiKey, body: { id: "white_label" } });
    expect(plan.json.addons).toEqual(["white_label"]);
    expect(
      (await call("POST", `/apps/${appId}/plans/pro/addons`, { key: apiKey, body: { id: "white_label" } })).status,
    ).toBe(409);
    plan = await call("POST", `/apps/${appId}/plans/pro/addons`, { key: apiKey, body: { id: "prioritysupport" } });
    plan = await call("DELETE", `/apps/${appId}/plans/pro/addons/prioritysupport`, { key: apiKey });
    expect(plan.json.addons).toEqual(["white_label"]);

    // meta
    await call("PATCH", `/apps/${appId}/plans/pro/meta`, { key: apiKey, body: { color: "gold", secret: "s" } });
    plan = await call("PATCH", `/apps/${appId}/plans/pro`, { key: apiKey, body: { privateMetaKeys: ["secret"] } });
    expect(plan.json.meta).toEqual({ color: "gold", secret: "s" });
    expect(plan.json.privateMetaKeys).toEqual(["secret"]);

    // pricing
    const cards = await call("GET", `/apps/${appId}/plans/pricing`, { key: publicKey });
    expect(cards.status).toBe(200);
    expect(cards.json).toEqual([{ plan_id: "pro", isFree: false, title: "Pro", price: 29 }]);
    expect((await call("GET", `/apps/${appId}/plans/pro/pricing`, { key: publicKey })).json.price).toBe(29);
    expect((await call("GET", `/apps/${appId}/plans/free/pricing`, { key: apiKey })).json).toEqual({
      error: "No pricing card set",
    });
    // public key cannot list plans
    expect((await call("GET", `/apps/${appId}/plans`, { key: publicKey })).status).toBe(401);
  });

  test("incentives", async () => {
    const created = await call("POST", `/apps/${appId}/incentives`, {
      key: apiKey,
      body: { id: "summer", name: "Summer promo" },
    });
    expect(created.json).toMatchObject({ id: "summer", entitlements: [], addons: [] });

    let inc = await call("POST", `/apps/${appId}/incentives/summer/entitlements`, {
      key: apiKey,
      body: { id: "api_calls", max: 10 },
    });
    expect(inc.json.entitlements).toEqual([{ id: "api_calls", max: 10 }]);
    inc = await call("POST", `/apps/${appId}/incentives/summer/entitlements`, {
      key: apiKey,
      body: { id: "seats", max: 2 },
    });
    expect(
      (await call("POST", `/apps/${appId}/incentives/summer/entitlements`, { key: apiKey, body: { id: "seats" } }))
        .json,
    ).toEqual({ error: 'Entitlement "seats" is already on this incentive' });
    inc = await call("POST", `/apps/${appId}/incentives/summer/addons`, {
      key: apiKey,
      body: { id: "prioritysupport" },
    });
    expect(inc.json.addons).toEqual(["prioritysupport"]);
    expect((await call("GET", `/apps/${appId}/incentives`, { key: apiKey })).json).toHaveLength(1);
  });
});

describe("namespaces", () => {
  test("create", async () => {
    const ns = await call("POST", `/apps/${appId}/namespaces`, {
      key: apiKey,
      body: { id: "user_1", name: "Alice Co", plan: "pro", incentive: "summer" },
    });
    expect(ns.status).toBe(201);
    expect(ns.json).toMatchObject({ id: "user_1", app_id: appId, plan: "pro", incentive: "summer" });

    // unknown incentive is dropped silently
    const ns2 = await call("POST", `/apps/${appId}/namespaces`, {
      key: apiKey,
      body: { id: "user_2", name: "Bob Ltd", plan: "free", incentive: "ghost" },
    });
    expect(ns2.json.incentive).toBeNull();
    await call("POST", `/apps/${appId}/namespaces`, {
      key: apiKey,
      body: { id: "user_3", name: "Carol 100%", plan: "pro" },
    });

    expect(
      (await call("POST", `/apps/${appId}/namespaces`, { key: apiKey, body: { id: "user_1", plan: "pro" } })).status,
    ).toBe(409);
    expect(
      (await call("POST", `/apps/${appId}/namespaces`, { key: apiKey, body: { id: "x", plan: "ghost" } })).json,
    ).toEqual({ error: 'Plan "ghost" not found' });
  });

  test("search", async () => {
    const all = await call("GET", `/apps/${appId}/namespaces`, { key: apiKey });
    expect(all.json.total).toBe(3);
    expect(all.json.page).toBe(1);
    expect(all.json.per_page).toBe(20);
    expect(all.json.data[0]).toMatchObject({ id: "user_3", namespace_id: "user_3", has_incentive: false });
    expect(typeof all.json.data[0].created_at).toBe("number");
    expect("incentive" in all.json.data[0]).toBe(false);

    const byPlan = await call("GET", `/apps/${appId}/namespaces?plan=pro`, { key: apiKey });
    expect(byPlan.json.data.map((d: any) => d.id).sort()).toEqual(["user_1", "user_3"]);

    const q = await call("GET", `/apps/${appId}/namespaces?q=bob`, { key: apiKey });
    expect(q.json.data.map((d: any) => d.id)).toEqual(["user_2"]);
    const pct = await call("GET", `/apps/${appId}/namespaces?q=100%25`, { key: apiKey });
    expect(pct.json.data.map((d: any) => d.id)).toEqual(["user_3"]);
    const star = await call("GET", `/apps/${appId}/namespaces?q=*&per_page=1&page=2`, { key: apiKey });
    expect(star.json).toMatchObject({ total: 3, page: 2, per_page: 1 });
    expect(star.json.data).toHaveLength(1);

    const inc = await call("GET", `/apps/${appId}/namespaces?has_incentive=true`, { key: apiKey });
    expect(inc.json.data).toEqual([expect.objectContaining({ id: "user_1", incentive: "summer", has_incentive: true })]);
    const withInc = await call("GET", `/apps/${appId}/namespaces/with-incentive?incentive=summer`, { key: apiKey });
    expect(withInc.json.total).toBe(1);

    expect((await call("GET", `/apps/${appId}/namespaces/count`, { key: apiKey })).json).toEqual({ count: 3 });

    const planNs = await call("GET", `/apps/${appId}/plans/pro/namespaces`, { key: apiKey });
    expect(planNs.json.total).toBe(2);
    expect(Object.keys(planNs.json.data[0]).sort()).toEqual(["id", "name"]);
  });

  test("patch", async () => {
    expect(
      (await call("PATCH", `/apps/${appId}/namespaces/user_2`, { key: apiKey, body: { plan: "ghost" } })).status,
    ).toBe(404);
    expect(
      (await call("PATCH", `/apps/${appId}/namespaces/user_2`, { key: apiKey, body: { incentive: "ghost" } })).json,
    ).toEqual({ error: 'Incentive "ghost" not found' });
    const ns = await call("PATCH", `/apps/${appId}/namespaces/user_2`, {
      key: apiKey,
      body: { name: "Bob Inc", incentive: "summer" },
    });
    expect(ns.json).toMatchObject({ name: "Bob Inc", incentive: "summer", plan: "free" });
    const cleared = await call("DELETE", `/apps/${appId}/namespaces/user_2/incentive`, { key: apiKey });
    expect(cleared.json.incentive).toBeNull();
    // search index reflects the change immediately
    const q = await call("GET", `/apps/${appId}/namespaces?q=bob inc`, { key: apiKey });
    expect(q.json.data[0]).toMatchObject({ name: "Bob Inc", has_incentive: false });
  });
});

describe("usage + plan resolution", () => {
  test("usage counters", async () => {
    const base = `/apps/${appId}/namespaces/user_1/usage`;
    expect((await call("POST", `${base}/api_calls/add`, { key: publicKey })).json).toEqual({
      entitlement: "api_calls",
      count: 1,
    });
    await call("POST", `${base}/api_calls/add`, { key: apiKey });
    await call("POST", `${base}/api_calls/add`, { key: apiKey });
    expect((await call("POST", `${base}/api_calls/remove`, { key: apiKey })).json.count).toBe(2);
    expect((await call("POST", `${base}/api_calls/amount`, { key: apiKey, body: { amount: 5 } })).json.count).toBe(7);
    expect((await call("POST", `${base}/api_calls/amount`, { key: apiKey, body: { amount: 1.5 } })).status).toBe(400);
    expect((await call("POST", `${base}/sso/add`, { key: apiKey })).json).toEqual({
      error: "Entitlement is not a usage type",
    });
    expect((await call("POST", `${base}/ghost/add`, { key: apiKey })).status).toBe(404);
    expect(
      (await call("POST", `/apps/${appId}/namespaces/ghost/usage/api_calls/add`, { key: apiKey })).json,
    ).toEqual({ error: "Namespace not found" });

    expect((await call("GET", `${base}/api_calls`, { key: publicKey })).json).toEqual({
      entitlement: "api_calls",
      count: 7,
    });
    expect((await call("GET", `${base}/seats`, { key: apiKey })).json.count).toBe(0);
    expect((await call("GET", base, { key: apiKey })).json).toEqual({ api_calls: 7, sso: 0 });
  });

  test("concurrent increments are atomic", async () => {
    const base = `/apps/${appId}/namespaces/user_3/usage/api_calls/add`;
    await Promise.all(Array.from({ length: 25 }, () => call("POST", base, { key: apiKey })));
    expect((await call("GET", `/apps/${appId}/namespaces/user_3/usage/api_calls`, { key: apiKey })).json.count).toBe(
      25,
    );
  });

  test("plan with incentive overlay", async () => {
    const res = await call("GET", `/apps/${appId}/namespaces/user_1/plan`, { key: publicKey });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      plan: { id: "pro", name: "Pro", description: "For teams", isFree: false, meta: { color: "gold" } },
      incentive: "summer",
      offer: null,
      addons: ["white_label", "prioritysupport"],
      entitlements: [
        { id: "api_calls", feature: "api_calls", name: "API calls", type: "usage", usage: 7, max: 10, left: 3, can: true },
        { id: "sso", feature: "sso", name: "SSO", type: "boolean", usage: 0, max: null, left: null, can: true },
        { id: "seats", feature: "seats", name: "Seats", type: "usage", usage: 0, max: 2, left: 2, can: true },
      ],
    });

    const full = await call("GET", `/apps/${appId}/namespaces/user_1/full-plan`, { key: apiKey });
    expect(full.json.plan.meta).toEqual({ color: "gold", secret: "s" });
    expect(full.json.plan.privateMetaKeys).toEqual(["secret"]);

    const over = await call("GET", `/apps/${appId}/namespaces/user_3/plan`, { key: apiKey });
    expect(over.json.entitlements[0]).toMatchObject({ usage: 25, max: 3, left: 0, can: false });

    expect((await call("GET", `/apps/${appId}/namespaces/ghost/plan`, { key: apiKey })).status).toBe(404);
  });

  test("analytics", async () => {
    expect((await call("GET", `/apps/${appId}/analytics`, { key: apiKey })).json).toEqual({
      error: "interval is required",
    });
    expect((await call("GET", `/apps/${appId}/analytics?interval=2d`, { key: apiKey })).status).toBe(400);

    const summary = await call("GET", `/apps/${appId}/analytics?interval=7d`, { key: apiKey });
    expect(summary.json).toEqual([{ entitlement_id: "api_calls", calls: 30, total_amount: 32 }]);

    const ns = await call("GET", `/apps/${appId}/analytics?interval=alltime&namespace=user_1`, { key: apiKey });
    expect(ns.json).toEqual([{ entitlement_id: "api_calls", calls: 5, total_amount: 7 }]);

    const top = await call("GET", `/apps/${appId}/analytics/top-namespaces?limit=1`, { key: apiKey });
    expect(top.json).toEqual([{ namespace_id: "user_3", calls: 25, total_amount: 25 }]);
    expect((await call("GET", `/apps/${appId}/analytics/top-namespaces?limit=0`, { key: apiKey })).status).toBe(400);
    expect(
      (await call("GET", `/apps/${appId}/analytics/top-namespaces?entitlement=seats`, { key: apiKey })).json,
    ).toEqual([]);
    // public key can't read analytics
    expect((await call("GET", `/apps/${appId}/analytics?interval=7d`, { key: publicKey })).status).toBe(401);
  });

  test("analytics timeseries and events", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const daily = await call("GET", `/apps/${appId}/analytics/timeseries?interval=7d`, { key: apiKey });
    expect(daily.json).toEqual([{ date: today, entitlement_id: "api_calls", calls: 30, total_amount: 32 }]);

    const weekly = await call("GET", `/apps/${appId}/analytics/timeseries?interval=6m&namespace=user_1`, { key: apiKey });
    expect(weekly.json).toHaveLength(1);
    expect(new Date(weekly.json[0].date).getUTCDay()).toBe(1); // weeks start on Monday
    expect(weekly.json[0]).toMatchObject({ entitlement_id: "api_calls", calls: 5, total_amount: 7 });
    expect((await call("GET", `/apps/${appId}/analytics/timeseries?interval=2d`, { key: apiKey })).status).toBe(400);

    const events = await call("GET", `/apps/${appId}/analytics/events?namespace=user_1&limit=2`, { key: apiKey });
    expect(events.json).toHaveLength(2);
    expect(events.json[0]).toMatchObject({ namespace_id: "user_1", entitlement_id: "api_calls", operation: "amount", amount: 5, count: 7 });
    expect(typeof events.json[0].id).toBe("number");
    expect(events.json[0].id).toBeGreaterThan(events.json[1].id);
    expect((await call("GET", `/apps/${appId}/analytics/events`, { key: publicKey })).status).toBe(401);
  });

  test("saved analytics reports", async () => {
    const base = `/apps/${appId}/analytics/reports`;
    expect((await call("POST", base, { key: apiKey, body: { name: " " } })).status).toBe(400);
    expect((await call("POST", base, { key: apiKey, body: { name: "x", interval: "2d" } })).status).toBe(400);

    const created = await call("POST", base, { key: apiKey, body: { name: " API ", entitlements: ["api_calls", "api_calls"] } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ app_id: appId, name: "API", entitlements: ["api_calls"], interval: "30d" });
    expect(created.json.id).toMatch(/^rpt_/);

    const patched = await call("PATCH", `${base}/${created.json.id}`, { key: apiKey, body: { interval: "6m" } });
    expect(patched.json).toMatchObject({ name: "API", interval: "6m" });
    expect((await call("GET", base, { key: apiKey })).json).toHaveLength(1);
    expect((await call("DELETE", `${base}/${created.json.id}`, { key: apiKey })).json).toEqual({ deleted: true });
    expect((await call("GET", `${base}/${created.json.id}`, { key: apiKey })).status).toBe(404);
  });

  test("deleting a namespace clears its counters", async () => {
    expect((await call("DELETE", `/apps/${appId}/namespaces/user_3`, { key: apiKey })).json).toEqual({
      deleted: true,
    });
    await call("POST", `/apps/${appId}/namespaces`, { key: apiKey, body: { id: "user_3", name: "C", plan: "pro" } });
    expect((await call("GET", `/apps/${appId}/namespaces/user_3/usage/api_calls`, { key: apiKey })).json.count).toBe(0);
  });

  test("deleted plan surfaces as Plan not found", async () => {
    await call("DELETE", `/apps/${appId}/plans/free`, { key: apiKey });
    expect((await call("GET", `/apps/${appId}/namespaces/user_2/plan`, { key: apiKey })).json).toEqual({
      error: "Plan not found",
    });
  });
});

describe("orgs", () => {
  test("admin only", async () => {
    expect((await call("GET", "/orgs", { key: apiKey })).status).toBe(401);
  });

  test("crud", async () => {
    const created = await call("POST", "/orgs", { body: { id: "acme", app_ids: [appId, "app_gone"] } });
    expect(created.status).toBe(201);
    expect((await call("POST", "/orgs", { body: { id: "acme" } })).status).toBe(409);
    expect((await call("GET", "/orgs")).json).toHaveLength(1);
    expect((await call("GET", "/orgs/acme")).json.app_ids).toEqual([appId, "app_gone"]);

    const apps = await call("GET", "/orgs/acme/apps");
    expect(apps.json.map((a: any) => a.id)).toEqual([appId]);

    const patched = await call("PATCH", "/orgs/acme", { body: { app_ids: [] } });
    expect(patched.json.app_ids).toEqual([]);
    expect((await call("GET", "/orgs/acme/apps")).json).toEqual([]);

    expect((await call("DELETE", "/orgs/acme")).json).toEqual({ deleted: true });
    expect((await call("GET", "/orgs/acme")).status).toBe(404);
  });
});

describe("webhooks", () => {
  // A separate app so the event log only holds what these tests emit.
  let wh: string;
  let whKey: string;
  let whPub: string;
  const hooks = () => `/apps/${wh}/webhooks`;
  const events = async (query = "") => (await call("GET", `/apps/${wh}/events${query}`, { key: whKey })).json;
  const deliveries = async (endpointId: string) =>
    (await call("GET", `${hooks()}/${endpointId}/deliveries`, { key: whKey })).json;
  const create = (body: unknown) => call("POST", hooks(), { key: whKey, body });

  test("setup", async () => {
    const res = await call("POST", "/apps", { key: null, body: { name: "Hooks" } });
    ({ id: wh, api_key: whKey, public_key: whPub } = res.json);
    await call("POST", `/apps/${wh}/entitlements`, { key: whKey, body: { id: "credits", type: "usage", name: "Credits" } });
    await call("POST", `/apps/${wh}/plans`, { key: whKey, body: { id: "basic", name: "Basic" } });
    await call("POST", `/apps/${wh}/plans`, { key: whKey, body: { id: "max", name: "Max" } });
    await call("POST", `/apps/${wh}/plans/basic/entitlements`, { key: whKey, body: { id: "credits", max: 10 } });
    await call("POST", `/apps/${wh}/incentives`, { key: whKey, body: { id: "promo", name: "Promo" } });
  });

  test("event types are public", async () => {
    const res = await call("GET", "/event-types", { key: null });
    expect(res.status).toBe(200);
    expect(res.json).toHaveLength(22);
    expect(res.json[0]).toMatchObject({ type: "account.created", category: "account", title: "Account created" });
    expect(res.json[0].sample.object.app_id).toBe("app_123");
  });

  test("auth", async () => {
    expect((await call("GET", hooks(), { key: whPub })).status).toBe(401);
    expect((await call("POST", hooks(), { key: whPub, body: {} })).status).toBe(401);
    expect((await call("GET", `/apps/${wh}/events`, { key: whPub })).status).toBe(401);
    expect((await call("GET", hooks(), { key: null })).status).toBe(401);
    expect((await call("GET", hooks(), { key: apiKey })).status).toBe(401); // another app's key
  });

  test("create, validate, update, delete", async () => {
    const bad = async (body: unknown) => (await create(body)).json.error;
    expect(await bad({ url: "nope", events: ["*"] })).toBe("url must be a valid http(s) URL");
    expect(await bad({ url: "ftp://example.com", events: ["*"] })).toBe("url must be a valid http(s) URL");
    expect(await bad({ url: `https://example.com/${"a".repeat(2048)}`, events: ["*"] })).toBe(
      "url must be a valid http(s) URL",
    );
    expect(await bad({ url: "https://example.com" })).toBe("events must be a non-empty array");
    expect(await bad({ url: "https://example.com", events: [] })).toBe("events must be a non-empty array");
    expect(await bad({ url: "https://example.com", events: ["x"] })).toBe('Unknown event type "x"');
    expect(await bad({ url: "https://example.com", events: ["*"], source: "ifttt" })).toBe(
      'source must be "custom" or "zapier"',
    );
    expect((await create({ url: "nope", events: ["*"] })).status).toBe(400);

    const created = await create({ url: "https://example.com/a", events: ["*", "plan.created"] });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      app_id: wh,
      url: "https://example.com/a",
      description: null,
      events: ["*"],
      enabled: true,
      source: "custom",
      disabled_reason: null,
      stats: { total: 0, succeeded: 0, failed: 0, pending: 0, last_delivery_at: null, last_status: null, last_response_status: null },
    });
    expect(created.json.id).toMatch(/^whk_[A-Za-z]{16}$/);
    expect(created.json.secret).toMatch(/^whsec_/);
    expect(Buffer.from(created.json.secret.slice(6), "base64")).toHaveLength(24);
    expect(typeof created.json.created_at).toBe("string");

    const second = await create({
      url: "https://example.com/b",
      events: ["account.created", "plan.created", "account.created"],
      description: "Zap",
      source: "zapier",
      enabled: false,
    });
    expect(second.json).toMatchObject({
      events: ["account.created", "plan.created"],
      description: "Zap",
      source: "zapier",
      enabled: false,
    });

    const list = await call("GET", hooks(), { key: whKey });
    expect(list.json.map((e: any) => e.id)).toEqual([created.json.id, second.json.id]);
    expect((await call("GET", `${hooks()}/${second.json.id}`, { key: whKey })).json.url).toBe("https://example.com/b");
    expect((await call("GET", `${hooks()}/whk_missing`, { key: whKey })).json).toEqual({
      error: "Webhook endpoint not found",
    });

    // PATCH: same validation, other keys ignored, enabling clears disabled_reason
    await sql`update webhook_endpoints set disabled_reason = 'Endpoint returned 410 Gone' where id = ${second.json.id}`;
    const path = `${hooks()}/${second.json.id}`;
    expect((await call("PATCH", path, { key: whKey, body: { url: "http://" } })).status).toBe(400);
    expect((await call("PATCH", path, { key: whKey, body: { events: ["nope"] } })).json).toEqual({
      error: 'Unknown event type "nope"',
    });
    const patched = await call("PATCH", path, {
      key: whKey,
      body: { enabled: true, description: null, events: ["account.deleted"], secret: "x", source: "custom" },
    });
    expect(patched.json).toMatchObject({
      enabled: true,
      disabled_reason: null,
      description: null,
      events: ["account.deleted"],
      source: "zapier",
      secret: second.json.secret,
      url: "https://example.com/b",
    });
    expect(patched.json.updated_at > second.json.updated_at).toBe(true);
    expect((await call("PATCH", `${hooks()}/whk_missing`, { key: whKey, body: {} })).status).toBe(404);

    const regen = await call("POST", `${path}/secret/regenerate`, { key: whKey });
    expect(regen.json.secret).toMatch(/^whsec_/);
    expect(regen.json.secret).not.toBe(second.json.secret);
    expect((await call("GET", path, { key: whKey })).json.secret).toBe(regen.json.secret);

    expect((await call("DELETE", path, { key: whKey })).json).toEqual({ deleted: true });
    expect((await call("DELETE", path, { key: whKey })).status).toBe(404);
    expect((await call("DELETE", `${hooks()}/${created.json.id}`, { key: whKey })).json).toEqual({ deleted: true });
  });

  test("at most 25 endpoints per app", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await create({ url: `https://example.com/${i}`, events: ["*"] })).status).toBe(201);
    }
    expect((await create({ url: "https://example.com/26", events: ["*"] })).json).toEqual({
      error: "An app can have at most 25 webhook endpoints",
    });
    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("private address guard", async () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("api.localhost")).toBe(true);
    expect(isPrivateHost("printer.local")).toBe(true);
    expect(isPrivateHost("metadata.google.internal")).toBe(true);
    expect(isPrivateHost("10.1.2.3")).toBe(true);
    expect(isPrivateHost("100.64.0.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("0.0.0.0")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
    expect(isPrivateHost("[::]")).toBe(true);
    expect(isPrivateHost("[fd00::1]")).toBe(true);
    expect(isPrivateHost("[fe80::1]")).toBe(true);
    expect(isPrivateHost("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateHost(new URL("http://[::ffff:127.0.0.1]/").hostname)).toBe(true);
    expect(isPrivateHost(new URL("http://[::ffff:8.8.8.8]/").hostname)).toBe(false);
    expect(isPrivateHost("[2606:4700::1111]")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("example.com")).toBe(false);

    process.env.WEBHOOKS_ALLOW_PRIVATE_URLS = "false";
    try {
      for (const url of ["http://127.0.0.1", "http://localhost:3000/x", "http://[::1]/", "https://10.0.0.8/"]) {
        expect((await create({ url, events: ["*"] })).json).toEqual({ error: "url must point to a public address" });
      }
      const ok = await create({ url: "https://example.com/hook", events: ["*"] });
      expect(ok.status).toBe(201);
      expect(
        (await call("PATCH", `${hooks()}/${ok.json.id}`, { key: whKey, body: { url: "http://192.168.0.1" } })).json,
      ).toEqual({ error: "url must point to a public address" });

      // Delivery re-checks the address, e.g. for endpoints saved while the flag was on.
      await sql`update webhook_endpoints set url = ${hook("/ok")} where id = ${ok.json.id}`;
      const before = received.length;
      const delivery = await call("POST", `${hooks()}/${ok.json.id}/test`, { key: whKey });
      expect(delivery.json).toMatchObject({ status: "failed", error: "Resolves to a private address", response_status: null });
      expect(received.length).toBe(before);
      await call("DELETE", `${hooks()}/${ok.json.id}`, { key: whKey });
    } finally {
      process.env.WEBHOOKS_ALLOW_PRIVATE_URLS = "true";
    }
  });

  let allId: string;

  test("events are recorded and fanned out", async () => {
    // Recorded even without endpoints (the plan.created events from setup).
    expect((await events()).map((e: any) => e.type)).toEqual([
      "incentive.created",
      "plan.updated",
      "plan.created",
      "plan.created",
    ]);

    const all = await create({ url: hook("/ok"), events: ["*"] });
    allId = all.json.id;
    const deletesOnly = await create({ url: hook("/ok"), events: ["account.deleted"] });
    await create({ url: hook("/ok"), events: ["*"], enabled: false });

    await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_1", name: "Acme", plan: "basic" } });
    await call("PATCH", `/apps/${wh}/namespaces/acct_1`, { key: whKey, body: { plan: "max", name: "Acme Inc" } });
    await call("PATCH", `/apps/${wh}/namespaces/acct_1`, { key: whKey, body: { name: "Acme Inc" } }); // no change
    await call("PATCH", `/apps/${wh}/namespaces/acct_1`, { key: whKey, body: { incentive: "promo" } });
    await call("DELETE", `/apps/${wh}/namespaces/acct_1/incentive`, { key: whKey });
    await call("DELETE", `/apps/${wh}/namespaces/acct_1/incentive`, { key: whKey }); // had none
    await call("DELETE", `/apps/${wh}/namespaces/acct_1`, { key: whKey });

    const log = await events();
    expect(log.slice(0, 9).map((e: any) => e.type)).toEqual([
      "account.deleted",
      "account.incentive_removed",
      "account.updated",
      "account.incentive_applied",
      "account.updated",
      "account.plan_changed",
      "account.updated",
      "account.created",
      "incentive.created",
    ]);
    const [deleted, removed, , applied, , planChanged, updated, created] = log;
    expect(created).toMatchObject({ app_id: wh, data: { object: { id: "acct_1", plan: "basic", incentive: null } } });
    expect(created.id).toMatch(/^evt_[A-Za-z]{24}$/);
    expect("test" in created).toBe(false);
    expect(updated.data).toEqual({
      object: expect.objectContaining({ plan: "max", name: "Acme Inc" }),
      previous: { plan: "basic", name: "Acme" },
    });
    expect(planChanged.data.previous).toEqual({ plan: "basic" });
    expect(applied.data).toMatchObject({ object: { incentive: "promo" }, previous: { incentive: null } });
    expect(removed.data).toMatchObject({ object: { incentive: null }, previous: { incentive: "promo" } });
    expect(deleted.data.object).toMatchObject({ id: "acct_1", plan: "max", name: "Acme Inc" });

    expect((await events("?type=account.updated")).map((e: any) => e.type)).toEqual([
      "account.updated",
      "account.updated",
      "account.updated",
    ]);
    expect(await events("?limit=2")).toHaveLength(2);
    expect((await call("GET", `/apps/${wh}/events?type=nope`, { key: whKey })).json).toEqual({
      error: 'Unknown event type "nope"',
    });

    // "*" gets the 8 account events, account.deleted-only gets 1, disabled gets none.
    const toAll = await deliveries(allId);
    expect(toAll).toHaveLength(8);
    expect(toAll[0]).toMatchObject({
      endpoint_id: allId,
      event_id: deleted.id,
      event_type: "account.deleted",
      status: "pending",
      attempts: 0,
      test: false,
      response_status: null,
      payload: deleted,
    });
    expect(toAll[0].id).toMatch(/^whd_[A-Za-z]{24}$/);
    expect((await deliveries(deletesOnly.json.id)).map((d: any) => d.event_type)).toEqual(["account.deleted"]);
    expect(
      (await call("GET", `${hooks()}/${allId}/deliveries?limit=3&status=pending`, { key: whKey })).json,
    ).toHaveLength(3);
    expect((await call("GET", `${hooks()}/${allId}/deliveries?status=failed`, { key: whKey })).json).toEqual([]);

    const stats = (await call("GET", `${hooks()}/${allId}`, { key: whKey })).json.stats;
    expect(stats).toMatchObject({ total: 8, pending: 8, succeeded: 0, failed: 0, last_status: "pending" });

    // Plan and incentive events, including the shared attachment routes.
    await call("PATCH", `/apps/${wh}/plans/max`, { key: whKey, body: { description: "Most" } });
    await call("PATCH", `/apps/${wh}/plans/max/meta`, { key: whKey, body: { color: "red" } });
    await call("POST", `/apps/${wh}/incentives/promo/entitlements`, { key: whKey, body: { id: "credits", max: 20 } });
    await call("DELETE", `/apps/${wh}/plans/max`, { key: whKey });
    await call("DELETE", `/apps/${wh}/incentives/ghost`, { key: whKey }); // 404, no event
    const latest = await events("?limit=4");
    expect(latest.map((e: any) => e.type)).toEqual(["plan.deleted", "incentive.updated", "plan.updated", "plan.updated"]);
    expect(latest[3].data.previous).toEqual({ description: null });
    expect(latest[2].data.previous).toEqual({ meta: {} });
    expect(latest[1].data).toMatchObject({ object: { entitlements: [{ id: "credits", max: 20 }] }, previous: { entitlements: [] } });
    expect(latest[0].data.object).toMatchObject({ id: "max", description: "Most", meta: { color: "red" } });

    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("usage limit events fire once per crossing", async () => {
    await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_2", name: "Beta", plan: "basic" } });
    const usage = (path: string, body?: unknown) =>
      call("POST", `/apps/${wh}/namespaces/acct_2/usage/credits/${path}`, { key: whKey, body });
    const usageEvents = async () =>
      (await events("?limit=100")).filter((e: any) => e.type.startsWith("usage."));

    // Nobody listening: nothing is computed or recorded.
    await create({ url: hook("/ok"), events: ["account.created"] });
    await usage("amount", { amount: 9 });
    expect(await usageEvents()).toEqual([]);
    await usage("amount", { amount: -9 });

    await create({ url: hook("/ok"), events: ["usage.limit_warning", "usage.limit_reached"] });
    await usage("amount", { amount: 7 }); // 7
    await usage("add"); // 8: warning
    await usage("add"); // 9
    await usage("add"); // 10: reached
    await usage("add"); // 11
    await usage("remove"); // 10
    await usage("amount", { amount: -5 }); // 5
    await usage("amount", { amount: 5 }); // 10: jumps both thresholds, reached only

    const fired = await usageEvents();
    expect(fired.map((e: any) => e.type)).toEqual(["usage.limit_reached", "usage.limit_reached", "usage.limit_warning"]);
    expect(fired[2].data).toEqual({
      object: {
        account_id: "acct_2",
        entitlement_id: "credits",
        entitlement_name: "Credits",
        usage: 8,
        max: 10,
        left: 2,
        percent: 80,
      },
    });
    expect(fired[1].data.object).toMatchObject({ usage: 10, max: 10, left: 0, percent: 100 });

    // The incentive's limit (20) wins over the plan's (10).
    await call("PATCH", `/apps/${wh}/namespaces/acct_2`, { key: whKey, body: { incentive: "promo" } });
    await usage("amount", { amount: 6 }); // 16: warning at 80% of 20
    const latest = (await usageEvents())[0];
    expect(latest).toMatchObject({ type: "usage.limit_warning", data: { object: { usage: 16, max: 20, percent: 80 } } });

    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("test delivery is signed and sent once", async () => {
    const endpoint = (await create({ url: hook("/ok"), events: ["*"] })).json;
    const statsBefore = endpoint.stats;
    const before = received.length;

    const res = await call("POST", `${hooks()}/${endpoint.id}/test`, { key: whKey });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      endpoint_id: endpoint.id,
      event_type: "account.created",
      status: "succeeded",
      attempts: 1,
      next_attempt_at: null,
      response_status: 200,
      response_body: "ok",
      error: null,
      test: true,
      payload: { type: "account.created", app_id: wh, test: true, data: { object: { app_id: wh } } },
    });
    expect(typeof res.json.duration_ms).toBe("number");

    expect(received.length).toBe(before + 1);
    const req = received.at(-1)!;
    expect(req.path).toBe("/ok");
    expect(JSON.parse(req.body)).toEqual(res.json.payload);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("user-agent")).toBe("OfferSDK-Webhooks/1.0");
    expect(req.headers.get("webhook-id")).toBe(res.json.payload.id);
    const timestamp = req.headers.get("webhook-timestamp")!;
    expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(30);
    const key = Buffer.from(endpoint.secret.slice("whsec_".length), "base64");
    const expected = createHmac("sha256", key).update(`${res.json.payload.id}.${timestamp}.${req.body}`).digest("base64");
    expect(req.headers.get("webhook-signature")).toBe(`v1,${expected}`);

    // Explicit type, also allowed while disabled.
    await call("PATCH", `${hooks()}/${endpoint.id}`, { key: whKey, body: { enabled: false } });
    const typed = await call("POST", `${hooks()}/${endpoint.id}/test`, { key: whKey, body: { type: "plan.created" } });
    expect(typed.json).toMatchObject({ event_type: "plan.created", status: "succeeded" });
    expect((await call("POST", `${hooks()}/${endpoint.id}/test`, { key: whKey, body: { type: "x" } })).json).toEqual({
      error: 'Unknown event type "x"',
    });

    // Test events stay out of the event log and the stats.
    expect((await events("?limit=100")).some((e: any) => e.test)).toBe(false);
    expect((await call("GET", `${hooks()}/${endpoint.id}`, { key: whKey })).json.stats).toEqual(statsBefore);
    expect((await deliveries(endpoint.id)).map((d: any) => d.test)).toEqual([true, true]);

    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("failed attempts are retried on a schedule", async () => {
    const endpoint = (await create({ url: hook("/fail"), events: ["account.created"] })).json;
    await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_3", plan: "basic" } });
    const [pending] = await deliveries(endpoint.id);

    const first = (await attemptDelivery(pending.id))!;
    expect(first).toMatchObject({
      status: "pending",
      attempts: 1,
      response_status: 500,
      response_body: "boom",
      error: "HTTP 500",
    });
    const wait = new Date(first.next_attempt_at!).getTime() - Date.now();
    expect(wait).toBeGreaterThan(50_000);
    expect(wait).toBeLessThan(70_000);

    // Not due yet, so the worker doesn't pick it up.
    expect(await claimDueDeliveries(100)).not.toContain(pending.id);

    // The 7th attempt is the last.
    await sql`update webhook_deliveries set attempts = 6 where id = ${pending.id}`;
    const last = (await attemptDelivery(pending.id))!;
    expect(last).toMatchObject({ status: "failed", attempts: 7, next_attempt_at: null });

    // Manual retry: one attempt, stays failed.
    const retried = await call("POST", `${hooks()}/${endpoint.id}/deliveries/${pending.id}/retry`, { key: whKey });
    expect(retried.json).toMatchObject({ status: "failed", attempts: 8, next_attempt_at: null, response_status: 500 });
    expect(
      (await call("POST", `${hooks()}/${endpoint.id}/deliveries/whd_missing/retry`, { key: whKey })).json,
    ).toEqual({ error: "Delivery not found" });

    // Manual retry after fixing the endpoint succeeds.
    await call("PATCH", `${hooks()}/${endpoint.id}`, { key: whKey, body: { url: hook("/ok") } });
    const fixed = await call("POST", `${hooks()}/${endpoint.id}/deliveries/${pending.id}/retry`, { key: whKey });
    expect(fixed.json).toMatchObject({ status: "succeeded", response_status: 200, error: null });

    const stats = (await call("GET", `${hooks()}/${endpoint.id}`, { key: whKey })).json.stats;
    expect(stats).toMatchObject({ total: 1, succeeded: 1, last_status: "succeeded", last_response_status: 200 });
    expect(typeof stats.last_delivery_at).toBe("string");

    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("410 Gone disables the endpoint", async () => {
    const endpoint = (await create({ url: hook("/gone"), events: ["account.deleted"], source: "zapier" })).json;
    await call("DELETE", `/apps/${wh}/namespaces/acct_3`, { key: whKey });
    const [pending] = await deliveries(endpoint.id);

    expect(await attemptDelivery(pending.id)).toMatchObject({ status: "failed", attempts: 1, response_status: 410 });
    expect((await call("GET", `${hooks()}/${endpoint.id}`, { key: whKey })).json).toMatchObject({
      enabled: false,
      disabled_reason: "Endpoint returned 410 Gone",
    });

    // Disabled endpoints get no new deliveries...
    await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_4", plan: "basic" } });
    await call("DELETE", `/apps/${wh}/namespaces/acct_4`, { key: whKey });
    expect(await deliveries(endpoint.id)).toHaveLength(1);

    // ...and pending ones fail without a request once the endpoint is disabled.
    await call("PATCH", `${hooks()}/${endpoint.id}`, { key: whKey, body: { enabled: true, url: hook("/ok") } });
    await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_5", plan: "basic" } });
    await call("DELETE", `/apps/${wh}/namespaces/acct_5`, { key: whKey });
    await call("PATCH", `${hooks()}/${endpoint.id}`, { key: whKey, body: { enabled: false } });
    const [queued] = await deliveries(endpoint.id);
    const before = received.length;
    expect(await attemptDelivery(queued.id)).toMatchObject({ status: "failed", attempts: 0, error: "Endpoint disabled" });
    expect(received.length).toBe(before);

    await sql`delete from webhook_endpoints where app_id = ${wh}`;
  });

  test("worker sends new deliveries right away", async () => {
    // Leftover pending deliveries from other tests would be sent too; start clean.
    await sql`delete from webhook_deliveries`;
    const endpoint = (await create({ url: hook("/ok"), events: ["account.created"] })).json;
    const stop = startWebhookWorker();
    try {
      const before = received.length;
      await call("POST", `/apps/${wh}/namespaces`, { key: whKey, body: { id: "acct_6", plan: "basic" } });
      for (let i = 0; i < 50 && received.length === before; i++) await Bun.sleep(20);
      expect(received.length).toBe(before + 1);
      expect(JSON.parse(received.at(-1)!.body).data.object.id).toBe("acct_6");
    } finally {
      await stop();
    }
    const [delivery] = await deliveries(endpoint.id);
    expect(delivery).toMatchObject({ status: "succeeded", attempts: 1 });
  });

  test("deleting the app removes its webhooks", async () => {
    expect((await sql`select count(*)::int as n from webhook_events where app_id = ${wh}`)[0].n).toBeGreaterThan(0);
    await call("DELETE", `/apps/${wh}`, { key: whKey });
    const [{ n }] = await sql`
      select (select count(*) from webhook_endpoints where app_id = ${wh})
           + (select count(*) from webhook_events where app_id = ${wh})
           + (select count(*) from webhook_deliveries) as n`;
    expect(Number(n)).toBe(0);
  });
});

describe("agent threads", () => {
  const path = () => `/apps/${appId}/agent/threads`;
  const messages = [{ id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] }];

  test("admin key only", async () => {
    expect((await call("GET", `${path()}?user_id=u1`, { key: apiKey })).status).toBe(401);
    expect((await call("GET", `${path()}?user_id=u1`, { key: publicKey })).status).toBe(401);
    expect((await call("GET", path())).status).toBe(400);
  });

  test("create, update, list, rename, delete", async () => {
    const created = await call("PUT", `${path()}/thr_1`, { body: { user_id: "u1", title: "First", messages } });
    expect(created.status).toBe(200);
    expect(created.json).toMatchObject({ id: "thr_1", user_id: "u1", title: "First", message_count: 1 });

    // Saving without a title keeps the existing one.
    const reply = { id: "m2", role: "assistant", parts: [{ type: "text", text: "Hello" }] };
    const saved = await call("PUT", `${path()}/thr_1`, { body: { user_id: "u1", messages: [...messages, reply] } });
    expect(saved.json).toMatchObject({ title: "First", message_count: 2 });

    await call("PUT", `${path()}/thr_2`, { body: { user_id: "u1", messages: [] } });
    await call("PUT", `${path()}/thr_3`, { body: { user_id: "u2", messages: [] } });
    const list = await call("GET", `${path()}?user_id=u1`);
    expect(list.json.map((t: { id: string }) => t.id)).toEqual(["thr_2", "thr_1"]);
    expect(list.json[0].messages).toBeUndefined();

    const full = await call("GET", `${path()}/thr_1`);
    expect(full.json.messages).toEqual([...messages, reply]);

    expect((await call("PATCH", `${path()}/thr_1`, { body: { title: "  Renamed " } })).json.title).toBe("Renamed");
    expect((await call("DELETE", `${path()}/thr_2`)).json).toEqual({ deleted: true });
    expect((await call("GET", `${path()}/thr_2`)).status).toBe(404);
  });

  test("never changes owner and validates input", async () => {
    const taken = await call("PUT", `${path()}/thr_3`, { body: { user_id: "u1", messages: [] } });
    expect(taken.status).toBe(409);
    expect((await call("PUT", `${path()}/bad id`, { body: { user_id: "u1", messages: [] } })).status).toBe(400);
    expect((await call("PUT", `${path()}/thr_4`, { body: { user_id: "u1" } })).status).toBe(400);
    expect((await call("PUT", `${path()}/thr_4`, { body: { messages: [] } })).status).toBe(400);
  });
});

describe("cleanup", () => {
  test("deleting an app cascades", async () => {
    expect((await call("DELETE", `/apps/${appId}`, { key: apiKey })).json).toEqual({ deleted: true });
    const [{ n }] = await sql`
      select (select count(*) from plans) + (select count(*) from namespaces)
           + (select count(*) from usage_counters) + (select count(*) from usage_events)
           + (select count(*) from webhook_events) + (select count(*) from agent_threads) as n`;
    expect(Number(n)).toBe(0);
  });
});

describe("dashboard auth", () => {
  // The dashboard proxies these with the admin key and the browser's Origin.
  async function auth(method: string, path: string, opts: { cookie?: string; body?: unknown; key?: string | null } = {}) {
    const key = opts.key === undefined ? ADMIN : opts.key;
    const headers: Record<string, string> = { "Content-Type": "application/json", Origin: "http://localhost:6768" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (opts.cookie) headers.Cookie = opts.cookie;
    const res = await app.request(`/api/auth${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return { status: res.status, json: await res.json().catch(() => null), cookie: cookie || opts.cookie };
  }

  const password = "correct-horse-battery";

  test("needs the admin key", async () => {
    expect((await auth("GET", "/get-session", { key: null })).status).toBe(401);
    expect((await auth("GET", "/get-session", { key: apiKey })).status).toBe(401);
    expect((await auth("GET", "/get-session")).json).toBeNull();
  });

  test("sign up, workspaces, invitations and deleting a workspace", async () => {
    const owner = await auth("POST", "/sign-up/email", { body: { name: "Owner", email: "owner@example.com", password } });
    expect(owner.status).toBe(200);
    const session = await auth("GET", "/get-session", { cookie: owner.cookie });
    expect(session.json.user.email).toBe("owner@example.com");
    expect(session.json.session.activeOrganizationId).toBeNull();

    const ws = await auth("POST", "/organization/create", { cookie: owner.cookie, body: { name: "Acme", slug: "acme" } });
    expect(ws.status).toBe(200);
    const wsId: string = ws.json.id;
    // The dashboard keeps the workspace's apps in an org record with the same id.
    const wsApp = await call("POST", "/apps", { key: null, body: { name: "Workspace app" } });
    await call("POST", "/orgs", { body: { id: wsId, app_ids: [wsApp.json.id] } });

    // An invited email joins the workspace when it signs up.
    const invite = await auth("POST", "/organization/invite-member", {
      cookie: owner.cookie,
      body: { email: "Teammate@example.com", role: "member", organizationId: wsId },
    });
    expect(invite.status).toBe(200);
    const mate = await auth("POST", "/sign-up/email", { body: { name: "Mate", email: "teammate@example.com", password } });
    expect((await auth("GET", "/get-session", { cookie: mate.cookie })).json.session.activeOrganizationId).toBe(wsId);
    const orgs = await auth("GET", "/organization/list", { cookie: mate.cookie });
    expect(orgs.json.map((o: { id: string }) => o.id)).toEqual([wsId]);

    // New sessions start in the workspace that was active last.
    const again = await auth("POST", "/sign-in/email", { body: { email: "owner@example.com", password } });
    expect(again.status).toBe(200);
    expect((await auth("GET", "/get-session", { cookie: again.cookie })).json.session.activeOrganizationId).toBe(wsId);
    expect((await auth("POST", "/sign-in/email", { body: { email: "owner@example.com", password: "wrong-password" } })).status).toBe(401);

    // Deleting the workspace drops its org record and any apps still in it.
    const deleted = await auth("POST", "/organization/delete", { cookie: again.cookie, body: { organizationId: wsId } });
    expect(deleted.status).toBe(200);
    expect((await call("GET", `/orgs/${wsId}`)).status).toBe(404);
    expect((await call("GET", `/apps/${wsApp.json.id}`)).status).toBe(404);
  });
});
