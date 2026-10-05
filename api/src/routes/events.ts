import { Hono } from "hono";
import sql from "../db/client.ts";
import { limitParam } from "../lib/http.ts";
import { isWebhookEventType, sampleEventData, WEBHOOK_EVENTS } from "../lib/webhook-events.ts";
import { eventPayload } from "../lib/webhooks.ts";

// The webhook event log of an app. Test events are left out.
const events = new Hono();

// GET /apps/:appId/events?type=account.created&limit=20
events.get("/", async (c) => {
  const type = c.req.query("type") || null;
  if (type && !isWebhookEventType(type)) return c.json({ error: `Unknown event type "${type}"` }, 400);

  const rows = await sql`
    select id, type, created_at, app_id, data, test
    from webhook_events
    where app_id = ${c.req.param("appId")!} and not test
      and (${type}::text is null or type = ${type})
    order by created_at desc, id desc
    limit ${limitParam(c, 20)}`;
  return c.json(rows.map(eventPayload));
});

// GET /event-types (no auth): the catalog with a sample `data` for each type.
export const eventTypes = new Hono();

eventTypes.get("/", (c) => {
  return c.json(
    WEBHOOK_EVENTS.map(({ type, category, title, description }) => ({
      type,
      category,
      title,
      description,
      sample: sampleEventData(type, "app_123"),
    })),
  );
});

export default events;
