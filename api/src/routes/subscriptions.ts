import { Hono } from "hono";
import sql from "../db/client.ts";
import { changeDoc, getDoc } from "../db/docs.ts";
import { applySubscriptionBilling, billingFromSubscription } from "../lib/grants.ts";
import { ApiError, type Json, readObject, readOptionalJson } from "../lib/http.ts";
import { addDuration, defaultOffer, isDuration, loadCatalog, quote, type Quote } from "../lib/offers.ts";
import {
  cancelSubscription,
  ensureBillingPlan,
  getSubscription,
  PaypalError,
  requireConnection,
  reviseSubscription,
} from "../lib/paypal.ts";

// /apps/:appId/namespaces/:namespaceId/subscription
// The account's paid subscription: the core plan it pays for and the offer it
// bought through. Plan changes go through PayPal and apply once PayPal reports them.
const subscriptions = new Hono();

async function activeSubscription(appId: string, namespaceId: string) {
  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  const sub = namespace.subscription;
  if (!sub || sub.provider !== "paypal" || sub.status !== "active" || sub.interval === "once") {
    throw new ApiError(409, "This account has no active PayPal subscription");
  }
  return { namespace, sub: sub as Json };
}

const paypalCall = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PaypalError) throw new ApiError(502, `PayPal: ${err.message}`);
    throw err;
  }
};

// Ongoing price per month, for telling upgrades from downgrades.
const monthly = (price: number, interval: string) => (interval === "year" ? price / 12 : price);

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
  const appId = c.req.param("appId")!;
  const namespaceId = c.req.param("namespaceId")!;
  const { plan, interval: rawInterval, return_url, cancel_url } = await readObject(c);
  const { namespace, sub } = await activeSubscription(appId, namespaceId);

  const interval = rawInterval ?? sub.interval;
  if (interval !== "month" && interval !== "year") return c.json({ error: "interval must be month or year" }, 400);
  if (typeof plan !== "string") return c.json({ error: "plan is required" }, 400);
  if (plan === namespace.plan && interval === sub.interval) return c.json({ error: "The account is already on this plan" }, 400);

  const catalog = await loadCatalog(appId);
  const offer = sub.offer_id ? await getDoc("offers", appId, sub.offer_id) : null;

  // Existing buyers keep their offer's terms even after it stops taking new buyers.
  let offerQuote: Quote | null = null;
  if (offer?.plans?.some((p: Json) => p.plan_id === plan)) {
    try {
      offerQuote = quote(offer, catalog, { plan, interval });
    } catch {
      offerQuote = null; // the offer doesn't price this plan for this interval
    }
  }
  const staysInOffer = offerQuote !== null;
  const q = offerQuote ?? quote(defaultOffer(appId, catalog), catalog, { plan, interval });

  // Discounted cycles carry over within the offer; once used up, the list price applies.
  const left = staysInOffer ? (sub.discounted_cycles_left ?? 0) : 0;
  const cycles = q.cycles && left > 0 ? Math.min(q.cycles, left) : null;
  const price = q.cycles && !cycles ? (q.list_price ?? q.price) : q.price;

  const conn = await requireConnection(appId);
  const paypalPlanId = await paypalCall(() =>
    ensureBillingPlan(conn, {
      name: `${q.plan_name} ${interval === "year" ? "yearly" : "monthly"}${staysInOffer ? ` · ${q.offer_name}` : ""}`,
      interval,
      currency: q.currency,
      price,
      cycles,
      listPrice: q.list_price,
    }),
  );
  const [app] = await sql`select data ->> 'name' as name from apps where id = ${appId}`;
  const { approveUrl } = await paypalCall(() =>
    reviseSubscription(conn, sub.provider_id, paypalPlanId, {
      brandName: app?.name ?? undefined,
      returnUrl: return_url,
      cancelUrl: cancel_url,
    }),
  );

  const now = new Date();
  const downgrade = monthly(cycles ? q.list_price ?? price : price, interval) < monthly(sub.renews_at_price ?? sub.price, sub.interval);
  const pending = {
    plan_id: plan,
    interval,
    offer_id: staysInOffer ? sub.offer_id : null,
    offer_name: staysInOffer ? sub.offer_name : null,
    price,
    list_price: q.list_price,
    cycles,
    extras: staysInOffer
      ? {
          ...q.extras,
          ends_at: isDuration(q.extras.ends) ? addDuration(now, q.extras.ends).toISOString() : null,
        }
      : null,
    paypal_plan_id: paypalPlanId,
    approve_url: approveUrl,
    apply_after: downgrade ? (sub.renews_at ?? null) : null,
    requested_at: now.toISOString(),
  };

  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => ({
    ...doc,
    subscription: { ...doc.subscription, pending_change: pending },
  }));
  return c.json({ approve_url: approveUrl, pending_change: pending, subscription: change!.after.subscription });
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
  const { sub } = await activeSubscription(appId, c.req.param("namespaceId")!);

  const conn = await requireConnection(appId);
  await paypalCall(() => cancelSubscription(conn, sub.provider_id, typeof reason === "string" ? reason.slice(0, 127) : "Cancelled"));
  const billing = billingFromSubscription(await paypalCall(() => getSubscription(conn, sub.provider_id)));
  const after = await applySubscriptionBilling(appId, sub.provider_id, billing);
  return c.json(after?.subscription ?? sub);
});

export default subscriptions;
