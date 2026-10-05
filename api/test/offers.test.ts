// Offers, checkout and PayPal, end to end against a real Postgres and a fake
// PayPal REST API (PAYPAL_API_URL). Needs DATABASE_URL like api.test.ts.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

process.env.ADMIN_API_KEY = "test-admin-key";
// Lets the connection register a webhook, which signature checks need.
process.env.PUBLIC_API_URL = "https://api.example.com";

// ─── Fake PayPal ───────────────────────────────────────

type Sub = {
  id: string;
  status: string;
  plan_id: string;
  custom_id: string;
  setup_fee: { value: string; currency_code: string } | null;
  payments: number;
  pending_plan: string | null;
};
const pp = {
  plans: new Map<string, any>(),
  subs: new Map<string, Sub>(),
  orders: new Map<string, any>(),
  calls: [] as string[],
  seq: 0,
};
const nextId = (prefix: string) => `${prefix}-${++pp.seq}`;

// PayPal's billing_info.cycle_executions for a subscription with `payments` charges.
function billingInfo(sub: Sub) {
  const cycles: any[] = pp.plans.get(sub.plan_id)?.billing_cycles ?? [];
  let left = sub.payments;
  const cycle_executions = cycles.map((cycle) => {
    const done = cycle.total_cycles ? Math.min(left, cycle.total_cycles) : left;
    left -= done;
    return { tenure_type: cycle.tenure_type, sequence: cycle.sequence, total_cycles: cycle.total_cycles, cycles_completed: done };
  });
  return { cycle_executions, next_billing_time: new Date(Date.UTC(2026, 10 + sub.payments, 1)).toISOString() };
}

const subJson = (sub: Sub) => ({
  id: sub.id,
  status: sub.status,
  plan_id: sub.plan_id,
  custom_id: sub.custom_id,
  billing_info: billingInfo(sub),
});

const paypalServer = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const body: any = req.method === "POST" ? await req.text().then((t) => (t.startsWith("{") ? JSON.parse(t) : t)) : null;
    pp.calls.push(`${req.method} ${path}`);
    const json = (data: unknown, status = 200) => Response.json(data, { status });

    if (path === "/v1/oauth2/token") {
      const [id] = Buffer.from(req.headers.get("authorization")!.slice(6), "base64").toString().split(":");
      return id === "bad" ? json({ error: "invalid_client", error_description: "Client Authentication failed" }, 401) : json({ access_token: "tok", expires_in: 3600 });
    }
    if (path === "/v1/catalogs/products") return json({ id: nextId("PROD") }, 201);
    if (path === "/v1/billing/plans") {
      const id = nextId("P");
      pp.plans.set(id, body);
      return json({ id }, 201);
    }
    if (path === "/v1/notifications/webhooks") return json({ id: "WH-1" }, 201);
    if (path === "/v1/notifications/verify-webhook-signature") {
      return json({ verification_status: body.transmission_sig === "good" ? "SUCCESS" : "FAILURE" });
    }
    if (path === "/v1/billing/subscriptions" && req.method === "POST") {
      const id = nextId("I");
      pp.subs.set(id, {
        id,
        status: "APPROVAL_PENDING",
        plan_id: body.plan_id,
        custom_id: body.custom_id,
        setup_fee: body.plan?.payment_preferences?.setup_fee ?? null,
        payments: 0,
        pending_plan: null,
      });
      return json({ id, status: "APPROVAL_PENDING", links: [{ rel: "approve", href: `https://paypal.test/approve/${id}` }] }, 201);
    }
    let m = path.match(/^\/v1\/billing\/subscriptions\/([^/]+)(\/(revise|cancel))?$/);
    if (m) {
      const sub = pp.subs.get(m[1]);
      if (!sub) return json({ name: "RESOURCE_NOT_FOUND" }, 404);
      if (m[3] === "revise") {
        sub.pending_plan = body.plan_id;
        return json({ plan_id: body.plan_id, links: [{ rel: "approve", href: `https://paypal.test/revise/${sub.id}` }] });
      }
      if (m[3] === "cancel") {
        sub.status = "CANCELLED";
        return new Response(null, { status: 204 });
      }
      return json(subJson(sub));
    }
    if (path === "/v2/checkout/orders") {
      const id = nextId("O");
      pp.orders.set(id, { id, status: "CREATED", purchase_units: body.purchase_units });
      return json({ id, status: "CREATED", links: [{ rel: "approve", href: `https://paypal.test/checkout/${id}` }] }, 201);
    }
    m = path.match(/^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/);
    if (m) {
      const order = pp.orders.get(m[1]);
      if (m[2]) {
        if (order.status !== "APPROVED") return json({ name: "UNPROCESSABLE_ENTITY" }, 422);
        order.status = "COMPLETED";
      }
      return json(order);
    }
    return json({ name: "NOT_FOUND", path }, 404);
  },
});
process.env.PAYPAL_API_URL = `http://127.0.0.1:${paypalServer.port}`;

