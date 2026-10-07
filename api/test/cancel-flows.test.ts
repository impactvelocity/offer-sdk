// Cancel flows end to end: account tokens, flows, sessions, save offers and
// pauses, against a real Postgres and a fake PayPal. Needs DATABASE_URL like
// api.test.ts.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

process.env.ADMIN_API_KEY = "test-admin-key";
delete process.env.ANTHROPIC_API_KEY; // dynamic offers fall back to static ones
delete process.env.RENDER_API_KEY; // pauses apply inline

// ─── Fake PayPal ───────────────────────────────────────

const pp = { calls: [] as string[], subs: new Map<string, { status: string; plan_id: string }>(), seq: 0 };

const paypalServer = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const body: any = req.method === "POST" ? await req.text().then((t) => (t.startsWith("{") ? JSON.parse(t) : t)) : null;
    pp.calls.push(`${req.method} ${path}`);
    const json = (data: unknown, status = 200) => Response.json(data, { status });

    if (path === "/v1/oauth2/token") return json({ access_token: "tok", expires_in: 3600 });
    if (path === "/v1/catalogs/products") return json({ id: `PROD-${++pp.seq}` }, 201);
    if (path === "/v1/billing/plans") return json({ id: `P-${++pp.seq}` }, 201);
    const m = path.match(/^\/v1\/billing\/subscriptions\/([^/]+)(\/(revise|cancel|suspend|activate))?$/);
    if (m) {
      const sub = pp.subs.get(m[1]) ?? { status: "ACTIVE", plan_id: "P-0" };
      pp.subs.set(m[1], sub);
      if (m[3] === "revise") return json({ plan_id: body.plan_id, links: [{ rel: "approve", href: `https://paypal.test/revise/${m[1]}` }] });
      if (m[3] === "cancel") sub.status = "CANCELLED";
      if (m[3] === "suspend") sub.status = "SUSPENDED";
      if (m[3] === "activate") sub.status = "ACTIVE";
      if (m[3]) return new Response(null, { status: 204 });
      return json({ id: m[1], status: sub.status, plan_id: sub.plan_id, billing_info: { cycle_executions: [], next_billing_time: "2026-12-01T00:00:00Z" } });
    }
    return json({ name: "NOT_FOUND", path }, 404);
  },
});
process.env.PAYPAL_API_URL = `http://127.0.0.1:${paypalServer.port}`;

// ─── API helpers ───────────────────────────────────────

const { default: app } = await import("../src/app.ts");
const { default: sql } = await import("../src/db/client.ts");
const { migrate } = await import("../src/db/migrate.ts");

