import "server-only";
import { OfferClient } from "@offer/sdk";
import {
  CheckoutClient,
  getOffer,
  initialSelection,
  priceLabel,
  renewalLabel,
  savings,
  summarize,
  type PublicOffer,
} from "@offer/sdk/checkout";
import { appApi, clientFor, OfferApiError } from "./client";
import { OFFER_ADMIN_KEY, OFFER_API_URL, OFFER_APP_URL, offerConfig } from "./config";
import type { LimitReached, NamespacePlan } from "./types";

// `rake test` for the Offer API and SDK: ~100 checks against the running API,
// with a throwaway account and scratch records that are cleaned up at the end.

export type Outcome = "pass" | "fail" | "skip";

export interface Call {
  method: string;
  path: string;
  status: number | "ERR";
  key: string;
}

export interface TestResult {
  group: string;
  name: string;
  outcome: Outcome;
  ms: number;
  detail?: string;
  calls: Call[];
}

export interface SuiteResult {
  appId: string | null;
  results: TestResult[];
  ms: number;
}

class Skip extends Error {}
class AssertionFailed extends Error {}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new AssertionFailed(message);
}

function eq<T>(actual: T, expected: T, what: string) {
  assert(Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected), `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** Expects the call to fail with `status`; returns the error body. */
async function rejects<T = unknown>(promise: Promise<unknown>, status: number): Promise<T> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof OfferApiError) {
      eq(err.status, status, "status");
      return err.body as T;
    }
    throw err;
  }
  throw new AssertionFailed(`expected ${status}, got 2xx`);
}

export async function runSuite(): Promise<SuiteResult> {
  const started = performance.now();
  const results: TestResult[] = [];
  let calls: Call[] = [];
  let group = "";

  // Every client in the suite records into the current test's calls.
  const recording: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const auth = new Headers(init?.headers).get("Authorization") ?? "";
    const key = !auth ? "none" : auth.includes("key_") ? "secret" : auth.includes("pub_") ? "public" : "admin";
    const call: Call = { method: init?.method ?? "GET", path: url.pathname + url.search, status: "ERR", key };
    calls.push(call);
    const res = await fetch(input, { ...init, cache: "no-store" });
    call.status = res.status;
    return res;
  };

  async function test(name: string, fn: () => Promise<unknown>) {
    calls = [];
    const t = performance.now();
    let outcome: Outcome = "pass";
    let detail: string | undefined;
    try {
      const note = await fn();
      if (typeof note === "string") detail = note;
    } catch (err) {
      outcome = err instanceof Skip ? "skip" : "fail";
      detail = err instanceof OfferApiError ? `${err.status} ${err.message}` : err instanceof Error ? err.message : String(err);
    }
    results.push({ group, name, outcome, ms: Math.round(performance.now() - t), detail, calls });
  }
  const describe = (name: string) => (group = name);
  const skip = (why: string): never => {
    throw new Skip(why);
  };

  const config = await offerConfig();
  const anon = clientFor(undefined, recording);

  describe("Health & docs");
  await test("GET /health", async () => eq((await anon.request<{ ok: boolean }>("/health")).ok, true, "ok"));
  await test("GET /openapi.json lists paths", async () => {
    const spec = await anon.request<{ paths: Record<string, unknown> }>("/openapi.json");
    assert(Object.keys(spec.paths).length > 30, "fewer than 30 paths");
    return `${Object.keys(spec.paths).length} paths`;
  });
  await test("GET /event-types (no key)", async () => {
    const types = await anon.request<{ type: string; sample: unknown }[]>("/event-types");
    assert(types.some((t) => t.type === "account.created"), "account.created missing");
    return `${types.length} types`;
  });
  await test("unknown route is a JSON 404", () => rejects(anon.request("/nope"), 404));

  if (!config) {
    describe("Setup");
    await test("blog is connected to an app", async () => skip("run /setup first"));
    return { appId: null, results, ms: Math.round(performance.now() - started) };
  }

  const api = appApi(config, config.secretKey, recording);
  const pub = appApi(config, config.publicKey, recording);
  const admin = OFFER_ADMIN_KEY ? appApi(config, OFFER_ADMIN_KEY, recording) : null;
  const wrong = appApi(config, "key_wrong", recording);
  const tag = Math.random().toString(36).slice(2, 8);
  const ns = `rake_${tag}`;
  const nsPath = `/namespaces/${ns}`;

  describe("Auth");
  await test("no key → 401", () => rejects(anon.request(`/apps/${config.appId}`), 401));
  await test("wrong key → 401", () => rejects(wrong.get(""), 401));
  await test("public key can't read the app → 401", () => rejects(pub.get(""), 401));
  await test("secret key reads the app", async () => eq((await api.get<{ id: string }>("")).id, config.appId, "id"));
  await test("admin key reads the app", async () => {
    if (!admin) skip("OFFER_ADMIN_KEY not set");
    eq((await admin!.get<{ id: string }>("")).id, config.appId, "id");
  });
  await test("admin key lists /orgs", async () => {
    if (!OFFER_ADMIN_KEY) skip("OFFER_ADMIN_KEY not set");
    const orgs = await clientFor(OFFER_ADMIN_KEY, recording).request<unknown[]>("/orgs");
    return `${orgs.length} orgs`;
  });
  await test("secret key can't list /orgs → 401", () => rejects(clientFor(config.secretKey, recording).request("/orgs"), 401));
  await test("history import is admin-only → 401", () => rejects(api.post("/import", { namespaces: [] }), 401));

  describe("Catalog");
  await test("GET /entitlements", async () => {
    const list = await api.get<{ id: string }[]>("/entitlements");
    for (const id of ["posts", "comments", "pin_posts"]) assert(list.some((e) => e.id === id), `${id} missing`);
  });
  await test("posts blocks overage", async () => eq((await api.get<{ overage?: { mode: string } }>("/entitlements/posts")).overage?.mode, "block", "overage.mode"));
  await test("GET /addons/:id", async () => eq((await api.get<{ id: string }>("/addons/priority_support")).id, "priority_support", "id"));
  await test("GET /plans", async () => {
    const plans = await api.get<{ id: string }[]>("/plans");
    eq(plans.map((p) => p.id).join(","), "free,pro,business", "plans in creation order");
  });
  await test("GET /plans/pricing (public key)", async () => assert((await pub.get<unknown[]>("/plans/pricing")).length === 3, "3 cards"));
  await test("GET /plans/pro/pricing (public key)", async () => eq((await pub.get<{ monthlyPrice: number }>("/plans/pro/pricing")).monthlyPrice, 9, "monthlyPrice"));
  await test("GET /incentives/:id", async () => eq((await api.get<{ addons: string[] }>("/incentives/beta_tester")).addons, ["priority_support"], "addons"));

  const ent = `rake_ent_${tag}`;
  await test("entitlement CRUD", async () => {
    await api.post("/entitlements", { id: ent, type: "usage", name: "Scratch" });
    await rejects(api.post("/entitlements", { id: ent, type: "usage" }), 409);
    eq((await api.patch<{ name: string }>(`/entitlements/${ent}`, { name: "Renamed" })).name, "Renamed", "name");
    eq((await api.del<{ deleted: boolean }>(`/entitlements/${ent}`)).deleted, true, "deleted");
    await rejects(api.get(`/entitlements/${ent}`), 404);
  });
  await test("entitlement type is validated → 400", () => rejects(api.post("/entitlements", { id: ent, type: "nope" }), 400));
  await test("ids are slugified", async () => {
    const e = await api.post<{ id: string }>("/entitlements", { id: `Rake Slug ${tag}`, type: "boolean" });
    eq(e.id, `rake_slug_${tag}`, "id");
    await api.del(`/entitlements/${e.id}`);
  });
  await test("addon CRUD", async () => {
    const id = `rake_addon_${tag}`;
    await api.post("/addons", { id, name: "Scratch" });
    eq((await api.patch<{ name: string }>(`/addons/${id}`, { name: "Renamed" })).name, "Renamed", "name");
    await api.del(`/addons/${id}`);
  });
  await test("plan CRUD with attachments and meta", async () => {
    const id = `rake_plan_${tag}`;
    await api.post("/plans", { id, name: "Scratch" });
    await api.post(`/plans/${id}/entitlements`, { id: "posts", max: 1 });
    await rejects(api.post(`/plans/${id}/entitlements`, { id: "posts" }), 409);
    await api.patch(`/plans/${id}/entitlements/posts`, { max: 2 });
    await api.post(`/plans/${id}/addons`, { id: "priority_support" });
    let plan = await api.patch<{ entitlements: { id: string; max: number }[]; addons: string[]; meta: Record<string, unknown> }>(`/plans/${id}/meta`, { color: "red" });
    eq(plan.entitlements[0].max, 2, "max");
    eq(plan.addons, ["priority_support"], "addons");
    eq(plan.meta.color, "red", "meta.color");
    await api.del(`/plans/${id}/entitlements/posts`);
    plan = await api.del(`/plans/${id}/addons/priority_support`);
    eq(plan.entitlements.length + plan.addons.length, 0, "attachments left");
    await rejects(api.get(`/plans/${id}/pricing`), 404);
    await api.del(`/plans/${id}`);
  });
  await test("incentive CRUD with attachments", async () => {
    const id = `rake_inc_${tag}`;
    await api.post("/incentives", { id, name: "Scratch" });
    await api.post(`/incentives/${id}/entitlements`, { id: "comments", max: 99 });
    await api.post(`/incentives/${id}/addons`, { id: "priority_support" });
    const inc = await api.patch<{ name: string; entitlements: unknown[] }>(`/incentives/${id}`, { name: "Renamed" });
    eq(inc.entitlements.length, 1, "entitlements");
    await api.del(`/incentives/${id}`);
  });

  describe("Accounts");
  await test("create account", async () => eq((await api.post<{ plan: string }>("/namespaces", { id: ns, name: "Rake Test", plan: "free" })).plan, "free", "plan"));
  await test("duplicate → 409", () => rejects(api.post("/namespaces", { id: ns, plan: "free" }), 409));
  await test("unknown plan → 404", () => rejects(api.post("/namespaces", { id: `${ns}_x`, plan: "nope" }), 404));
  await test("missing id → 400", () => rejects(api.post("/namespaces", { plan: "free" }), 400));
  await test("GET account", async () => eq((await api.get<{ name: string }>(nsPath)).name, "Rake Test", "name"));
  await test("PATCH account", async () => eq((await api.patch<{ name: string }>(nsPath, { name: "Rake Renamed" })).name, "Rake Renamed", "name"));
  await test("search ?q=", async () => assert((await api.get<{ total: number }>(`/namespaces?q=${ns}`)).total === 1, "one match"));
  await test("search ?plan=free", async () => assert((await api.get<{ total: number }>("/namespaces?plan=free")).total >= 1, "no free accounts"));
  await test("GET /namespaces/count", async () => assert((await api.get<{ count: number }>("/namespaces/count")).count >= 1, "count"));
  await test("GET /plans/free/namespaces", async () => {
    const page = await api.get<{ data: { id: string }[] }>("/plans/free/namespaces?per_page=100");
    assert(page.data.some((n) => n.id === ns), "account not listed");
  });

  describe("Usage");
  await test("add ×3 counts 1, 2, 3", async () => {
    const counts = [];
    for (let i = 0; i < 3; i++) counts.push((await api.post<{ count: number }>(`${nsPath}/usage/posts/add`)).count);
    eq(counts, [1, 2, 3], "counts");
  });
  await test("4th post → 402 with an upgrade offer", async () => {
    const body = await rejects<LimitReached>(api.post(`${nsPath}/usage/posts/add`), 402);
    eq(body.error, "limit_reached", "error");
    eq(body.entitlement.usage, 3, "usage");
    assert(body.offer, "no upgrade offer");
    return `${body.offer.plan.name} for ${body.offer.price}, link: ${body.offer.checkout_url ? "yes" : "no"}`;
  });
  await test("blocked add didn't count", async () => eq((await api.get<{ count: number }>(`${nsPath}/usage/posts`)).count, 3, "count"));
  await test("remove", async () => eq((await api.post<{ count: number }>(`${nsPath}/usage/posts/remove`)).count, 2, "count"));
  await test("amount", async () => eq((await api.post<{ count: number }>(`${nsPath}/usage/posts/amount`, { amount: 1 })).count, 3, "count"));
  await test("amount over the limit → 402", () => rejects(api.post(`${nsPath}/usage/posts/amount`, { amount: 5 }), 402));
  await test("non-integer amount → 400", () => rejects(api.post(`${nsPath}/usage/posts/amount`, { amount: 1.5 }), 400));
  await test("boolean entitlement can't count → 400", () => rejects(api.post(`${nsPath}/usage/pin_posts/add`), 400));
  await test("allow-mode counts past the limit", async () => {
    eq((await api.post<{ count: number }>(`${nsPath}/usage/comments/amount`, { amount: 25 })).count, 25, "count");
    const plan = await api.get<NamespacePlan>(`${nsPath}/plan`);
    const comments = plan.entitlements.find((e) => e.id === "comments")!;
    eq([comments.can, comments.left], [false, 0], "[can, left]");
  });
  await test("public key tracks usage", async () => eq((await pub.post<{ count: number }>(`${nsPath}/usage/comments/add`)).count, 26, "count"));
  await test("GET /usage map", async () => eq(await api.get(`${nsPath}/usage`), { posts: 3, comments: 26 }, "usage"));
  await test("unknown account → 404", () => rejects(api.post("/namespaces/nobody_here/usage/posts/add"), 404));

  describe("Plans & meta");
  await test("plan change applies new limits", async () => {
    await api.patch(nsPath, { plan: "pro" });
    const plan = await api.get<NamespacePlan>(`${nsPath}/plan`);
    eq(plan.entitlements.find((e) => e.id === "posts")?.max, 50, "posts max");
    eq(plan.entitlements.find((e) => e.id === "pin_posts")?.can, true, "pin_posts");
  });
  await test("/plan hides private meta", async () => {
    const { plan } = await api.get<NamespacePlan>(`${nsPath}/plan`);
    eq([plan.meta.badge, plan.meta.internal_price_id], ["PRO", undefined], "[badge, internal_price_id]");
  });
  await test("/full-plan includes private meta", async () => {
    const { plan } = await api.get<NamespacePlan>(`${nsPath}/full-plan`);
    eq(plan.meta.internal_price_id, "price_pro_internal", "internal_price_id");
  });
  await test("public key reads /plan", async () => eq((await pub.get<NamespacePlan>(`${nsPath}/plan`)).plan.id, "pro", "plan"));
  await test("public key can't PATCH the account → 401", () => rejects(pub.patch(nsPath, { plan: "business" }), 401));
  await test("unknown plan on PATCH → 404", () => rejects(api.patch(nsPath, { plan: "nope" }), 404));

  describe("Incentives & add-ons");
  await test("incentive overrides the plan", async () => {
    await api.patch(nsPath, { incentive: "beta_tester" });
    const plan = await api.get<NamespacePlan>(`${nsPath}/plan`);
    eq(plan.incentive, "beta_tester", "incentive");
    eq(plan.entitlements.find((e) => e.id === "posts")?.max, 25, "posts max");
    assert(plan.addons.includes("priority_support"), "addon from incentive");
  });
  await test("GET /namespaces/with-incentive", async () => {
    const page = await api.get<{ data: { id: string }[] }>("/namespaces/with-incentive?incentive=beta_tester&per_page=100");
    assert(page.data.some((n) => n.id === ns), "account not listed");
  });
  await test("expired incentive stops applying", async () => {
    await api.patch(nsPath, { incentive_expires_at: new Date(Date.now() - 1000).toISOString() });
    eq((await api.get<NamespacePlan>(`${nsPath}/plan`)).incentive, null, "incentive");
  });
  await test("DELETE /incentive", async () => eq((await api.del<{ incentive: null }>(`${nsPath}/incentive`)).incentive, null, "incentive"));
  await test("unknown incentive → 404", () => rejects(api.patch(nsPath, { incentive: "nope" }), 404));
  await test("grant + revoke an account add-on", async () => {
    eq((await api.post<{ addons: string[] }>(`${nsPath}/addons`, { id: "priority_support" })).addons, ["priority_support"], "addons");
    eq((await api.del<{ addons: string[] }>(`${nsPath}/addons/priority_support`)).addons, [], "addons");
  });

  describe("Offers");
  let paypal = false;
  await test("GET /paypal", async () => {
    paypal = "env" in (await api.get<Record<string, unknown>>("/paypal"));
    return paypal ? "connected" : "not connected: publish & checkout tests expect 409";
  });
  await test("GET /offers", async () => assert((await api.get<{ id: string }[]>("/offers")).some((o) => o.id === "launch_50"), "launch_50 missing"));
  await test("GET /offers/:id has availability", async () => {
    const offer = await api.get<{ status: string; availability: string }>("/offers/launch_50");
    return `${offer.status} / ${offer.availability}`;
  });
  await test("public offer: draft falls back to regular prices", async () => {
    const offer = await pub.get<PublicOffer>("/offers/launch_50/public");
    if (paypal && offer.resolved_from === "requested") return "published";
    eq([offer.resolved_from, offer.requested?.reason], ["default", "draft"], "[resolved_from, reason]");
  });
  await test("public offer: unknown id → not_found, never 404", async () =>
    eq((await pub.get<PublicOffer>("/offers/nope/public?fallback=also_nope")).requested?.reason, "not_found", "reason"),
  );
  await test("public offer: default has regular prices", async () => {
    const offer = await pub.get<PublicOffer>("/offers/default/public");
    eq(offer.plans.map((p) => p.id), ["pro", "business"], "plans");
    eq(offer.plans[0].prices.month?.amount, 9, "pro monthly");
  });
  await test("POST /offers/draft-preview", async () => {
    const draft = await api.post<PublicOffer>("/offers/draft-preview", { plans: ["pro"], discount: { percent: 10 } });
    eq(draft.plans[0].prices.month?.amount, 8.1, "10% off $9");
  });
  await test("draft-preview validates → 400", () => rejects(api.post("/offers/draft-preview", { plans: ["nope"] }), 400));
  await test("POST /offers/:id/preview for an account", async () => {
    const preview = await api.post<{ plans: { plan_id: string; changes?: unknown[] }[] }>("/offers/launch_50/preview", { account: ns });
    assert(preview.plans.every((p) => Array.isArray(p.changes)), "changes missing");
  });
  await test("GET /offers/:id/stats", async () => {
    const stats = await api.get<{ views: number }>("/offers/launch_50/stats");
    return `${stats.views} views`;
  });
  const scratchOffer = `rake_offer_${tag}`;
  await test("shareable offer: create, edit", async () => {
    eq((await api.post<{ status: string }>("/offers", { id: scratchOffer, plans: ["pro"], discount: { amount_off: 2 } })).status, "draft", "status");
    eq((await api.patch<{ name: string }>(`/offers/${scratchOffer}`, { name: "Two off" })).name, "Two off", "name");
    await rejects(api.post("/offers", { id: "default", plans: ["pro"] }), 400);
  });
  await test("publish", async () => {
    if (!paypal) return rejects(api.post(`/offers/${scratchOffer}/publish`), 409);
    eq((await api.post<{ status: string }>(`/offers/${scratchOffer}/publish`)).status, "active", "status");
  });
  await test("archive + delete", async () => {
    eq((await api.post<{ status: string }>(`/offers/${scratchOffer}/archive`)).status, "archived", "status");
    await api.del(`/offers/${scratchOffer}`);
  });
  let targeted = "";
  await test("targeted offer gets an unguessable id", async () => {
    targeted = (await api.post<{ id: string }>("/offers", { type: "targeted", account_id: ns, plans: ["business"], discount: { percent: 20 } })).id;
    assert(targeted.startsWith("off_"), `id ${targeted}`);
  });
  await test("targeted offer needs an account → 400", () => rejects(api.post("/offers", { type: "targeted", plans: ["pro"] }), 400));
  await test("checkout (public key)", async () => {
    const start = pub.post(`/offers/default/checkout`, { plan: "pro", interval: "month", account: ns });
    if (!paypal) return rejects(start, 409);
    const checkout = await start;
    return `created ${(checkout as { id: string }).id}`;
  });
  await test("checkout validates the buyer → 400", () => rejects(pub.post("/offers/default/checkout", { plan: "pro", interval: "month" }), 400));
  await test("GET /checkouts", async () => `${(await api.get<unknown[]>("/checkouts")).length} checkouts`);
  await test("no subscription → 404", () => rejects(api.get(`${nsPath}/subscription`), 404));
  await test("change without a subscription → 409", () => rejects(api.post(`${nsPath}/subscription/change`, { plan: "business" }), 409));

  describe("Webhooks");
  await test("GET /webhooks lists the blog's endpoint", async () => {
    const list = await api.get<{ id: string }[]>("/webhooks");
    if (!config.webhookId) skip("no endpoint (run /setup)");
    assert(list.some((w) => w.id === config.webhookId), "endpoint missing");
  });
  await test("test delivery reaches the blog with a valid signature", async () => {
    if (!config.webhookId) skip("no endpoint (run /setup)");
    const d = await api.post<{ status: string; response_status: number | null; error?: string }>(`/webhooks/${config.webhookId}/test`, { type: "usage.limit_reached" });
    assert(d.status === "succeeded", `${d.status}: ${d.response_status ?? d.error ?? "no response"} (the blog answers 401 on a bad signature)`);
  });
  await test("scratch endpoint: create, patch, rotate, delete", async () => {
    const hook = await api.post<{ id: string; secret: string }>("/webhooks", { url: "https://example.com/rake", events: ["account.created"] });
    assert(hook.secret.startsWith("whsec_"), "secret");
    eq((await api.patch<{ enabled: boolean }>(`/webhooks/${hook.id}`, { enabled: false })).enabled, false, "enabled");
    const { secret } = await api.post<{ secret: string }>(`/webhooks/${hook.id}/secret/regenerate`);
    assert(secret !== hook.secret, "secret unchanged");
    await api.get(`/webhooks/${hook.id}/deliveries`);
    await api.del(`/webhooks/${hook.id}`);
  });
  await test("bad URL → 400", () => rejects(api.post("/webhooks", { url: "ftp://x", events: ["*"] }), 400));
  await test("unknown event type → 400", () => rejects(api.post("/webhooks", { url: "https://example.com", events: ["nope.nope"] }), 400));
  await test("GET /events?type=account.created", async () => {
    const events = await api.get<{ data: { object: { id: string } } }[]>("/events?type=account.created&limit=50");
    assert(events.some((e) => e.data.object.id === ns), "no event for the test account");
  });

  describe("Analytics");
  await test("GET /analytics?interval=7d", async () => assert((await api.get<{ entitlement_id: string }[]>("/analytics?interval=7d")).some((r) => r.entitlement_id === "posts"), "no posts row"));
  await test("interval is required → 400", () => rejects(api.get("/analytics"), 400));
  await test("GET /analytics/timeseries", async () => `${(await api.get<unknown[]>(`/analytics/timeseries?interval=7d&namespace=${ns}`)).length} buckets`);
  await test("GET /analytics/top-namespaces", async () => `${(await api.get<unknown[]>("/analytics/top-namespaces?interval=30d&limit=3")).length} rows`);
  await test("GET /analytics/events?namespace=", async () => {
    const events = await api.get<{ operation: string }[]>(`/analytics/events?namespace=${ns}`);
    assert(events.length >= 6, `${events.length} events`);
  });
  await test("saved report CRUD", async () => {
    const r = await api.post<{ id: string }>("/analytics/reports", { name: `rake ${tag}`, entitlements: ["posts"], interval: "7d" });
    await api.get(`/analytics/reports/${r.id}`);
    eq((await api.patch<{ name: string }>(`/analytics/reports/${r.id}`, { name: "renamed" })).name, "renamed", "name");
    await api.del(`/analytics/reports/${r.id}`);
  });
  await test("agent threads are admin-only → 401", () => rejects(api.get(`/agent/threads?user_id=${ns}`), 401));
  await test("agent thread CRUD (admin key)", async () => {
    if (!admin) skip("OFFER_ADMIN_KEY not set");
    const id = `rake_thread_${tag}`;
    await admin!.put(`/agent/threads/${id}`, { user_id: ns, messages: [{ role: "user", content: "hi" }], title: "Rake" });
    eq((await admin!.get<{ id: string }[]>(`/agent/threads?user_id=${ns}`)).length, 1, "threads");
    await admin!.patch(`/agent/threads/${id}`, { title: "Renamed" });
    await admin!.del(`/agent/threads/${id}`);
  });

  describe("SDK");
  const sdk = { apiUrl: OFFER_API_URL, appId: config.appId, publishableKey: config.publicKey, fetch: recording };
  await test("getOffer() server helper", async () => eq((await getOffer({ ...sdk, offerId: "default" })).resolved_from, "default", "resolved_from"));
  await test("CheckoutClient.getOffer with account + ref", async () => {
    const offer = await new CheckoutClient(sdk).getOffer("launch_50", { account: ns, ref: "rake" });
    return `resolved_from ${offer.resolved_from}`;
  });
  await test("selection + pricing helpers", async () => {
    const offer = await api.post<PublicOffer>("/offers/draft-preview", (await api.get<Record<string, unknown>>("/offers/launch_50")) as Record<string, unknown>);
    const sel = initialSelection(offer);
    eq([sel.plan, sel.interval], ["pro", "month"], "initial selection");
    const summary = summarize(offer, { ...sel, bumps: ["support"] });
    eq(summary.totalToday, 23.5, "4.50 + 19 bump");
    eq(summary.renewal, { amount: 9, afterCycles: 3 }, "renewal");
    const price = summary.price!;
    eq(priceLabel(price.amount, "month", "USD"), "$4.50/mo", "priceLabel");
    eq(renewalLabel(price, "month", "USD"), "for 3 months, then $9/mo", "renewalLabel");
    eq(savings(price), 50, "savings");
    eq(summarize(offer, { ...sel, bumps: ["posts_pack"], plan: "business" }).bumps.length, 0, "posts_pack only applies to pro");
  });
  await test("CheckoutClient.startCheckout", async () => {
    const start = new CheckoutClient(sdk).startCheckout("default", { plan: "pro", interval: "year", bumps: [], account: ns });
    if (!paypal) {
      await rejects(start, 409);
      return "409 without PayPal, as expected";
    }
    const checkout = await start;
    eq(checkout.status, "created", "status");
    eq((await new CheckoutClient(sdk).getCheckout(checkout.id)).id, checkout.id, "getCheckout");
  });
  await test("OfferApiError carries status + body", async () => {
    try {
      await new CheckoutClient({ ...sdk, publishableKey: "pub_wrong" }).getOffer("default");
    } catch (err) {
      assert(err instanceof OfferApiError && err.status === 401, "not a 401 OfferApiError");
      return;
    }
    throw new AssertionFailed("no error");
  });
  await test(`OfferClient.listOffers() against the dashboard (${OFFER_APP_URL})`, async () => {
    try {
      const offers = await new OfferClient({ baseUrl: OFFER_APP_URL, fetch: recording }).listOffers();
      return `${offers.length} offers`;
    } catch (err) {
      if (err instanceof TypeError) skip(`dashboard not running at ${OFFER_APP_URL}`);
      throw err;
    }
  });

  describe("Cleanup");
  await test("delete targeted offer", async () => {
    if (!targeted) skip("not created");
    await api.del(`/offers/${targeted}`);
  });
  await test("delete account", async () => {
    eq((await api.del<{ deleted: boolean }>(nsPath)).deleted, true, "deleted");
    await rejects(api.get(nsPath), 404);
  });

  return { appId: config.appId, results, ms: Math.round(performance.now() - started) };
}

