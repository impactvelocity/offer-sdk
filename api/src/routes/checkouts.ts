import { Hono } from "hono";
import sql from "../db/client.ts";
import { syncCheckout } from "../lib/checkout.ts";
import { checkoutJson } from "../lib/grants.ts";
import { ApiError, type Json, limitParam } from "../lib/http.ts";
import { PaypalError } from "../lib/paypal.ts";

const checkouts = new Hono();

const notFound = { error: "Checkout not found" };

async function findCheckout(appId: string, id: string): Promise<Json | null> {
  const [row] = await sql`select * from checkouts where app_id = ${appId} and id = ${id}`;
  return row ?? null;
}

// GET /apps/:appId/checkouts?offer=&status=&limit=
checkouts.get("/", async (c) => {
  const appId = c.req.param("appId")!;
  const offer = c.req.query("offer") ?? null;
  const status = c.req.query("status") ?? null;
  const rows = await sql`
    select * from checkouts
    where app_id = ${appId}
      and (${offer}::text is null or offer_id = ${offer})
      and (${status}::text is null or status = ${status})
    order by created_at desc
    limit ${limitParam(c, 50)}`;
  return c.json(rows.map(checkoutJson));
});

// GET /apps/:appId/checkouts/:checkoutId (publishable key)
checkouts.get("/:checkoutId", async (c) => {
  const checkout = await findCheckout(c.req.param("appId")!, c.req.param("checkoutId"));
  if (!checkout) return c.json(notFound, 404);
  return c.json(checkoutJson(checkout));
});

// POST /apps/:appId/checkouts/:checkoutId/complete (publishable key)
// Called by the SDK after the buyer approves in PayPal. Checks the payment with
// PayPal (captures one-time orders) and applies the purchase. Returns
// `status: "created"` while PayPal is still activating; call again shortly.
checkouts.post("/:checkoutId/complete", async (c) => {
  const appId = c.req.param("appId")!;
  const checkout = await findCheckout(appId, c.req.param("checkoutId"));
  if (!checkout) return c.json(notFound, 404);

  try {
    await syncCheckout(appId, checkout);
  } catch (err) {
    if (err instanceof PaypalError) throw new ApiError(502, `PayPal: ${err.message}`);
    throw err;
  }
  return c.json(checkoutJson((await findCheckout(appId, checkout.id))!));
});

export default checkouts;