async function call(method: string, path: string, opts: { key?: string | null; body?: unknown } = {}) {
  const key = opts.key === undefined ? "test-admin-key" : opts.key;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
const secret = (method: string, path: string, body?: unknown) => call(method, a(path), { key: apiKey, body });

const eventTypes = async (): Promise<string[]> =>
  (await sql`select type from webhook_events where app_id = ${appId} order by created_at`).map((r: any) => r.type as string);

let subSeq = 0;
// An account paying for `plan` through a PayPal subscription.
async function subscriber(id: string, plan = "pro", price = 99) {
  await secret("POST", "/namespaces", { id, name: id, plan });
  await secret("PATCH", `/namespaces/${id}`, {
    subscription: {
      offer_id: null,
      plan_id: plan,
      interval: "month",
      currency: "USD",
      price,
      list_price: price,
      cycles: null,
      discounted_cycles_left: 0,
      renews_at: "2026-12-01T00:00:00.000Z",
      renews_at_price: price,
      status: "active",
      provider: "paypal",
      provider_id: `I-SUB${++subSeq}`,
      payments: 4,
    },
  });
  return id;
}

async function tokenFor(account: string) {
  const res = await secret("POST", `/namespaces/${account}/token`);
  expect(res.status).toBe(201);
  return res.json.token as string;
}

// Starts a session with an account token; returns a caller bound to it.
async function start(account: string) {
  const token = await tokenFor(account);
  const res = await call("POST", a("/cancel-sessions"), { key: token, body: {} });
  expect(res.status).toBe(201);
  const id = res.json.id as string;
  const act = (action: string, body: unknown = {}) => call("POST", a(`/cancel-sessions/${id}/${action}`), { key: token, body });
  return { token, id, first: res.json, act };
}

beforeAll(async () => {
  await migrate();
  const created = await call("POST", "/apps", { key: null, body: { name: "Scrapely" } });
  ({ id: appId, api_key: apiKey, public_key: pub } = created.json);

  await secret("POST", "/entitlements", { id: "scrapes", name: "Scrapes", type: "usage" });
  const plan = async (id: string, pricingCard: unknown, max: number, isFree = false) => {
    await secret("POST", "/plans", { id, name: id[0].toUpperCase() + id.slice(1), pricingCard, isFree });
    await secret("POST", `/plans/${id}/entitlements`, { id: "scrapes", max });
  };
  await plan("free", null, 100, true);
  await plan("basic", { title: "Basic", type: "subscription", monthlyPrice: 20, yearlyPrice: 200, currency: "USD" }, 1000);
  await plan("pro", { title: "Pro", type: "subscription", monthlyPrice: 99, yearlyPrice: 990, currency: "USD" }, 10000);
  await secret("POST", "/incentives", { id: "double", name: "Double scrapes", description: "2x your scrape limit", entitlements: [{ id: "scrapes", max: 20000 }] });
  await secret("PUT", "/paypal", { client_id: "cid", client_secret: "secret", env: "sandbox" });
});

afterAll(() => {
  paypalServer.stop(true);
});

// ─── Account tokens ────────────────────────────────────

describe("account tokens", () => {
  test("only a secret key can mint one", async () => {
    await secret("POST", "/namespaces", { id: "tok_user", name: "Tok", plan: "free" });
    expect((await call("POST", a("/namespaces/tok_user/token"), { key: pub })).status).toBe(401);
    expect((await secret("POST", "/namespaces/nobody/token")).status).toBe(404);
    expect((await secret("POST", "/namespaces/tok_user/token", { ttl_seconds: 10 })).status).toBe(400);
    const res = await secret("POST", "/namespaces/tok_user/token", { ttl_seconds: 600 });
    expect(res.status).toBe(201);
    expect(res.json.token).toStartWith("act_");
    expect(new Date(res.json.expires_at).getTime()).toBeGreaterThan(Date.now() + 590_000);
  });

  test("acts for its own account only", async () => {
    await secret("POST", "/namespaces", { id: "tok_other", name: "Other", plan: "free" });
    const token = await tokenFor("tok_user");
    expect((await call("GET", a("/namespaces/tok_user/full-plan"), { key: token })).status).toBe(200);
    expect((await call("GET", a("/namespaces/tok_other/full-plan"), { key: token })).status).toBe(401);
    expect((await call("GET", a("/namespaces"), { key: token })).status).toBe(401);
    expect((await call("GET", a("/cancel-flows"), { key: token })).status).toBe(401);
    expect((await call("POST", a("/namespaces/tok_user/subscription/cancel"), { key: token })).status).toBe(401);
    expect((await call("GET", a("/cancel-sessions"), { key: token })).status).toBe(401);
  });

  test("forged, tampered and foreign tokens are refused", async () => {
    const token = await tokenFor("tok_user");
    const [payload, sig] = token.slice(4).split(".");
    const forged = Buffer.from(JSON.stringify({ a: appId, n: "tok_other", e: 9999999999 })).toString("base64url");
    expect((await call("GET", a("/namespaces/tok_other/plan"), { key: `act_${forged}.${sig}` })).status).toBe(401);
    expect((await call("GET", a("/namespaces/tok_user/plan"), { key: `act_${payload}.x${sig}` })).status).toBe(401);
    const otherApp = (await call("POST", "/apps", { key: null, body: { name: "Other" } })).json;
    expect((await call("GET", `/apps/${otherApp.id}/namespaces/tok_user/plan`, { key: token })).status).toBe(401);
  });

  test("rotating the secret key revokes tokens", async () => {
    const rotated = (await call("POST", "/apps", { key: null, body: { name: "Rotating" } })).json;
    await call("POST", `/apps/${rotated.id}/plans`, { key: rotated.api_key, body: { id: "x", name: "X" } });
    await call("POST", `/apps/${rotated.id}/namespaces`, { key: rotated.api_key, body: { id: "u1", name: "u1", plan: "x" } });
    const { token } = (await call("POST", `/apps/${rotated.id}/namespaces/u1/token`, { key: rotated.api_key })).json;
    await call("POST", `/apps/${rotated.id}/keys/regenerate`, { key: rotated.api_key });
    expect((await call("POST", `/apps/${rotated.id}/cancel-sessions`, { key: token, body: {} })).status).toBe(401);
  });
});

// ─── Flows ─────────────────────────────────────────────

describe("cancel flows", () => {
  test("new flows start from the template as drafts", async () => {
    const res = await secret("POST", "/cancel-flows", {});
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ id: "default", status: "draft", name: "Cancel flow" });
    expect(res.json.steps.map((s: any) => s.type)).toEqual(["question", "offer", "confirm"]);
    expect((await secret("POST", "/cancel-flows", {})).status).toBe(409);
  });

  test("steps are validated", async () => {
    const bad = async (steps: unknown) => (await secret("PATCH", "/cancel-flows/default", { steps })).json.error;
    expect(await bad([])).toContain("non-empty");
    expect(await bad([{ id: "q", type: "question", title: "Why?", answers: [{ id: "a", label: "A", next: "nope" }, { id: "b", label: "B" }] }, { id: "c", type: "confirm", title: "Sure?" }])).toContain('unknown step "nope"');
    expect(await bad([{ id: "c", type: "confirm", title: "Sure?" }, { id: "d", type: "confirm", title: "Really?" }])).toContain("exactly one confirm");
    expect(await bad([{ id: "o", type: "offer", default: { kind: "downgrade", plan: "ghost" } }, { id: "c", type: "confirm", title: "Sure?" }])).toContain('plan "ghost" not found');
    expect(await bad([{ id: "o", type: "offer", default: { kind: "discount", percent: 95, cycles: 1 } }, { id: "c", type: "confirm", title: "Sure?" }])).toContain("percent");
    expect(await bad([{ id: "o", type: "offer", guardrails: { kinds: ["bribe"] } }, { id: "c", type: "confirm", title: "Sure?" }])).toContain("kinds");
  });

  test("customers can't open a draft flow", async () => {
    await secret("POST", "/namespaces", { id: "draft_user", name: "d", plan: "free" });
    const token = await tokenFor("draft_user");
    expect((await call("POST", a("/cancel-sessions"), { key: token, body: {} })).status).toBe(404);
    expect((await call("POST", a("/cancel-sessions"), { key: token, body: { flow: "default" } })).status).toBe(404);
    // The dashboard can preview it with a secret key.
    expect((await secret("POST", "/cancel-sessions", { account: "draft_user", flow: "default" })).status).toBe(201);
  });

  test("activate, with an incentive offer for missing features", async () => {
    const flow = (await secret("GET", "/cancel-flows/default")).json;
    const steps = flow.steps.map((s: any) =>
      s.type === "offer" ? { ...s, dynamic: true, by_answer: { ...s.by_answer, missing_feature: { kind: "incentive", incentive: "double", months: 2 } } } : s,
    );
    const res = await secret("PATCH", "/cancel-flows/default", { status: "active", steps });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe("active");
    expect(res.json.capabilities).toEqual({ dynamic_offers: false, pause_workflows: false });
  });
});

