import { Hono } from "hono";
import type { Context } from "hono";
import sql from "../db/client.ts";
import { limitParam, readJson, readObject, readOptionalJson } from "../lib/http.ts";
import { prefixedId } from "../lib/ids.ts";
import { ALL_EVENTS, isWebhookEventType, sampleEventData } from "../lib/webhook-events.ts";
import {
  attemptDelivery,
  createSecret,
  listDeliveries,
  listEndpoints,
  MAX_ENDPOINTS_PER_APP,
  parseEvents,
  sendTest,
  urlError,
} from "../lib/webhooks.ts";

const webhooks = new Hono();

const notFound = { error: "Webhook endpoint not found" };

async function findEndpoint(c: Context) {
  const [endpoint] = await listEndpoints(c.req.param("appId")!, c.req.param("webhookId")!);
  return endpoint ?? null;
}

// GET /apps/:appId/webhooks
webhooks.get("/", async (c) => {
  return c.json(await listEndpoints(c.req.param("appId")!));
});

// POST /apps/:appId/webhooks  body: { url, events, description?, source?, enabled? }
webhooks.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { url, events: rawEvents, description, source = "custom", enabled } = (await readJson(c)) ?? {};

  const badUrl = urlError(url);
  if (badUrl) return c.json({ error: badUrl }, 400);
  const events = parseEvents(rawEvents);
  if (typeof events === "string") return c.json({ error: events }, 400);
  if (source !== "custom" && source !== "zapier") {
    return c.json({ error: 'source must be "custom" or "zapier"' }, 400);
  }

  const [{ app, count }] = await sql`
    select exists (select 1 from apps where id = ${appId}) as app,
           (select count(*)::int from webhook_endpoints where app_id = ${appId}) as count`;
  if (!app) return c.json({ error: "App not found" }, 404);
  if (count >= MAX_ENDPOINTS_PER_APP) {
    return c.json({ error: `An app can have at most ${MAX_ENDPOINTS_PER_APP} webhook endpoints` }, 400);
  }

  const id = prefixedId("whk", 16);
  await sql`
    insert into webhook_endpoints (id, app_id, url, description, events, enabled, source, secret)
    values (${id}, ${appId}, ${url}, ${typeof description === "string" ? description : null},
            ${events}::jsonb, ${typeof enabled === "boolean" ? enabled : true}, ${source}, ${createSecret()})`;

  const [endpoint] = await listEndpoints(appId, id);
  return c.json(endpoint, 201);
});

// GET /apps/:appId/webhooks/:webhookId
webhooks.get("/:webhookId", async (c) => {
  const endpoint = await findEndpoint(c);
  if (!endpoint) return c.json(notFound, 404);
  return c.json(endpoint);
});

// PATCH /apps/:appId/webhooks/:webhookId  body: any of { url, events, description, enabled }
// Other keys are ignored. Re-enabling clears disabled_reason.
webhooks.patch("/:webhookId", async (c) => {
  const appId = c.req.param("appId")!;
  const webhookId = c.req.param("webhookId");
  const body = await readObject(c);

  if ("url" in body) {
    const badUrl = urlError(body.url);
    if (badUrl) return c.json({ error: badUrl }, 400);
  }
  let events: string[] | null = null;
  if ("events" in body) {
    const parsed = parseEvents(body.events);
    if (typeof parsed === "string") return c.json({ error: parsed }, 400);
    events = parsed;
  }
  const url: string | null = "url" in body ? body.url : null;
  const setDescription = typeof body.description === "string" || body.description === null;
  const description: string | null = setDescription ? body.description : null;
  const enabled: boolean | null = typeof body.enabled === "boolean" ? body.enabled : null;

  const rows = await sql`
    update webhook_endpoints set
      url = coalesce(${url}::text, url),
      events = coalesce(${events}::jsonb, events),
      description = case when ${setDescription}::boolean then ${description}::text else description end,
      enabled = coalesce(${enabled}::boolean, enabled),
      disabled_reason = case when ${enabled}::boolean then null else disabled_reason end,
      updated_at = now()
    where app_id = ${appId} and id = ${webhookId}
    returning id`;
  if (!rows.length) return c.json(notFound, 404);

  return c.json((await findEndpoint(c))!);
});

// DELETE /apps/:appId/webhooks/:webhookId
// Also deletes the endpoint's deliveries.
webhooks.delete("/:webhookId", async (c) => {
  const rows = await sql`
    delete from webhook_endpoints
    where app_id = ${c.req.param("appId")!} and id = ${c.req.param("webhookId")}
    returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

// POST /apps/:appId/webhooks/:webhookId/secret/regenerate
webhooks.post("/:webhookId/secret/regenerate", async (c) => {
  const secret = createSecret();
  const rows = await sql`
    update webhook_endpoints set secret = ${secret}, updated_at = now()
    where app_id = ${c.req.param("appId")!} and id = ${c.req.param("webhookId")}
    returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ secret });
});

// POST /apps/:appId/webhooks/:webhookId/test  body (optional): { type? }
// Sends a sample event once, synchronously, even if the endpoint is disabled.
// Defaults to the endpoint's first event type (account.created for "*").
webhooks.post("/:webhookId/test", async (c) => {
  const appId = c.req.param("appId")!;
  const endpoint = await findEndpoint(c);
  if (!endpoint) return c.json(notFound, 404);

  const { type: requested } = (await readOptionalJson(c)) ?? {};
  const type = requested ?? (endpoint.events[0] === ALL_EVENTS ? "account.created" : endpoint.events[0]);
  if (!isWebhookEventType(type)) return c.json({ error: `Unknown event type "${String(type)}"` }, 400);

  return c.json(await sendTest(appId, endpoint.id, type, sampleEventData(type, appId)));
});

// GET /apps/:appId/webhooks/:webhookId/deliveries?limit=50&status=failed
webhooks.get("/:webhookId/deliveries", async (c) => {
  const endpoint = await findEndpoint(c);
  if (!endpoint) return c.json(notFound, 404);
  return c.json(
    await listDeliveries({
      endpointId: endpoint.id,
      status: c.req.query("status") || undefined,
      limit: limitParam(c, 50),
    }),
  );
});

// POST /apps/:appId/webhooks/:webhookId/deliveries/:deliveryId/retry
// One synchronous attempt; a failed manual retry stays failed (no more retries).
webhooks.post("/:webhookId/deliveries/:deliveryId/retry", async (c) => {
  const [row] = await sql`
    select d.id
    from webhook_deliveries d
    join webhook_endpoints e on e.id = d.endpoint_id
    where d.id = ${c.req.param("deliveryId")} and e.id = ${c.req.param("webhookId")}
      and e.app_id = ${c.req.param("appId")!}`;
  if (!row) return c.json({ error: "Delivery not found" }, 404);
  return c.json(await attemptDelivery(row.id, { final: true }));
});

export default webhooks;