// Buyer actions on the fake PayPal.
const approveSubscription = (id: string) => {
  const sub = pp.subs.get(id)!;
  sub.status = "ACTIVE";
  sub.payments = 1;
};
const renew = (id: string) => void pp.subs.get(id)!.payments++;
const approveRevision = (id: string) => {
  const sub = pp.subs.get(id)!;
  sub.plan_id = sub.pending_plan!;
  sub.pending_plan = null;
};

// ─── API helpers ───────────────────────────────────────

const { default: app } = await import("../src/app.ts");
const { default: sql } = await import("../src/db/client.ts");
const { migrate } = await import("../src/db/migrate.ts");

const ADMIN = "test-admin-key";

async function call(method: string, path: string, opts: { key?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
  const key = opts.key === undefined ? ADMIN : opts.key;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await app.request(path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
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
let pub: string;
const a = (path: string) => `/apps/${appId}${path}`;

let eventSeq = 0;
const paypalWebhook = (event_type: string, resource: unknown, sig = "good") =>
  call("POST", `/paypal/webhooks/${appId}`, {
    key: null,
    headers: { "paypal-transmission-sig": sig, "paypal-transmission-id": "t", "paypal-auth-algo": "SHA256withRSA" },
    body: { id: `WH-EVT-${++eventSeq}`, event_type, resource },
  });

const eventTypes = async (): Promise<string[]> =>
  (await sql`select type from webhook_events where app_id = ${appId} order by created_at`).map((r: any) => r.type as string);

const fullPlan = async (account: string) => (await call("GET", a(`/namespaces/${account}/full-plan`), { key: pub })).json;

beforeAll(async () => {
  await migrate();
  const created = await call("POST", "/apps", { key: null, body: { name: "Scrapely" } });
  ({ id: appId, api_key: apiKey, public_key: pub } = created.json);

  const post = (path: string, body: unknown) => call("POST", a(path), { key: apiKey, body });
  await post("/entitlements", { id: "scrapes", name: "Scrapes", type: "usage" });
  await post("/entitlements", { id: "exports", name: "Exports", type: "boolean" });
  await post("/addons", { id: "welcome_call", name: "Welcome call" });
  await post("/addons", { id: "priority_support", name: "Priority support" });

  const plan = async (id: string, pricingCard: unknown, entitlements: unknown[], isFree = false) => {
    await post("/plans", { id, name: id[0].toUpperCase() + id.slice(1), pricingCard, isFree });
    for (const e of entitlements) await post(`/plans/${id}/entitlements`, e);
  };
  await plan("free", null, [{ id: "scrapes", max: 100 }], true);
  await plan("basic", { title: "Basic", type: "subscription", monthlyPrice: 20, yearlyPrice: 200, currency: "USD" }, [
    { id: "scrapes", max: 1000 },
    { id: "exports" },
  ]);
  await plan("pro", { title: "Pro", type: "subscription", monthlyPrice: 99, yearlyPrice: 990, currency: "USD", featured: true }, [
    { id: "scrapes", max: 10000 },
    { id: "exports" },
  ]);
  await plan("team", { title: "Team", type: "subscription", monthlyPrice: 199, currency: "USD" }, [{ id: "scrapes", max: 50000 }]);
  await plan("lifetime", { title: "Lifetime", type: "one_time", price: 299, currency: "USD" }, [{ id: "scrapes", max: 5000 }]);
  await plan("internal", null, [{ id: "scrapes", max: 1 }]);

  for (const id of ["acme", "globex", "initech"]) {
    await post("/namespaces", { id, name: id, plan: "free" });
  }
});

afterAll(() => {
  paypalServer.stop(true);
});

// ─── Tests ─────────────────────────────────────────────

describe("PayPal connection", () => {
  test("rejects bad credentials", async () => {
    const res = await call("PUT", a("/paypal"), { key: apiKey, body: { client_id: "bad", client_secret: "x" } });
    expect(res.status).toBe(400);
    expect(res.json.error).toContain("Client Authentication failed");
  });

  test("connects, registers the webhook and never returns the secret", async () => {
    const res = await call("PUT", a("/paypal"), { key: apiKey, body: { client_id: "client", client_secret: "s3cret", env: "sandbox" } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ connected: true, env: "sandbox", client_id: "client", webhook: "registered" });
    expect(JSON.stringify((await call("GET", a("/paypal"), { key: apiKey })).json)).not.toContain("s3cret");

    const [row] = await sql`select client_secret from paypal_connections where app_id = ${appId}`;
    expect(row.client_secret).not.toContain("s3cret");
  });

  test("needs the secret key", async () => {
    expect((await call("GET", a("/paypal"), { key: pub })).status).toBe(401);
  });
});

describe("offers", () => {
  test("validation", async () => {
    const create = (body: unknown) => call("POST", a("/offers"), { key: apiKey, body });
    expect((await create({ id: "x", plans: ["nope"] })).json.error).toBe('Plan "nope" not found');
    expect((await create({ id: "x", plans: ["internal"] })).json.error).toContain("has no price");
    expect((await create({ id: "x", plans: ["basic"], discount: { percent: 150 } })).status).toBe(400);
    expect(
      (await create({ id: "x", plans: ["basic"], bumps: [{ id: "call", label: "Call", price: { amount: 50 }, grant: { addons: ["nope"] } }] })).json.error,
    ).toBe('Addon "nope" not found');
    expect((await create({ id: "x", plans: [{ plan_id: "pro", entitlements: [{ id: "nope" }] }] })).json.error).toBe(
      'Entitlement "nope" not found',
    );
    expect((await create({ id: "x", plans: [{ plan_id: "pro", extras_for: "forever" }] })).status).toBe(400);
    expect((await create({ id: "default", plans: ["pro"] })).status).toBe(400);
  });

  test("create a multi-plan offer", async () => {
    const res = await call("POST", a("/offers"), {
      key: apiKey,
      body: {
        id: "5050",
        name: "Half off",
        copy: { headline: "Half off for 3 months" },
        discount: { percent: 50, cycles: 3 },
        intervals: ["month", "year"],
        plans: [
          { plan_id: "basic" },
          { plan_id: "pro", entitlements: [{ id: "scrapes", max: 12000 }], addons: ["priority_support"] },
          { plan_id: "team" },
        ],
        default_plan: "pro",
        bumps: [
          { id: "welcome_call", label: "1:1 welcome call", price: { amount: 50 }, grant: { addons: ["welcome_call"] }, applies_to: { plans: ["pro"] } },
          { id: "scrape_pack", label: "5,000 extra scrapes", price: { amount: 19 }, grant: { credits: { entitlement: "scrapes", amount: 5000 } } },
        ],
      },
    });
    expect(res.json.error).toBeUndefined();
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ id: "5050", status: "draft", type: "shareable", currency: "USD", source: "manual" });
    expect(res.json.plans[1]).toMatchObject({ plan_id: "pro", extras_for: "subscription" });
    expect((await call("GET", a("/offers"), { key: pub })).status).toBe(401);
  });

  test("a draft falls back to regular prices", async () => {
    const res = await call("GET", a("/offers/5050/public"), { key: pub });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ id: "default", resolved_from: "default", requested: { id: "5050", reason: "draft" } });
    expect(res.json.plans.map((p: any) => p.id)).toEqual(["basic", "pro", "team", "lifetime"]);
    expect(res.json.plans[1].prices.month).toEqual({ amount: 99, list_price: 99, cycles: null, then: null });
  });

  test("publish creates the PayPal billing plans", async () => {
    const before = pp.plans.size;
    const res = await call("POST", a("/offers/5050/publish"), { key: apiKey });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: "active", availability: "available", redemptions: 0 });
    // basic, pro and team monthly + basic and pro yearly (team has no yearly price).
    expect(pp.plans.size - before).toBe(5);
    const proMonthly = [...pp.plans.values()].find((p) => p.name === "Pro monthly · Half off");
    expect(proMonthly.billing_cycles).toMatchObject([
      { tenure_type: "TRIAL", total_cycles: 3, pricing_scheme: { fixed_price: { value: "49.50" } } },
      { tenure_type: "REGULAR", total_cycles: 0, pricing_scheme: { fixed_price: { value: "99.00" } } },
    ]);
    // Publishing again reuses them.
    await call("POST", a("/offers/5050/publish"), { key: apiKey });
    expect(pp.plans.size - before).toBe(5);
  });

  test("public view", async () => {
    const res = await call("GET", a("/offers/5050/public?ref=partner-x"), { key: pub });
    expect(res.json).toMatchObject({
      id: "5050",
      name: "Half off",
      resolved_from: "requested",
      requested: null,
      intervals: ["month", "year"],
      default_plan: "pro",
      default_interval: "month",
    });
    const pro = res.json.plans.find((p: any) => p.id === "pro");
    expect(pro.prices.month).toEqual({ amount: 49.5, list_price: 99, cycles: 3, then: 99 });
    expect(pro.extras).toEqual([{ id: "scrapes", name: "Scrapes", max: 12000 }]);
    expect(res.json.plans.find((p: any) => p.id === "team").prices).toEqual({
      month: { amount: 99.5, list_price: 199, cycles: 3, then: 199 },
    });
    expect(res.json.bumps[0]).toMatchObject({ id: "welcome_call", amount: 50, applies_to: { plans: ["pro"] } });
    expect(res.json).not.toHaveProperty("source");
    expect(res.json.paypal).toEqual({ client_id: "client", env: "sandbox" });
  });

  test("draft preview prices unsaved fields", async () => {
    const res = await call("POST", a("/offers/draft-preview"), {
      key: apiKey,
      body: { name: "Spring", plans: ["basic"], discount: { amount_off: 5 }, intervals: ["month"] },
    });
    expect(res.json).toMatchObject({ id: "draft", name: "Spring", intervals: ["month"] });
    expect(res.json.plans[0].prices.month).toEqual({ amount: 15, list_price: 20, cycles: null, then: null });
    expect((await call("POST", a("/offers/draft-preview"), { key: apiKey, body: { plans: [] } })).status).toBe(400);
  });

  test("preview shows what changes for an account", async () => {
    const res = await call("POST", a("/offers/5050/preview"), { key: apiKey, body: { account: "acme" } });
    const pro = res.json.plans.find((p: any) => p.plan_id === "pro");
    expect(pro.entitlements).toContainEqual({ id: "scrapes", name: "Scrapes", max: 12000, source: "offer" });
    expect(pro.changes).toContainEqual({ id: "scrapes", name: "Scrapes", from: 100, to: 12000 });
    expect(pro.addons).toEqual(["priority_support"]);
  });
});

