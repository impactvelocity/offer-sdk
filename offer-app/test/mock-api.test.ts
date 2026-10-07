import { beforeAll, describe, expect, it } from "vitest";
import { handleMockRequest, MOCK_ADMIN_KEY } from "@/server/offer-api/mock/routes";

// The mock must behave like the hosted API (api/src) so the dashboard works against either.

async function call(method: string, path: string, body?: unknown, apiKey: string | null = MOCK_ADMIN_KEY) {
  const [pathname, search] = path.split("?");
  const res = await handleMockRequest({ method, path: pathname, query: new URLSearchParams(search), body, apiKey });
  return { status: res.status, body: await res.json() };
}

let app: { id: string; api_key: string; public_key: string };
const base = () => `/apps/${app.id}`;

beforeAll(async () => {
  app = (await call("POST", "/apps", { name: "Test app" }, null)).body;
  await call("POST", `${base()}/entitlements`, { id: "AI Credits", name: "AI credits", type: "usage" });
  await call("POST", `${base()}/entitlements`, { id: "sso", name: "SSO", type: "boolean" });
  await call("POST", `${base()}/addons`, { id: "boost", name: "Boost" });
  await call("POST", `${base()}/plans`, { id: "starter", name: "Starter" });
  await call("POST", `${base()}/plans/starter/entitlements`, { id: "ai_credits", max: 2 });
  await call("POST", `${base()}/incentives`, { id: "promo", name: "Promo" });
  await call("POST", `${base()}/incentives/promo/entitlements`, { id: "ai_credits", max: 10 });
  await call("POST", `${base()}/incentives/promo/entitlements`, { id: "sso" });
  await call("POST", `${base()}/incentives/promo/addons`, { id: "boost" });
});

