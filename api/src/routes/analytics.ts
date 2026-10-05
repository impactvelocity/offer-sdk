import { Hono } from "hono";
import type { Context } from "hono";
import sql from "../db/client.ts";
import { deleteDoc, getDoc, insertDoc, listDocs, mergeDoc } from "../db/docs.ts";
import { prefixedId } from "../lib/ids.ts";
import { type Json, readJson, readObject } from "../lib/http.ts";

// Replaces the Tinybird pipes: aggregates the usage_events table directly.
const analytics = new Hono();

const INTERVAL_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "6m": 180,
  year: 365,
  alltime: 0, // 0 = no date filter
};

function intervalDays(c: Context, interval: string) {
  if (!(interval in INTERVAL_DAYS)) {
    return c.json({ error: `interval must be one of: ${Object.keys(INTERVAL_DAYS).join(", ")}` }, 400);
  }
  return INTERVAL_DAYS[interval] || null;
}

// GET /apps/:appId/analytics/top-namespaces?interval=7d&limit=10&entitlement=xxx
analytics.get("/top-namespaces", async (c) => {
  const days = intervalDays(c, c.req.query("interval") ?? "7d");
  if (days instanceof Response) return days;

  const limit = parseInt(c.req.query("limit") ?? "10", 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return c.json({ error: "limit must be between 1 and 100" }, 400);
  }

  const entitlement = c.req.query("entitlement") ?? null;

  const rows = await sql`
    select namespace_id, count(*)::float8 as calls, coalesce(sum(amount), 0)::float8 as total_amount
    from usage_events
    where app_id = ${c.req.param("appId")!}
      and (${entitlement}::text is null or entitlement_id = ${entitlement})
      and (${days}::int is null or created_at >= now() - make_interval(days => ${days}::int))
    group by namespace_id
    order by calls desc, namespace_id
    limit ${limit}`;
  return c.json(rows);
});

// GET /apps/:appId/analytics?interval=7d&namespace=user_abc
analytics.get("/", async (c) => {
  const interval = c.req.query("interval");
  if (!interval) return c.json({ error: "interval is required" }, 400);

  const days = intervalDays(c, interval);
  if (days instanceof Response) return days;

  const namespace = c.req.query("namespace") ?? null;

  const rows = await sql`
    select entitlement_id, count(*)::float8 as calls, coalesce(sum(amount), 0)::float8 as total_amount
    from usage_events
    where app_id = ${c.req.param("appId")!}
      and (${namespace}::text is null or namespace_id = ${namespace})
      and (${days}::int is null or created_at >= now() - make_interval(days => ${days}::int))
    group by entitlement_id
    order by calls desc, entitlement_id`;
  return c.json(rows);
});

// GET /apps/:appId/analytics/timeseries?interval=30d&namespace=user_abc&entitlement=xxx
// Daily buckets for intervals up to 60 days, weekly (starting Monday) beyond that.
analytics.get("/timeseries", async (c) => {
  const interval = c.req.query("interval") ?? "30d";
  const days = intervalDays(c, interval);
  if (days instanceof Response) return days;

  const unit = ["7d", "30d", "60d"].includes(interval) ? "day" : "week";
  const namespace = c.req.query("namespace") ?? null;
  const entitlement = c.req.query("entitlement") ?? null;

  const rows = await sql`
    select to_char(date_trunc(${unit}, created_at at time zone 'UTC'), 'YYYY-MM-DD') as date,
           entitlement_id, count(*)::float8 as calls, coalesce(sum(amount), 0)::float8 as total_amount
    from usage_events
    where app_id = ${c.req.param("appId")!}
      and (${namespace}::text is null or namespace_id = ${namespace})
      and (${entitlement}::text is null or entitlement_id = ${entitlement})
      and (${days}::int is null or created_at >= now() - make_interval(days => ${days}::int))
    group by 1, 2
    order by 1, 2`;
  return c.json(rows);
});