// ─── Sessions ──────────────────────────────────────────

describe("cancel sessions", () => {
  test("too expensive → discount offer → approve on PayPal", async () => {
    await subscriber("price_user");
    const s = await start("price_user");
    expect(s.first.step).toMatchObject({ id: "reason", type: "question" });
    expect(s.first.step.answers).toHaveLength(6);
    expect(s.first.offer).toBeNull();

    expect((await s.act("answer", { step: "save", answer: "too_expensive" })).status).toBe(409);
    expect((await s.act("answer", { step: "reason", answer: "made_up" })).status).toBe(400);
    const offered = await s.act("answer", { step: "reason", answer: "too_expensive" });
    expect(offered.json.step).toMatchObject({ id: "save", type: "offer" });
    // Dynamic is on but there's no ANTHROPIC_API_KEY, so the static offer shows.
    expect(offered.json.offer).toMatchObject({
      kind: "discount",
      source: "static",
      details: { percent: 30, cycles: 3, price: 69.3, regular_price: 99 },
      status: "shown",
    });
    expect(offered.json.offer.reasoning).toBeUndefined();

    const declined = await s.act("decline");
    expect(declined.json.step.type).toBe("confirm");
    expect(declined.json.offer).toBeNull();
    const back = await s.act("back");
    expect(back.json.offer.status).toBe("shown");

    const accepted = await s.act("accept", { return_url: "https://scrapely.test/account" });
    expect(accepted.status).toBe(200);
    expect(accepted.json).toMatchObject({ status: "saved", step: null, approve_url: `https://paypal.test/revise/I-SUB1` });
    expect(accepted.json.offer.status).toBe("accepted");
    expect((await s.act("cancel")).status).toBe(409);

    const account = (await secret("GET", "/namespaces/price_user")).json;
    expect(account.subscription.pending_change).toMatchObject({ plan_id: "pro", price: 69.3, list_price: 99, cycles: 3, discount: { percent: 30, cycles: 3 } });
    expect(await eventTypes()).toContain("cancel_flow.saved");

    const admin = (await secret("GET", `/cancel-sessions/${s.id}`)).json;
    expect(admin.session).toMatchObject({ status: "saved", decide: { used: false, skipped: "ANTHROPIC_API_KEY is not set" } });
    expect(admin.session.answers).toEqual([
      { step: "reason", step_title: "Why are you cancelling?", answer: "too_expensive", label: "It's too expensive", text: null },
    ]);
  });

  test("not using it → pause → resumes on its own", async () => {
    await subscriber("pause_user");
    const s = await start("pause_user");
    const offered = await s.act("answer", { step: "reason", answer: "not_using" });
    expect(offered.json.offer).toMatchObject({ kind: "pause", details: { months: 2 } });
    pp.calls.length = 0;
    const accepted = await s.act("accept");
    expect(accepted.json.result).toMatchObject({ outcome: "saved", mode: "inline", months: 2 });
    expect(pp.calls).toContain("POST /v1/billing/subscriptions/I-SUB2/suspend");

    let account = (await secret("GET", "/namespaces/pause_user")).json;
    expect(account.plan).toBe("free");
    expect(account.subscription).toMatchObject({ status: "suspended", pause: { months: 2, resume_plan: "pro", session_id: s.id } });
    expect(await eventTypes()).toContain("subscription.paused");

    // Nothing is due yet; backdate the pause and the workflow endpoint finds it.
    expect((await call("GET", "/pauses/due")).json.some((d: any) => d.account_id === "pause_user")).toBe(false);
    await sql`
      update namespaces set data = jsonb_set(data, '{subscription,pause,resume_at}', '"2020-01-01T00:00:00.000Z"')
      where app_id = ${appId} and id = 'pause_user'`;
    expect((await call("GET", "/pauses/due")).json).toContainEqual({ app_id: appId, account_id: "pause_user", resume_at: "2020-01-01T00:00:00.000Z" });
    expect((await call("GET", "/pauses/due", { key: apiKey })).status).toBe(401);

    const resumed = await call("POST", "/pauses/resume", { body: { app_id: appId, account_id: "pause_user" } });
    expect(resumed.status).toBe(200);
    expect(pp.calls).toContain("POST /v1/billing/subscriptions/I-SUB2/activate");
    account = (await secret("GET", "/namespaces/pause_user")).json;
    expect(account.plan).toBe("pro");
    expect(account.subscription.status).toBe("active");
    expect(account.subscription.pause).toBeUndefined();
    expect(account.subscription.last_pause.resumed_at).toBeTruthy();
    expect(await eventTypes()).toContain("subscription.resumed");
  });

  test("missing feature → incentive applies at once", async () => {
    await subscriber("feature_user");
    const s = await start("feature_user");
    const offered = await s.act("answer", { step: "reason", answer: "missing_feature", text: "  Needs JS rendering  " });
    expect(offered.json.offer).toMatchObject({ kind: "incentive", details: { incentive: "double", incentive_name: "Double scrapes", months: 2 } });
    await s.act("accept");
    const plan = (await call("GET", a("/namespaces/feature_user/full-plan"), { key: s.token })).json;
    expect(plan.incentive).toBe("double");
    expect(plan.entitlements.find((e: any) => e.id === "scrapes").max).toBe(20000);
    const session = (await secret("GET", `/cancel-sessions/${s.id}`)).json.session;
    expect(session.answers[0].text).toBe("Needs JS rendering");
  });

  test("switching → no offer → cancels in PayPal", async () => {
    await subscriber("leaver");
    const s = await start("leaver");
    const res = await s.act("answer", { step: "reason", answer: "switching" });
    expect(res.json.step.type).toBe("confirm");
    expect(res.json.offer).toBeNull();
    pp.calls.length = 0;
    const cancelled = await s.act("cancel");
    expect(cancelled.json).toMatchObject({ status: "cancelled", result: { outcome: "cancelled", billing: "paypal" } });
    expect(pp.calls[0]).toBe("POST /v1/billing/subscriptions/I-SUB4/cancel");
    const account = (await secret("GET", "/namespaces/leaver")).json;
    expect(account.plan).toBe("free");
    expect(account.subscription.status).toBe("cancelled");
    const types = await eventTypes();
    expect(types).toContain("cancel_flow.cancelled");
    expect(types).toContain("subscription.cancelled");
  });

  test("accounts billed elsewhere skip PayPal offers and only get the webhook", async () => {
    await secret("POST", "/namespaces", { id: "stripe_user", name: "s", plan: "pro" });
    const s = await start("stripe_user");
    const res = await s.act("answer", { step: "reason", answer: "too_expensive" });
    expect(res.json.step.type).toBe("confirm");
    const cancelled = await s.act("cancel");
    expect(cancelled.json.result).toEqual({ outcome: "cancelled", billing: "external" });
  });

  test("a token can't see or drive another account's session", async () => {
    await subscriber("victim");
    const victim = await start("victim");
    const attacker = await tokenFor("tok_user");
    expect((await call("GET", a(`/cancel-sessions/${victim.id}`), { key: attacker })).status).toBe(404);
    expect((await call("POST", a(`/cancel-sessions/${victim.id}/cancel`), { key: attacker })).status).toBe(404);
    expect((await call("POST", a("/cancel-sessions"), { key: attacker, body: { account: "victim" } })).status).toBe(403);
    expect((await victim.act("close")).json.status).toBe("abandoned");
    expect((await victim.act("close")).json.status).toBe("abandoned");
  });

  test("stats and previews", async () => {
    const stats = (await secret("GET", "/cancel-flows/default/stats")).json;
    expect(stats).toMatchObject({ saved: 3, cancelled: 2, abandoned: 1 });
    expect(stats.save_rate).toBeCloseTo(0.6);
    expect(stats.monthly_revenue_saved).toBe(297);
    expect(stats.reasons.find((r: any) => r.answer === "too_expensive")).toMatchObject({ count: 2, saved: 1, cancelled: 1 });
    expect(stats.offers).toContainEqual({ kind: "pause", source: "static", shown: 1, accepted: 1 });

    const preview = await secret("POST", "/cancel-flows/default/preview-offer", { account: "victim", answers: ["temporary"], dynamic: true });
    expect(preview.json).toMatchObject({ offer: { kind: "pause", details: { months: 3 } }, dynamic: { used: false } });
    const sample = await secret("POST", "/cancel-flows/default/preview-offer", { answers: ["too_expensive"] });
    expect(sample.json).toMatchObject({
      account: { plan: "pro", subscription: { price: 99 } },
      offer: { kind: "discount", details: { price: 69.3 } },
      dynamic: null,
    });

    const list = (await secret("GET", "/cancel-sessions?status=saved")).json;
    expect(list.map((s: any) => s.account_id).sort()).toEqual(["feature_user", "pause_user", "price_user"]);
  });
});