describe("mock offer api", () => {
  it("creates apps with secret and public keys", () => {
    expect(app.id).toMatch(/^app_/);
    expect(app.api_key).toMatch(/^key_/);
    expect(app.public_key).toMatch(/^pub_/);
  });

  it("slugifies ids and rejects duplicates", async () => {
    const list = await call("GET", `${base()}/entitlements`);
    expect(list.body.map((e: { id: string }) => e.id)).toEqual(["ai_credits", "sso"]);
    const dupe = await call("POST", `${base()}/entitlements`, { id: "sso", name: "SSO", type: "boolean" });
    expect(dupe.status).toBe(409);
  });

  it("enforces key permissions like the hosted API", async () => {
    expect((await call("GET", `${base()}/plans`, undefined, null)).status).toBe(401);
    expect((await call("GET", `${base()}/plans`, undefined, app.api_key)).status).toBe(200);
    expect((await call("GET", `${base()}/plans`, undefined, app.public_key)).status).toBe(401);
    expect((await call("GET", `${base()}/plans/pricing`, undefined, app.public_key)).status).toBe(200);
    expect((await call("GET", "/orgs", undefined, app.api_key)).status).toBe(401);
  });

  it("stores max only for usage entitlements", async () => {
    await call("POST", `${base()}/plans/starter/entitlements`, { id: "sso", max: 5 });
    const plan = (await call("GET", `${base()}/plans/starter`)).body;
    expect(plan.entitlements).toEqual([{ id: "ai_credits", max: 2 }, { id: "sso" }]);
    await call("DELETE", `${base()}/plans/starter/entitlements/sso`);
  });

  it("requires an existing plan and drops unknown incentives on account create", async () => {
    expect((await call("POST", `${base()}/namespaces`, { id: "u0", name: "U0", plan: "nope" })).status).toBe(404);
    const created = await call("POST", `${base()}/namespaces`, { id: "u0", name: "U0", plan: "starter", incentive: "nope" });
    expect(created.status).toBe(201);
    expect(created.body.incentive).toBeNull();
  });

  it("resolves access with the incentive layered over the plan", async () => {
    await call("POST", `${base()}/namespaces`, { id: "u1", name: "User 1", plan: "starter" });
    const before = (await call("GET", `${base()}/namespaces/u1/plan`, undefined, app.public_key)).body;
    expect(before.entitlements).toEqual([
      expect.objectContaining({ id: "ai_credits", max: 2, usage: 0, left: 2, can: true }),
    ]);

    await call("PATCH", `${base()}/namespaces/u1`, { incentive: "promo" });
    const after = (await call("GET", `${base()}/namespaces/u1/plan`)).body;
    expect(after.incentive).toBe("promo");
    expect(after.addons).toEqual(["boost"]);
    expect(after.entitlements).toEqual([
      expect.objectContaining({ id: "ai_credits", max: 10 }),
      expect.objectContaining({ id: "sso", type: "boolean", max: null, can: true }),
    ]);
  });

  it("tracks usage without enforcing limits", async () => {
    await call("POST", `${base()}/namespaces`, { id: "u2", name: "User 2", plan: "starter" });
    await call("POST", `${base()}/namespaces/u2/usage/ai_credits/add`, undefined, app.public_key);
    const res = await call("POST", `${base()}/namespaces/u2/usage/ai_credits/amount`, { amount: 4 });
    expect(res.body).toEqual({ entitlement: "ai_credits", count: 5 });
    const plan = (await call("GET", `${base()}/namespaces/u2/plan`)).body;
    expect(plan.entitlements[0]).toMatchObject({ usage: 5, max: 2, left: 0, can: false });
    expect((await call("POST", `${base()}/namespaces/u2/usage/sso/add`)).status).toBe(400);
    expect((await call("POST", `${base()}/namespaces/u2/usage/ai_credits/amount`, { amount: 1.5 })).status).toBe(400);
  });

  it("aggregates usage events into analytics", async () => {
    const summary = (await call("GET", `${base()}/analytics?interval=7d`)).body;
    expect(summary).toContainEqual({ entitlement_id: "ai_credits", calls: 2, total_amount: 5 });
    const top = (await call("GET", `${base()}/analytics/top-namespaces?interval=7d&limit=5`)).body;
    expect(top[0]).toMatchObject({ namespace_id: "u2", calls: 2 });
    const series = (await call("GET", `${base()}/analytics/timeseries?interval=7d`)).body;
    expect(series).toEqual([
      expect.objectContaining({ entitlement_id: "ai_credits", calls: 2, total_amount: 5, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    ]);
    expect((await call("GET", `${base()}/analytics?interval=1d`)).status).toBe(400);
  });

  it("saves analytics reports", async () => {
    const reports = `${base()}/analytics/reports`;
    expect((await call("POST", reports, { name: " ", entitlements: [] })).status).toBe(400);
    expect((await call("POST", reports, { name: "AI", entitlements: "ai_credits" })).status).toBe(400);
    expect((await call("POST", reports, { name: "AI", interval: "1d" })).status).toBe(400);

    const created = await call("POST", reports, { name: " AI + SSO ", entitlements: ["ai_credits", "sso", "ai_credits"] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "AI + SSO", entitlements: ["ai_credits", "sso"], interval: "30d" });
    expect(created.body.id).toMatch(/^rpt_/);

    const patched = await call("PATCH", `${reports}/${created.body.id}`, { interval: "6m", id: "nope" });
    expect(patched.body).toMatchObject({ id: created.body.id, name: "AI + SSO", interval: "6m" });
    expect((await call("GET", reports)).body).toHaveLength(1);

    expect((await call("DELETE", `${reports}/${created.body.id}`)).body).toEqual({ deleted: true });
    expect((await call("GET", `${reports}/${created.body.id}`)).status).toBe(404);
  });

  it("filters and paginates account search", async () => {
    const all = (await call("GET", `${base()}/namespaces?q=user&per_page=1`)).body;
    expect(all).toMatchObject({ total: 2, per_page: 1 });
    expect(all.data[0]).toHaveProperty("namespace_id");
    const withPromo = (await call("GET", `${base()}/namespaces/with-incentive?incentive=promo`)).body;
    expect(withPromo.data.map((a: { id: string }) => a.id)).toEqual(["u1"]);
  });

  it("replaces plan meta wholesale on PATCH (top-level shallow merge)", async () => {
    await call("PATCH", `${base()}/plans/starter/meta`, { a: 1, b: 2 });
    const patched = (await call("PATCH", `${base()}/plans/starter`, { meta: { a: 1 } })).body;
    expect(patched.meta).toEqual({ a: 1 });
  });

  it("deletes the app and everything in it", async () => {
    const temp = (await call("POST", "/apps", { name: "Temp" }, null)).body;
    await call("POST", `/apps/${temp.id}/entitlements`, { id: "x", name: "X", type: "usage" });
    expect((await call("DELETE", `/apps/${temp.id}`)).body).toEqual({ deleted: true });
    expect((await call("GET", `/apps/${temp.id}`)).status).toBe(404);
  });
});

describe("mock webhooks", () => {
  type Received = { headers: Record<string, string | string[] | undefined>; body: string };
  const received: Received[] = [];
  let status = 200;
  let server: import("node:http").Server;
  let url: string;

  beforeAll(async () => {
    const { createServer } = await import("node:http");
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.statusCode = status;
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}/hook`;
    return () => server.close();
  });

  const until = async (check: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 100 && !(await check()); i++) await new Promise((r) => setTimeout(r, 10));
  };

  it("validates endpoints", async () => {
    expect((await call("POST", `${base()}/webhooks`, { url: "ftp://x", events: ["*"] })).status).toBe(400);
    expect((await call("POST", `${base()}/webhooks`, { url, events: [] })).body.error).toBe("events must be a non-empty array");
    expect((await call("POST", `${base()}/webhooks`, { url, events: ["nope"] })).body.error).toBe('Unknown event type "nope"');
    expect((await call("GET", `${base()}/webhooks`, undefined, app.public_key)).status).toBe(401);
  });

  it("delivers signed events to subscribed endpoints", async () => {
    const created = await call("POST", `${base()}/webhooks`, { url, events: ["account.plan_changed", "*"] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: expect.stringMatching(/^whk_/), events: ["*"], enabled: true, source: "custom" });
    const endpoint = created.body;

    await call("POST", `${base()}/plans`, { id: "pro", name: "Pro" });
    await call("POST", `${base()}/namespaces`, { id: "w1", name: "W1", plan: "starter" });
    await call("PATCH", `${base()}/namespaces/w1`, { plan: "pro" });
    await until(() => received.length >= 4);

    const types = received.map((r) => JSON.parse(r.body).type);
    expect(types).toEqual(["plan.created", "account.created", "account.updated", "account.plan_changed"]);

    const last = received.at(-1)!;
    const payload = JSON.parse(last.body);
    expect(payload.data).toMatchObject({ object: { id: "w1", plan: "pro" }, previous: { plan: "starter" } });
    expect(last.headers["user-agent"]).toBe("OfferSDK-Webhooks/1.0");
    expect(last.headers["webhook-id"]).toBe(payload.id);

    // Standard Webhooks signature: base64 HMAC-SHA256 of "id.timestamp.body" keyed by the decoded secret.
    const { createHmac } = await import("node:crypto");
    const expected = createHmac("sha256", Buffer.from(endpoint.secret.slice("whsec_".length), "base64"))
      .update(`${payload.id}.${last.headers["webhook-timestamp"]}.${last.body}`)
      .digest("base64");
    expect(last.headers["webhook-signature"]).toBe(`v1,${expected}`);

    const events = (await call("GET", `${base()}/events?type=account.plan_changed`)).body;
    expect(events[0]).toMatchObject({ type: "account.plan_changed", data: { object: { id: "w1" } } });

    const stats = (await call("GET", `${base()}/webhooks/${endpoint.id}`)).body.stats;
    expect(stats).toMatchObject({ total: 4, succeeded: 4, last_status: "succeeded", last_response_status: 200 });
    await call("DELETE", `${base()}/webhooks/${endpoint.id}`);
  });

  it("fires usage threshold events once per crossing", async () => {
    received.length = 0;
    const endpoint = (await call("POST", `${base()}/webhooks`, { url, events: ["usage.limit_warning", "usage.limit_reached"] })).body;
    await call("PATCH", `${base()}/plans/starter/entitlements/ai_credits`, { max: 10 });
    await call("POST", `${base()}/namespaces`, { id: "w2", name: "W2", plan: "starter" });
    await call("POST", `${base()}/namespaces/w2/usage/ai_credits/amount`, { amount: 7 });
    await call("POST", `${base()}/namespaces/w2/usage/ai_credits/amount`, { amount: 1 }); // 8 = 80%
    await call("POST", `${base()}/namespaces/w2/usage/ai_credits/add`); // 9
    await call("POST", `${base()}/namespaces/w2/usage/ai_credits/amount`, { amount: 3 }); // 12 >= 10
    await until(() => received.length >= 2);
    const bodies = received.map((r) => JSON.parse(r.body));
    expect(bodies.map((b) => b.type)).toEqual(["usage.limit_warning", "usage.limit_reached"]);
    expect(bodies[1].data.object).toMatchObject({ account_id: "w2", entitlement_id: "ai_credits", usage: 12, max: 10, left: 0 });
    await call("DELETE", `${base()}/webhooks/${endpoint.id}`);
  });

  it("schedules retries on failure and disables the endpoint on 410", async () => {
    const endpoint = (await call("POST", `${base()}/webhooks`, { url, events: ["account.created"] })).body;
    status = 500;
    const test = (await call("POST", `${base()}/webhooks/${endpoint.id}/test`, {})).body;
    expect(test).toMatchObject({ status: "failed", attempts: 1, response_status: 500, test: true, event_type: "account.created" });

    await call("POST", `${base()}/namespaces`, { id: "w3", name: "W3", plan: "starter" });
    let deliveries: { status: string; attempts: number; next_attempt_at: string | null; id: string }[] = [];
    await until(async () => {
      deliveries = (await call("GET", `${base()}/webhooks/${endpoint.id}/deliveries`)).body;
      return deliveries.some((d) => d.attempts === 1 && d.status === "pending");
    });
    const pending = deliveries.find((d) => d.status === "pending")!;
    expect(new Date(pending.next_attempt_at!).getTime()).toBeGreaterThan(Date.now() + 50_000);

    status = 200;
    const retried = (await call("POST", `${base()}/webhooks/${endpoint.id}/deliveries/${pending.id}/retry`)).body;
    expect(retried).toMatchObject({ status: "succeeded", attempts: 2 });

    status = 410;
    await call("POST", `${base()}/webhooks/${endpoint.id}/test`);
    const disabled = (await call("GET", `${base()}/webhooks/${endpoint.id}`)).body;
    expect(disabled).toMatchObject({ enabled: false, disabled_reason: "Endpoint returned 410 Gone" });
    expect(disabled.stats.total).toBe(1); // test deliveries aren't counted
    status = 200;
  });
});

describe("webhook url guard", () => {
  it("treats private, loopback and mapped addresses as private", async () => {
    const { isPrivateHost } = await import("@/server/offer-api/mock/webhooks");
    for (const host of ["localhost", "api.internal", "10.1.2.3", "172.20.0.1", "169.254.169.254", "[::1]", "[::ffff:7f00:1]", "[fd00::1]", "[fe80::1]"]) {
      expect(isPrivateHost(host), host).toBe(true);
    }
    for (const host of ["hooks.zapier.com", "8.8.8.8", "172.32.0.1", "[2606:4700::1111]"]) {
      expect(isPrivateHost(host), host).toBe(false);
    }
  });
});

describe("mock agent threads", () => {
  const path = () => `${base()}/agent/threads`;
  const messages = [{ id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] }];

  it("needs the admin key", async () => {
    expect((await call("GET", `${path()}?user_id=u1`, undefined, app.api_key)).status).toBe(401);
    expect((await call("GET", path())).status).toBe(400);
  });

  it("creates, saves, lists, renames and deletes threads per user", async () => {
    const created = await call("PUT", `${path()}/thr_1`, { user_id: "u1", title: "First", messages });
    expect(created.body).toMatchObject({ id: "thr_1", user_id: "u1", title: "First", message_count: 1 });
    expect(created.body.messages).toBeUndefined();

    const saved = await call("PUT", `${path()}/thr_1`, { user_id: "u1", messages: [...messages, ...messages] });
    expect(saved.body).toMatchObject({ title: "First", message_count: 2 });

    await call("PUT", `${path()}/thr_2`, { user_id: "u1", messages: [] });
    await call("PUT", `${path()}/thr_3`, { user_id: "u2", messages: [] });
    const list = await call("GET", `${path()}?user_id=u1`);
    expect(list.body.map((t: { id: string }) => t.id)).toEqual(["thr_2", "thr_1"]);

    expect((await call("GET", `${path()}/thr_1`)).body.messages).toHaveLength(2);
    expect((await call("PATCH", `${path()}/thr_1`, { title: " Renamed " })).body.title).toBe("Renamed");
    expect((await call("DELETE", `${path()}/thr_2`)).body).toEqual({ deleted: true });
    expect((await call("GET", `${path()}/thr_2`)).status).toBe(404);
  });

  it("never changes owner and validates input", async () => {
    expect((await call("PUT", `${path()}/thr_3`, { user_id: "u1", messages: [] })).status).toBe(409);
    expect((await call("PUT", `${path()}/bad%20id`, { user_id: "u1", messages: [] })).status).toBe(400);
    expect((await call("PUT", `${path()}/thr_4`, { user_id: "u1" })).status).toBe(400);
  });
});

describe("sample data", () => {
  it("creates a catalog, backdated accounts with usage history, and saved reports", async () => {
    const { addSampleData } = await import("@/server/offer-api");
    const sample = (await call("POST", "/apps", { name: "Sample" }, null)).body;
    await addSampleData(sample.id, "saas");

    expect((await call("GET", `/apps/${sample.id}/plans`)).body).toHaveLength(5);
    expect((await call("GET", `/apps/${sample.id}/namespaces/count`)).body.count).toBe(64);
    const events = await call("GET", `/apps/${sample.id}/analytics/events?limit=5`);
    expect(events.body).toHaveLength(5);
    expect((await call("GET", `/apps/${sample.id}/analytics/reports`)).body).toHaveLength(2);
  });
});
