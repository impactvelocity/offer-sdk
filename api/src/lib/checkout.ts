import sql from "../db/client.ts";
import { billingFromSubscription, completeCheckout } from "./grants.ts";
import { ApiError, type Json } from "./http.ts";
import { prefixedId } from "./ids.ts";
import { type Catalog, DEFAULT_OFFER_ID, quote } from "./offers.ts";
import {
  captureOrder,
  createOrder,
  createSubscription,
  ensureBillingPlan,
  getOrder,
  getSubscription,
  PaypalError,
  requireConnection,
} from "./paypal.ts";

// Starting and finishing checkouts. Shared by the SDK's checkout routes and
// server-made links (over-limit responses).

export const billingPlanName = (offer: Json, planName: string, interval: string) =>
  `${planName} ${interval === "year" ? "yearly" : "monthly"}${offer.id === DEFAULT_OFFER_ID ? "" : ` · ${offer.name ?? offer.id}`}`;

// Prices the selection, records the checkout and creates the PayPal
// subscription (month, year) or order (once). Returns the checkout row.
export async function startCheckout(
  appId: string,
  offer: Json,
  catalog: Catalog,
  selection: { plan: unknown; interval: unknown; bumps?: unknown },
  buyer: { account?: string | null; email?: string | null; ref?: string | null; returnUrl?: string; cancelUrl?: string },
): Promise<Json> {
  const q = quote(offer, catalog, selection);
  if (q.total_today <= 0) throw new ApiError(400, "Nothing to pay for this selection");

  const conn = await requireConnection(appId);
  const id = prefixedId("chk", 16);
  await sql`
    insert into checkouts (id, app_id, offer_id, plan_id, interval, bump_ids, account_id, email, ref, quote)
    values (${id}, ${appId}, ${q.offer_id}, ${q.plan_id}, ${q.interval}, ${q.bumps.map((b) => b.id)}::jsonb,
            ${buyer.account ?? null}, ${buyer.email ?? null}, ${buyer.ref ?? null}, ${q}::jsonb)`;

  const [app] = await sql`select data ->> 'name' as name from apps where id = ${appId}`;
  const context = { brandName: app?.name ?? undefined, returnUrl: buyer.returnUrl, cancelUrl: buyer.cancelUrl };

  let paypal: { kind: "subscription" | "order"; id: string; approveUrl: string | null };
  try {
    if (q.interval === "once") {
      const order = await createOrder(conn, {
        ...context,
        customId: id,
        currency: q.currency,
        items: [{ name: `${q.plan_name} (lifetime)`, amount: q.price }, ...q.bumps.map((b) => ({ name: b.label, amount: b.amount }))],
      });
      paypal = { kind: "order", ...order };
    } else {
      const planId = await ensureBillingPlan(conn, {
        name: billingPlanName(offer, q.plan_name, q.interval),
        interval: q.interval,
        currency: q.currency,
        price: q.price,
        cycles: q.cycles,
        listPrice: q.list_price,
      });
      const sub = await createSubscription(conn, {
        ...context,
        planId,
        customId: id,
        setupFee: q.setup_fee,
        currency: q.currency,
        email: buyer.email ?? null,
      });
      paypal = { kind: "subscription", ...sub };
    }
  } catch (err) {
    await sql`update checkouts set status = 'failed' where id = ${id}`;
    if (err instanceof PaypalError) throw new ApiError(502, `PayPal: ${err.message}`);
    throw err;
  }

  const [row] = await sql`
    update checkouts set paypal_kind = ${paypal.kind}, paypal_id = ${paypal.id}, approve_url = ${paypal.approveUrl}
    where id = ${id} returning *`;
  if (q.offer_id) {
    await sql`
      insert into offer_events (app_id, offer_id, type, plan_id, interval, ref, checkout_id)
      values (${appId}, ${q.offer_id}, 'checkout_started', ${q.plan_id}, ${q.interval}, ${buyer.ref ?? null}, ${id})`;
  }
  return row;
}

// Asks PayPal whether a checkout has been paid and grants it if so. Safe to
// call any number of times; the webhook does the same when it arrives.
// Returns true when this call completed it.
export async function syncCheckout(appId: string, checkout: Json): Promise<boolean> {
  if (checkout.status !== "created" || !checkout.paypal_id) return false;
  const conn = await requireConnection(appId);

  if (checkout.paypal_kind === "subscription") {
    const billing = billingFromSubscription(await getSubscription(conn, checkout.paypal_id));
    if (billing.status === "active") return !!(await completeCheckout(appId, checkout.id, billing));
    if (billing.status === "cancelled") {
      await sql`update checkouts set status = 'failed' where id = ${checkout.id} and status = 'created'`;
    }
    return false;
  }

  let order = await getOrder(conn, checkout.paypal_id);
  if (order.status === "APPROVED") order = await captureOrder(conn, checkout.paypal_id);
  if (order.status === "COMPLETED") return !!(await completeCheckout(appId, checkout.id, null));
  return false;
}

// Checks an account's recent unpaid checkouts with PayPal, for flows where no
// browser calls /complete (emailed or agent-shown links before the webhook
// arrives). Returns true when one of them was just paid.
export async function syncOpenCheckouts(appId: string, accountId: string): Promise<boolean> {
  const open = await sql`
    select * from checkouts
    where app_id = ${appId} and account_id = ${accountId} and status = 'created'
      and paypal_id is not null and created_at > now() - interval '1 day'
    order by created_at desc limit 3`;
  let completed = false;
  for (const checkout of open) {
    try {
      completed = (await syncCheckout(appId, checkout)) || completed;
    } catch (err) {
      console.error(`checkout ${checkout.id} sync failed:`, err);
    }
  }
  return completed;
}
