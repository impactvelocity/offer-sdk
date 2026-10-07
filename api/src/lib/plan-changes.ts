import sql from "../db/client.ts";
import { changeDoc, getDoc } from "../db/docs.ts";
import { ApiError, type Json } from "./http.ts";
import { addDuration, defaultOffer, isDuration, loadCatalog, quote, type Quote } from "./offers.ts";
import { ensureBillingPlan, PaypalError, requireConnection, reviseSubscription } from "./paypal.ts";

// Changes to a running PayPal subscription: another plan or interval, or a
// limited-time discount (a cancel-flow save offer). PayPal needs the buyer's
// approval, so each change is recorded as `subscription.pending_change` and
// applies once PayPal reports the new billing plan (see grants.ts).

export async function activeSubscription(appId: string, namespaceId: string) {
  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  const sub = namespace.subscription;
  if (!sub || sub.provider !== "paypal" || sub.status !== "active" || sub.interval === "once") {
    throw new ApiError(409, "This account has no active PayPal subscription");
  }
  return { namespace, sub: sub as Json };
}

// Active or paused: either can still be cancelled in PayPal.
export async function cancellableSubscription(appId: string, namespaceId: string) {
  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  const sub = namespace.subscription;
  if (!sub || sub.provider !== "paypal" || !["active", "suspended"].includes(sub.status) || sub.interval === "once") {
    throw new ApiError(409, "This account has no active PayPal subscription");
  }
  return { namespace, sub: sub as Json };
}

export const paypalCall = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PaypalError) throw new ApiError(502, `PayPal: ${err.message}`);
    throw err;
  }
};

// Ongoing price per month, for telling upgrades from downgrades.
export const monthly = (price: number, interval: string) => (interval === "year" ? price / 12 : price);

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export type PlanChangeRequest = {
  plan: string;
  interval?: string;
  /** Lowers the price for this many renewals, then the regular price applies. */
  discount?: { percent: number; cycles: number } | null;
  return_url?: string;
  cancel_url?: string;
};

// If the account's offer includes the new plan, it keeps the offer's price,
// extras and any discounted cycles left; otherwise it moves to the plan's list
// price and leaves the offer. Upgrades apply once approved; downgrades wait for
// the renewal date.
export async function startPlanChange(appId: string, namespaceId: string, req: PlanChangeRequest) {
  const { namespace, sub } = await activeSubscription(appId, namespaceId);
  const { plan, discount, return_url, cancel_url } = req;

  const interval = req.interval ?? sub.interval;
  if (interval !== "month" && interval !== "year") throw new ApiError(400, "interval must be month or year");
  if (typeof plan !== "string") throw new ApiError(400, "plan is required");
  if (!discount && plan === namespace.plan && interval === sub.interval) {
    throw new ApiError(400, "The account is already on this plan");
  }

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
  let cycles = q.cycles && left > 0 ? Math.min(q.cycles, left) : null;
  let price = q.cycles && !cycles ? (q.list_price ?? q.price) : q.price;
  let listPrice = q.list_price;

  // A save-offer discount comes off what the account would pay next, for a
  // set number of renewals.
  if (discount) {
    const regular = cycles ? (q.list_price ?? price) : price;
    listPrice = regular;
    price = roundMoney(regular * (1 - discount.percent / 100));
    cycles = discount.cycles;
  }

  const conn = await requireConnection(appId);
  const label = discount ? ` · ${discount.percent}% off ${discount.cycles}x` : staysInOffer ? ` · ${q.offer_name}` : "";
  const paypalPlanId = await paypalCall(() =>
    ensureBillingPlan(conn, {
      name: `${q.plan_name} ${interval === "year" ? "yearly" : "monthly"}${label}`,
      interval,
      currency: q.currency,
      price,
      cycles,
      listPrice,
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
  const downgrade =
    !discount && monthly(cycles ? listPrice ?? price : price, interval) < monthly(sub.renews_at_price ?? sub.price, sub.interval);
  const pending = {
    plan_id: plan,
    interval,
    offer_id: staysInOffer ? sub.offer_id : null,
    offer_name: staysInOffer ? sub.offer_name : null,
    price,
    list_price: listPrice,
    cycles,
    extras: staysInOffer
      ? {
          ...q.extras,
          ends_at: isDuration(q.extras.ends) ? addDuration(now, q.extras.ends).toISOString() : null,
        }
      : null,
    ...(discount ? { discount } : {}),
    paypal_plan_id: paypalPlanId,
    approve_url: approveUrl,
    apply_after: downgrade ? (sub.renews_at ?? null) : null,
    requested_at: now.toISOString(),
  };

  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => ({
    ...doc,
    subscription: { ...doc.subscription, pending_change: pending },
  }));
  return { approve_url: approveUrl, pending_change: pending, subscription: change!.after.subscription };
}
