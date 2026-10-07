import { Hono } from "hono";
import { getDoc } from "../db/docs.ts";
import { applySubscriptionBilling, billingFromSubscription } from "../lib/grants.ts";
import { readObject, readOptionalJson } from "../lib/http.ts";
import { pauseSubscription, resumeSubscription } from "../lib/pauses.ts";
import { cancelSubscription, getSubscription, requireConnection } from "../lib/paypal.ts";
import { cancellableSubscription, paypalCall, startPlanChange } from "../lib/plan-changes.ts";

// /apps/:appId/namespaces/:namespaceId/subscription
// The account's paid subscription: the core plan it pays for and the offer it
// bought through. Plan changes go through PayPal and apply once PayPal reports them.
const subscriptions = new Hono();

// GET /apps/:appId/namespaces/:namespaceId/subscription
subscriptions.get("/", async (c) => {
  const namespace = await getDoc("namespaces", c.req.param("appId")!, c.req.param("namespaceId")!);
  if (!namespace) return c.json({ error: "Namespace not found" }, 404);
  if (!namespace.subscription) return c.json({ error: "This account has no subscription" }, 404);
  return c.json(namespace.subscription);
});

// POST /apps/:appId/namespaces/:namespaceId/subscription/change
// Body: { plan, interval?, return_url?, cancel_url? }. If the account's offer
// includes the new plan, it keeps the offer's price, extras and any discounted
// cycles left; otherwise it moves to the plan's list price and leaves the
// offer. Returns PayPal's approval link. Upgrades apply once approved;
// downgrades wait for the renewal date.
subscriptions.post("/change", async (c) => {
  const { plan, interval, return_url, cancel_url } = await readObject(c);
  return c.json(
    await startPlanChange(c.req.param("appId")!, c.req.param("namespaceId")!, { plan, interval, return_url, cancel_url }),
  );
});

// POST /apps/:appId/namespaces/:namespaceId/subscription/sync
// Re-reads the subscription from PayPal: renewal date, discounted cycles left,
// cancellation and approved plan changes. Webhooks do this automatically.
subscriptions.post("/sync", async (c) => {
  const appId = c.req.param("appId")!;
  const namespace = await getDoc("namespaces", appId, c.req.param("namespaceId")!);
  if (!namespace) return c.json({ error: "Namespace not found" }, 404);
  const sub = namespace.subscription;
  if (!sub || sub.provider !== "paypal" || sub.interval === "once") {
    return c.json({ error: "This account has no PayPal subscription" }, 409);
  }

  const conn = await requireConnection(appId);
  const billing = billingFromSubscription(await paypalCall(() => getSubscription(conn, sub.provider_id)));
  const after = await applySubscriptionBilling(appId, sub.provider_id, billing);
  return c.json(after?.subscription ?? sub);
});

// POST /apps/:appId/namespaces/:namespaceId/subscription/cancel
// Body: { reason? }. Cancels in PayPal and moves the account to the free plan.
subscriptions.post("/cancel", async (c) => {
  const appId = c.req.param("appId")!;
  const { reason } = await readOptionalJson(c);
  const { sub } = await cancellableSubscription(appId, c.req.param("namespaceId")!);

  const conn = await requireConnection(appId);
  await paypalCall(() => cancelSubscription(conn, sub.provider_id, typeof reason === "string" ? reason.slice(0, 127) : "Cancelled"));
  const billing = billingFromSubscription(await paypalCall(() => getSubscription(conn, sub.provider_id)));
  const after = await applySubscriptionBilling(appId, sub.provider_id, billing);
  return c.json(after?.subscription ?? sub);
});

// POST /apps/:appId/namespaces/:namespaceId/subscription/pause
// Body: { months, reason? }. Suspends billing in PayPal and moves the account
// to the free plan until `pause.resume_at`, when it resumes on its own.
subscriptions.post("/pause", async (c) => {
  const { months, reason, session_id } = await readObject(c);
  const after = await pauseSubscription(c.req.param("appId")!, c.req.param("namespaceId")!, { months, reason, session_id });
  return c.json(after.subscription);
});

// POST /apps/:appId/namespaces/:namespaceId/subscription/resume
// Ends a pause now: billing restarts and the account gets its plan back.
subscriptions.post("/resume", async (c) => {
  const after = await resumeSubscription(c.req.param("appId")!, c.req.param("namespaceId")!);
  return c.json(after.subscription);
});

export default subscriptions;