// GET /apps/:appId/analytics/events?namespace=user_abc&entitlement=xxx&limit=50
// Most recent usage events first.
analytics.get("/events", async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") ?? "", 10) || 50, 1), 200);
  const namespace = c.req.query("namespace") ?? null;
  const entitlement = c.req.query("entitlement") ?? null;

  const rows = await sql`
    select id::float8 as id, namespace_id, entitlement_id, operation,
           amount::float8 as amount, count::float8 as count, created_at
    from usage_events
    where app_id = ${c.req.param("appId")!}
      and (${namespace}::text is null or namespace_id = ${namespace})
      and (${entitlement}::text is null or entitlement_id = ${entitlement})
    order by created_at desc, id desc
    limit ${limit}`;
  return c.json(rows);
});

// Saved reports: a named view of the analytics page (which entitlements, which
// period). The numbers are always computed live.

const MAX_REPORTS_PER_APP = 50;
const reportNotFound = { error: "Report not found" };

// Validates report fields; `partial` allows any subset (PATCH).
function reportFields(input: Json, partial: boolean): Json | { error: string } {
  const out: Json = {};
  if (!partial || "name" in input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 80) return { error: "name is required (1–80 characters)" };
    out.name = name;
  }
  if (!partial || "entitlements" in input) {
    const ids = input.entitlements ?? [];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
      return { error: "entitlements must be an array of entitlement ids" };
    }
    if (ids.length > 20) return { error: "A report can include at most 20 entitlements" };
    out.entitlements = [...new Set(ids as string[])];
  }
  if (!partial || "interval" in input) {
    const interval = input.interval ?? "30d";
    if (!(interval in INTERVAL_DAYS)) {
      return { error: `interval must be one of: ${Object.keys(INTERVAL_DAYS).join(", ")}` };
    }
    out.interval = interval;
  }
  return out;
}

// GET /apps/:appId/analytics/reports
analytics.get("/reports", async (c) => c.json(await listDocs("analytics_reports", c.req.param("appId")!)));

// POST /apps/:appId/analytics/reports  body: { name, entitlements?, interval? }
analytics.post("/reports", async (c) => {
  const appId = c.req.param("appId")!;
  const fields = reportFields((await readJson(c)) ?? {}, false);
  if ("error" in fields) return c.json(fields, 400);

  const [{ n }] = await sql`select count(*)::int as n from analytics_reports where app_id = ${appId}`;
  if (n >= MAX_REPORTS_PER_APP) {
    return c.json({ error: `An app can have at most ${MAX_REPORTS_PER_APP} saved reports` }, 400);
  }

  const now = new Date().toISOString();
  const report = { id: prefixedId("rpt", 16), app_id: appId, ...fields, created_at: now, updated_at: now };
  await insertDoc("analytics_reports", appId, report.id, report);
  return c.json(report, 201);
});

// GET /apps/:appId/analytics/reports/:id
analytics.get("/reports/:id", async (c) => {
  const report = await getDoc("analytics_reports", c.req.param("appId")!, c.req.param("id"));
  return report ? c.json(report) : c.json(reportNotFound, 404);
});

// PATCH /apps/:appId/analytics/reports/:id
analytics.patch("/reports/:id", async (c) => {
  const fields = reportFields(await readObject(c), true);
  if ("error" in fields) return c.json(fields, 400);
  const report = await mergeDoc("analytics_reports", c.req.param("appId")!, c.req.param("id"), {
    ...fields,
    updated_at: new Date().toISOString(),
  });
  return report ? c.json(report) : c.json(reportNotFound, 404);
});

// DELETE /apps/:appId/analytics/reports/:id
analytics.delete("/reports/:id", async (c) => {
  const deleted = await deleteDoc("analytics_reports", c.req.param("appId")!, c.req.param("id"));
  return deleted ? c.json({ deleted: true }) : c.json(reportNotFound, 404);
});

export default analytics;
