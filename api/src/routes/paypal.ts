import { Hono } from "hono";
import sql from "../db/client.ts";
import { readObject } from "../lib/http.ts";
import { createWebhook, forgetToken, PaypalError, verifyCredentials, type PaypalEnv } from "../lib/paypal.ts";
import { encryptSecret } from "../lib/secrets.ts";
import { isPrivateHost } from "../lib/webhooks.ts";

// Each app connects its own PayPal REST app (client id + secret, sandbox or live).
const paypal = new Hono();

const connectionJson = (row: { env: string; client_id: string; webhook_id: string | null; updated_at: Date }) => ({
  connected: true,
  env: row.env,
  client_id: row.client_id,
  webhook: row.webhook_id ? "registered" : "not_registered",
  updated_at: new Date(row.updated_at).toISOString(),
});

// Where PayPal sends this app's webhooks. PayPal only accepts public HTTPS
// URLs, so local development skips registration (checkouts still complete when
// the SDK calls /checkouts/:id/complete).
function webhookUrl(appId: string): string | null {
  const base = process.env.PUBLIC_API_URL;
  if (!base) return null;
  const url = new URL(`/paypal/webhooks/${appId}`, base);
  return url.protocol === "https:" && !isPrivateHost(url.hostname) ? url.toString() : null;
}

// GET /apps/:appId/paypal
paypal.get("/", async (c) => {
  const [row] = await sql`
    select env, client_id, webhook_id, updated_at from paypal_connections where app_id = ${c.req.param("appId")!}`;
  return c.json(row ? connectionJson(row) : { connected: false });
});

// PUT /apps/:appId/paypal
// Body: { client_id, client_secret, env: "sandbox" | "live" }. Checks the
// credentials with PayPal and registers the webhook when the API is public.
paypal.put("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { client_id, client_secret, env = "sandbox" } = await readObject(c);
  if (typeof client_id !== "string" || !client_id) return c.json({ error: "client_id is required" }, 400);
  if (typeof client_secret !== "string" || !client_secret) return c.json({ error: "client_secret is required" }, 400);
  if (env !== "sandbox" && env !== "live") return c.json({ error: 'env must be "sandbox" or "live"' }, 400);

  const creds = { app_id: appId, env: env as PaypalEnv, client_id, client_secret };
  forgetToken(appId);
  try {
    await verifyCredentials(creds);
  } catch (err) {
    if (err instanceof PaypalError) return c.json({ error: `PayPal rejected these credentials: ${err.message}` }, 400);
    throw err;
  }

  const [previous] = await sql`select client_id, env, webhook_id from paypal_connections where app_id = ${appId}`;
  const sameAccount = previous?.client_id === client_id && previous?.env === env;

  let webhookId: string | null = sameAccount ? previous.webhook_id : null;
  const url = webhookUrl(appId);
  if (!webhookId && url) {
    try {
      webhookId = await createWebhook(creds, url);
    } catch (err) {
      // Usually "webhook URL already exists" for this PayPal app; the connection still works.
      console.error("PayPal webhook registration failed:", err);
    }
  }

  // A different PayPal account has its own products and plans.
  if (previous && !sameAccount) await sql`delete from paypal_plans where app_id = ${appId}`;

  const [row] = await sql`
    insert into paypal_connections (app_id, env, client_id, client_secret, webhook_id)
    values (${appId}, ${env}, ${client_id}, ${encryptSecret(client_secret)}, ${webhookId})
    on conflict (app_id) do update set
      env = excluded.env,
      client_id = excluded.client_id,
      client_secret = excluded.client_secret,
      webhook_id = excluded.webhook_id,
      product_id = case when ${sameAccount} then paypal_connections.product_id else null end,
      updated_at = now()
    returning env, client_id, webhook_id, updated_at`;
  return c.json(connectionJson(row));
});

// DELETE /apps/:appId/paypal
// Existing PayPal subscriptions keep billing; their webhooks can no longer be verified.
paypal.delete("/", async (c) => {
  const appId = c.req.param("appId")!;
  forgetToken(appId);
  const rows = await sql`delete from paypal_connections where app_id = ${appId} returning app_id`;
  await sql`delete from paypal_plans where app_id = ${appId}`;
  if (!rows.length) return c.json({ error: "PayPal is not connected" }, 404);
  return c.json({ deleted: true });
});

export default paypal;
