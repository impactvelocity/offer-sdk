import { Hono } from "hono";
import sql from "../db/client.ts";
import { applySubscriptionBilling, billingFromSubscription, completeCheckout } from "../lib/grants.ts";
import type { Json } from "../lib/http.ts";
import { getConnection, getSubscription, verifyWebhook } from "../lib/paypal.ts";

// POST /paypal/webhooks/:appId
// PayPal's notifications for one app. Each delivery is verified with PayPal,
// handled once (PayPal retries until it gets a 2xx) and mapped onto checkouts
// and accounts.
const paypalWebhooks = new Hono();

async function createdCheckout(appId: string, paypalId: string) {
  const [row] = await sql`
    select id from checkouts where app_id = ${appId} and paypal_id = ${paypalId} and status = 'created'`;
  return row?.id as string | undefined;
}

async function handle(appId: string, event: Json) {
  const resource: Json = event.resource ?? {};
  const type: string = event.event_type;

  if (type.startsWith("BILLING.SUBSCRIPTION.")) {
    const billing = billingFromSubscription(resource);
    const checkoutId = await createdCheckout(appId, resource.id);
    if (checkoutId && billing.status === "active") await completeCheckout(appId, checkoutId, billing);
    else await applySubscriptionBilling(appId, resource.id, billing);
    return;
  }

  // Subscription payments (first charge and renewals). The sale doesn't carry
  // billing details, so read the subscription itself.
  if (type === "PAYMENT.SALE.COMPLETED" && resource.billing_agreement_id) {
    const conn = await getConnection(appId);
    if (!conn) return;
    const subscriptionId: string = resource.billing_agreement_id;
    const billing = billingFromSubscription(await getSubscription(conn, subscriptionId));
    const checkoutId = await createdCheckout(appId, subscriptionId);
    if (checkoutId && billing.status === "active") await completeCheckout(appId, checkoutId, billing);
    else await applySubscriptionBilling(appId, subscriptionId, billing);
    return;
  }

  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    const checkoutId = orderId ? await createdCheckout(appId, orderId) : undefined;
    if (checkoutId) await completeCheckout(appId, checkoutId, null);
  }
}

paypalWebhooks.post("/:appId", async (c) => {
  const appId = c.req.param("appId");
  let event: Json;
  try {
    event = JSON.parse(await c.req.text());
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof event?.id !== "string" || typeof event?.event_type !== "string") {
    return c.json({ error: "Not a PayPal event" }, 400);
  }

  const conn = await getConnection(appId);
  if (!conn) return c.json({ error: "PayPal is not connected for this app" }, 404);
  if (!(await verifyWebhook(conn, c.req.raw.headers, event))) return c.json({ error: "Invalid signature" }, 400);

  const [fresh] = await sql`
    insert into paypal_webhook_events (app_id, id, type) values (${appId}, ${event.id}, ${event.event_type})
    on conflict do nothing returning id`;
  if (!fresh) return c.json({ ok: true, duplicate: true });

  try {
    await handle(appId, event);
  } catch (err) {
    // Forget the event so PayPal's retry is handled again.
    await sql`delete from paypal_webhook_events where app_id = ${appId} and id = ${event.id}`;
    console.error(`PayPal webhook ${event.event_type} failed:`, err);
    return c.json({ error: "Webhook handling failed" }, 500);
  }
  return c.json({ ok: true });
});

export default paypalWebhooks;