let proCheckout: any;

describe("checkout", () => {
  test("validation", async () => {
    const start = (body: unknown) => call("POST", a("/offers/5050/checkout"), { key: pub, body });
    expect((await start({ plan: "pro", interval: "month" })).json.error).toBe("account or email is required");
    expect((await start({ plan: "basic", interval: "month", account: "acme", bumps: ["welcome_call"] })).json.error).toContain(
      "isn't available",
    );
    expect((await start({ plan: "lifetime", interval: "once", account: "acme" })).json.error).toContain("not in this offer");
    expect((await start({ plan: "team", interval: "year", account: "acme" })).json.error).toContain("no year price");
    expect((await start({ plan: "pro", interval: "month", account: "nobody" })).status).toBe(404);
  });

  test("starts a PayPal subscription with the bump as setup fee", async () => {
    const res = await call("POST", a("/offers/5050/checkout"), {
      key: pub,
      body: { plan: "pro", interval: "month", bumps: ["welcome_call"], account: "acme", ref: "partner-x" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      offer_id: "5050",
      plan_id: "pro",
      status: "created",
      total_today: 99.5,
      paypal: { kind: "subscription" },
    });
    expect(res.json.approve_url).toStartWith("https://paypal.test/approve/");
    proCheckout = res.json;

    const sub = pp.subs.get(res.json.paypal.id)!;
    expect(sub.setup_fee).toEqual({ value: "50.00", currency_code: "USD" });
    expect(sub.custom_id).toBe(res.json.id);
    expect(pp.plans.get(sub.plan_id).name).toBe("Pro monthly · Half off");
  });

  test("completing before approval leaves it pending", async () => {
    const res = await call("POST", a(`/checkouts/${proCheckout.id}/complete`), { key: pub });
    expect(res.json.status).toBe("created");
    expect((await fullPlan("acme")).plan.id).toBe("free");
  });

  test("approval grants the plan, the offer and the bump", async () => {
    approveSubscription(proCheckout.paypal.id);
    const res = await call("POST", a(`/checkouts/${proCheckout.id}/complete`), { key: pub });
    expect(res.json).toMatchObject({ status: "completed", account_id: "acme" });

    const account = (await call("GET", a("/namespaces/acme"), { key: apiKey })).json;
    expect(account.plan).toBe("pro");
    expect(account.addons).toEqual(["welcome_call"]);
    expect(account.subscription).toMatchObject({
      offer_id: "5050",
      offer_name: "Half off",
      plan_id: "pro",
      interval: "month",
      price: 49.5,
      list_price: 99,
      discounted_cycles_left: 2,
      renews_at_price: 49.5,
      status: "active",
      provider: "paypal",
      provider_id: proCheckout.paypal.id,
      ref: "partner-x",
    });

    const plan = await fullPlan("acme");
    expect(plan.offer).toBe("5050");
    expect(plan.plan.id).toBe("pro");
    expect(plan.entitlements.find((e: any) => e.id === "scrapes").max).toBe(12000);
    expect(plan.addons.sort()).toEqual(["priority_support", "welcome_call"]);

    const types = await eventTypes();
    expect(types).toContain("checkout.completed");
    expect(types).toContain("account.plan_changed");
    expect(types).toContain("account.addon_granted");
  });

  test("granting is idempotent", async () => {
    expect((await call("POST", a(`/checkouts/${proCheckout.id}/complete`), { key: pub })).json.status).toBe("completed");
    const res = await paypalWebhook("BILLING.SUBSCRIPTION.ACTIVATED", subJson(pp.subs.get(proCheckout.paypal.id)!));
    expect(res.status).toBe(200);
    expect((await eventTypes()).filter((t) => t === "checkout.completed")).toHaveLength(1);
  });

  test("an email-only checkout creates the account", async () => {
    const res = await call("POST", a("/offers/5050/checkout"), {
      key: pub,
      body: { plan: "basic", interval: "year", email: "new@buyer.test", bumps: ["scrape_pack"] },
    });
    expect(res.json.total_today).toBe(119); // 200 / 2 + 19
    approveSubscription(res.json.paypal.id);
    const done = await call("POST", a(`/checkouts/${res.json.id}/complete`), { key: pub });
    expect(done.json.account_id).toMatch(/^acct_/);

    const account = (await call("GET", a(`/namespaces/${done.json.account_id}`), { key: apiKey })).json;
    expect(account).toMatchObject({ name: "new@buyer.test", email: "new@buyer.test", plan: "basic" });
    // The scrape pack lowers the count by 5,000.
    const plan = await fullPlan(done.json.account_id);
    expect(plan.entitlements.find((e: any) => e.id === "scrapes")).toMatchObject({ usage: -5000, max: 1000, can: true });
  });

  test("one-time prices use a PayPal order", async () => {
    const res = await call("POST", a("/offers/default/checkout"), {
      key: pub,
      body: { plan: "lifetime", interval: "once", account: "initech" },
    });
    expect(res.json).toMatchObject({ offer_id: null, paypal: { kind: "order" }, total_today: 299 });
    expect(pp.orders.get(res.json.paypal.id).purchase_units[0].items[0]).toMatchObject({
      name: "Lifetime (lifetime)",
      unit_amount: { value: "299.00" },
    });

    expect((await call("POST", a(`/checkouts/${res.json.id}/complete`), { key: pub })).json.status).toBe("created");
    pp.orders.get(res.json.paypal.id).status = "APPROVED";
    expect((await call("POST", a(`/checkouts/${res.json.id}/complete`), { key: pub })).json.status).toBe("completed");
    expect(pp.orders.get(res.json.paypal.id).status).toBe("COMPLETED");

    const account = (await call("GET", a("/namespaces/initech"), { key: apiKey })).json;
    expect(account).toMatchObject({ plan: "lifetime", subscription: { interval: "once", offer_id: null, renews_at_price: null } });
    expect((await fullPlan("initech")).offer).toBeNull();
  });
});

describe("PayPal webhooks", () => {
  test("rejects bad signatures and non-events", async () => {
    expect((await paypalWebhook("BILLING.SUBSCRIPTION.ACTIVATED", {}, "bad")).status).toBe(400);
    const res = await call("POST", `/paypal/webhooks/${appId}`, { key: null, body: { hello: 1 } });
    expect(res.status).toBe(400);
  });

  test("handles each event once", async () => {
    const event = { id: "WH-DUP", event_type: "PAYMENT.SALE.COMPLETED", resource: { billing_agreement_id: proCheckout.paypal.id } };
    const send = () =>
      call("POST", `/paypal/webhooks/${appId}`, { key: null, headers: { "paypal-transmission-sig": "good" }, body: event });
    expect((await send()).json).toEqual({ ok: true });
    expect((await send()).json).toEqual({ ok: true, duplicate: true });
  });

  test("renewals count down the discounted cycles", async () => {
    renew(proCheckout.paypal.id);
    await paypalWebhook("PAYMENT.SALE.COMPLETED", { billing_agreement_id: proCheckout.paypal.id });
    let sub = (await call("GET", a("/namespaces/acme/subscription"), { key: apiKey })).json;
    expect(sub).toMatchObject({ discounted_cycles_left: 1, renews_at_price: 49.5, payments: 2 });
    expect(await eventTypes()).toContain("subscription.renewed");

    renew(proCheckout.paypal.id);
    await paypalWebhook("PAYMENT.SALE.COMPLETED", { billing_agreement_id: proCheckout.paypal.id });
    sub = (await call("GET", a("/namespaces/acme/subscription"), { key: apiKey })).json;
    expect(sub).toMatchObject({ discounted_cycles_left: 0, renews_at_price: 99 });
  });
});

describe("plan changes", () => {
  let subId: string;

  test("an upgrade inside the offer keeps its price and extras", async () => {
    const res = await call("POST", a("/offers/5050/checkout"), { key: pub, body: { plan: "basic", interval: "month", account: "globex" } });
    subId = res.json.paypal.id;
    approveSubscription(subId);
    await call("POST", a(`/checkouts/${res.json.id}/complete`), { key: pub });

    const change = await call("POST", a("/namespaces/globex/subscription/change"), { key: apiKey, body: { plan: "pro" } });
    expect(change.status).toBe(200);
    expect(change.json.approve_url).toStartWith("https://paypal.test/revise/");
    // Two discounted cycles were left, so the new plan gets two.
    expect(change.json.pending_change).toMatchObject({ plan_id: "pro", offer_id: "5050", price: 49.5, cycles: 2, apply_after: null });
    expect(pp.plans.get(pp.subs.get(subId)!.pending_plan!).billing_cycles[0]).toMatchObject({ tenure_type: "TRIAL", total_cycles: 2 });

    // Nothing changes until the buyer approves.
    await call("POST", a("/namespaces/globex/subscription/sync"), { key: apiKey });
    expect((await fullPlan("globex")).plan.id).toBe("basic");

    approveRevision(subId);
    await paypalWebhook("BILLING.SUBSCRIPTION.UPDATED", subJson(pp.subs.get(subId)!));
    const plan = await fullPlan("globex");
    expect(plan.plan.id).toBe("pro");
    expect(plan.offer).toBe("5050");
    expect(plan.entitlements.find((e: any) => e.id === "scrapes").max).toBe(12000);
    const sub = (await call("GET", a("/namespaces/globex/subscription"), { key: apiKey })).json;
    expect(sub).toMatchObject({ plan_id: "pro", price: 49.5, pending_change: null });
  });

  test("a downgrade waits for the renewal date", async () => {
    const change = await call("POST", a("/namespaces/globex/subscription/change"), { key: apiKey, body: { plan: "basic" } });
    expect(change.json.pending_change.apply_after).toBeTruthy();
    approveRevision(subId);
    await call("POST", a("/namespaces/globex/subscription/sync"), { key: apiKey });
    expect((await fullPlan("globex")).plan.id).toBe("pro");
  });

  test("a plan outside the offer is at list price and leaves the offer", async () => {
    const change = await call("POST", a("/namespaces/acme/subscription/change"), { key: apiKey, body: { plan: "lifetime" } });
    expect(change.status).toBe(400);
    const res = await call("POST", a("/namespaces/initech/subscription/change"), { key: apiKey, body: { plan: "pro" } });
    expect(res.status).toBe(409); // one-time purchase

    const other = await call("POST", a("/offers"), { key: apiKey, body: { id: "pro_only", plans: ["pro"], discount: { percent: 10 } } });
    expect(other.status).toBe(201);
    await call("POST", a("/offers/pro_only/publish"), { key: apiKey });
    const ckt = await call("POST", a("/offers/pro_only/checkout"), { key: pub, body: { plan: "pro", interval: "month", email: "x@y.test" } });
    approveSubscription(ckt.json.paypal.id);
    const done = await call("POST", a(`/checkouts/${ckt.json.id}/complete`), { key: pub });
    const change2 = await call("POST", a(`/namespaces/${done.json.account_id}/subscription/change`), { key: apiKey, body: { plan: "team" } });
    expect(change2.json.pending_change).toMatchObject({ plan_id: "team", offer_id: null, price: 199, cycles: null, extras: null });
  });

  test("cancelling moves to the free plan and keeps one-time add-ons", async () => {
    const res = await call("POST", a("/namespaces/acme/subscription/cancel"), { key: apiKey, body: { reason: "Too expensive" } });
    expect(res.json.status).toBe("cancelled");
    const plan = await fullPlan("acme");
    expect(plan.plan.id).toBe("free");
    expect(plan.offer).toBeNull();
    expect(plan.addons).toEqual(["welcome_call"]);
    expect(await eventTypes()).toContain("subscription.cancelled");
  });
});

describe("availability", () => {
  test("sold out, expired and targeted offers", async () => {
    await call("POST", a("/offers"), { key: apiKey, body: { id: "one_only", plans: ["basic"], max_redemptions: 1 } });
    await call("POST", a("/offers/one_only/publish"), { key: apiKey });
    const first = await call("POST", a("/offers/one_only/checkout"), { key: pub, body: { plan: "basic", interval: "month", email: "a@b.test" } });
    approveSubscription(first.json.paypal.id);
    await call("POST", a(`/checkouts/${first.json.id}/complete`), { key: pub });
    const second = await call("POST", a("/offers/one_only/checkout"), { key: pub, body: { plan: "basic", interval: "month", email: "c@d.test" } });
    expect(second.status).toBe(409);
    expect(second.json.reason).toBe("sold_out");

    await call("PATCH", a("/offers/one_only"), { key: apiKey, body: { max_redemptions: null, expires_at: "2020-01-01T00:00:00Z" } });
    const expired = await call("GET", a("/offers/one_only/public?fallback=5050"), { key: pub });
    expect(expired.json).toMatchObject({ id: "5050", resolved_from: "fallback", requested: { id: "one_only", reason: "expired" } });

    const targeted = await call("POST", a("/offers"), {
      key: apiKey,
      body: { type: "targeted", account_id: "globex", plans: ["team"], discount: { percent: 20 } },
    });
    expect(targeted.json.id).toMatch(/^off_/);
    await call("POST", a(`/offers/${targeted.json.id}/publish`), { key: apiKey });
    expect((await call("GET", a(`/offers/${targeted.json.id}/public?account=acme`), { key: pub })).json.requested.reason).toBe("not_eligible");
    expect((await call("GET", a(`/offers/${targeted.json.id}/public?account=globex`), { key: pub })).json.resolved_from).toBe("requested");
    const wrong = await call("POST", a(`/offers/${targeted.json.id}/checkout`), { key: pub, body: { plan: "team", interval: "month", account: "acme" } });
    expect(wrong.json.reason).toBe("not_eligible");
  });

  test("archived offers stop selling", async () => {
    await call("POST", a("/offers/pro_only/archive"), { key: apiKey });
    expect((await call("GET", a("/offers/pro_only/public"), { key: pub })).json.requested.reason).toBe("archived");
  });
});

describe("reporting", () => {
  test("stats by plan, ref and bump", async () => {
    const res = await call("GET", a("/offers/5050/stats"), { key: apiKey });
    expect(res.json.views).toBeGreaterThanOrEqual(1);
    expect(res.json.completed).toBe(3);
    expect(res.json.revenue).toBe(99.5 + 119 + 10);
    expect(res.json.by_ref).toContainEqual({ ref: "partner-x", checkouts: 1, completed: 1, revenue: 99.5 });
    expect(res.json.bumps).toContainEqual({ id: "welcome_call", taken: 1, rate: 1 / 3 });
  });

  test("accounts by offer", async () => {
    const res = await call("GET", a("/namespaces?offer=5050"), { key: apiKey });
    expect(res.json.data.map((n: any) => n.id).sort()).toEqual(["globex", expect.stringMatching(/^acct_/)].sort());
  });

  test("checkout list", async () => {
    const res = await call("GET", a("/checkouts?offer=5050&status=completed"), { key: apiKey });
    expect(res.json).toHaveLength(3);
    expect((await call("GET", a("/checkouts"), { key: pub })).status).toBe(401);
  });
});

describe("accounts", () => {
  test("account add-ons", async () => {
    let res = await call("POST", a("/namespaces/globex/addons"), { key: apiKey, body: { id: "welcome_call" } });
    expect(res.json.addons).toEqual(["welcome_call"]);
    expect((await call("POST", a("/namespaces/globex/addons"), { key: apiKey, body: { id: "nope" } })).status).toBe(404);
    res = await call("DELETE", a("/namespaces/globex/addons/welcome_call"), { key: apiKey });
    expect(res.json.addons).toEqual([]);
  });

  test("an expired incentive no longer applies", async () => {
    await call("POST", a("/incentives"), { key: apiKey, body: { id: "boost", entitlements: [{ id: "scrapes", max: 99999 }] } });
    await call("PATCH", a("/namespaces/initech"), { key: apiKey, body: { incentive: "boost" } });
    expect((await fullPlan("initech")).entitlements.find((e: any) => e.id === "scrapes").max).toBe(99999);
    await call("PATCH", a("/namespaces/initech"), { key: apiKey, body: { incentive_expires_at: "2020-01-01T00:00:00Z" } });
    const plan = await fullPlan("initech");
    expect(plan.incentive).toBeNull();
    expect(plan.entitlements.find((e: any) => e.id === "scrapes").max).toBe(5000);
  });
});

describe("usage limits", () => {
  const add = (account: string, amount: number) =>
    call("POST", a(`/namespaces/${account}/usage/scrapes/amount`), { key: pub, body: { amount } });
  const approveFromLink = (url: string) => approveSubscription(url.split("/").pop()!);

  test("overage must be allow or block", async () => {
    const res = await call("PATCH", a("/entitlements/scrapes"), { key: apiKey, body: { overage: { mode: "nope" } } });
    expect(res.status).toBe(400);
  });

  test("allow keeps counting past the limit", async () => {
    await call("POST", a("/namespaces"), { key: apiKey, body: { id: "hooli", name: "Hooli", plan: "free" } });
    expect((await add("hooli", 150)).json.count).toBe(150);
    await add("hooli", -150);
  });

  test("block answers 402 with an upgrade an agent can show", async () => {
    await call("PATCH", a("/entitlements/scrapes"), { key: apiKey, body: { overage: { mode: "block" } } });
    expect((await add("hooli", 100)).json.count).toBe(100);

    const res = await add("hooli", 1);
    expect(res.status).toBe(402);
    expect(res.json).toMatchObject({
      error: "limit_reached",
      entitlement: { id: "scrapes", name: "Scrapes", usage: 100, max: 100 },
      offer: { id: "default", name: null, plan: { id: "basic", name: "Basic" }, interval: "month", price: 20, new_limit: 1000 },
      retry_after_purchase: true,
    });
    expect(res.json.offer.checkout_url).toStartWith("https://paypal.test/approve/");
    expect(res.json.message).toBe(
      `You've used 100 of 100 Scrapes on the Free plan. Basic includes 1,000 Scrapes for $20/month. Upgrade here: ${res.json.offer.checkout_url}`,
    );

    // The open checkout's link is reused, and nothing was counted.
    const again = await add("hooli", 1);
    expect(again.json.offer.checkout_url).toBe(res.json.offer.checkout_url);
    expect((await fullPlan("hooli")).entitlements.find((e: any) => e.id === "scrapes").usage).toBe(100);
    // Lowering usage is never blocked.
    expect((await add("hooli", -1)).status).toBe(200);
    await add("hooli", 1);
  });

  test("the entitlement's offer is used when the account can buy it", async () => {
    await call("PATCH", a("/entitlements/scrapes"), { key: apiKey, body: { overage: { mode: "block", offer_id: "5050" } } });
    const res = await add("hooli", 1);
    expect(res.json.offer).toMatchObject({ id: "5050", name: "Half off", plan: { id: "basic" }, price: 10, list_price: 20, cycles: 3 });
    expect(res.json.message).toContain("Basic includes 1,000 Scrapes for $10/month for 3 months, then $20/month.");

    // Paying through the link lets the retry through, even before PayPal's webhook.
    approveFromLink(res.json.offer.checkout_url);
    const retry = await add("hooli", 1);
    expect(retry.status).toBe(200);
    expect(retry.json.count).toBe(101);
    expect((await fullPlan("hooli")).offer).toBe("5050");
  });

  test("links go to the app's own checkout page when it has one", async () => {
    await call("PATCH", a(""), { key: apiKey, body: { checkout_url: "https://scrapely.test/checkout" } });
    await call("POST", a("/namespaces"), { key: apiKey, body: { id: "piedpiper", name: "Pied Piper", plan: "free" } });
    await add("piedpiper", 100);
    const res = await add("piedpiper", 1);
    expect(res.json.offer.checkout_url).toBe(
      "https://scrapely.test/checkout?offer=5050&plan=basic&interval=month&account=piedpiper",
    );
  });

  test("no higher plan means no offer", async () => {
    await call("PATCH", a("/namespaces/hooli"), { key: apiKey, body: { plan: "team" } });
    await add("hooli", 50000 - 101);
    const res = await add("hooli", 1);
    expect(res.status).toBe(402);
    expect(res.json).toMatchObject({ offer: null, retry_after_purchase: false });
    expect(res.json.message).toContain("There is no plan with a higher limit");
  });
});
