import { Hono } from "hono";
import sql from "../db/client.ts";
import { ApiError, type Json, readObject } from "../lib/http.ts";

// POST /apps/:appId/import   (admin key only)
//   body: {
//     namespaces?:   [{ id, created_at }],
//     usage_events?: [{ namespace_id, entitlement_id, operation, amount, created_at }],
//   }
//
// Brings in history from before this API: backdates accounts and records past usage
// events (counters move by their total, and each event's `count` continues from the
// counter). Used to migrate from another system and by the dashboard's demo seed.
// No webhooks fire for imported events.

const history = new Hono();

const MAX_ITEMS = 10_000;
const OPERATIONS = new Set(["add", "remove", "amount"]);

function timestamp(value: unknown, field: string): string {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) throw new ApiError(400, `${field} must be an ISO timestamp`);
  if (date.getTime() > Date.now() + 60_000) throw new ApiError(400, `${field} can't be in the future`);
  return date.toISOString();
}

function list(body: Json, key: string): Json[] {
  const value = body[key] ?? [];
  if (!Array.isArray(value)) throw new ApiError(400, `${key} must be an array`);
  if (value.length > MAX_ITEMS) throw new ApiError(400, `At most ${MAX_ITEMS} ${key} per request`);
  return value;
}

history.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const body = await readObject(c);

  const namespaces = list(body, "namespaces").map((n, i) => {
    if (typeof n?.id !== "string" || !n.id) throw new ApiError(400, `namespaces[${i}].id is required`);
    return { id: n.id, created_at: timestamp(n.created_at, `namespaces[${i}].created_at`) };
  });

  const events = list(body, "usage_events").map((e, i) => {
    const at = `usage_events[${i}]`;
    if (typeof e?.namespace_id !== "string" || typeof e?.entitlement_id !== "string") {
      throw new ApiError(400, `${at} needs namespace_id and entitlement_id`);
    }
    if (!OPERATIONS.has(e.operation)) throw new ApiError(400, `${at}.operation must be add, remove or amount`);
    if (!Number.isInteger(e.amount)) throw new ApiError(400, `${at}.amount must be an integer`);
    return {
      namespace_id: e.namespace_id,
      entitlement_id: e.entitlement_id,
      operation: e.operation,
      amount: e.amount,
      created_at: timestamp(e.created_at, `${at}.created_at`),
    };
  });

  // Every account and entitlement must exist (usage ones only) before anything is written.
  const [missing] = await sql`
    with wanted as (
      select distinct namespace_id, entitlement_id
      from jsonb_to_recordset(${{ events }}::jsonb -> 'events') as e(namespace_id text, entitlement_id text)
    )
    select
      (select string_agg(distinct w.namespace_id, ', ') from wanted w
        where not exists (select 1 from namespaces n where n.app_id = ${appId} and n.id = w.namespace_id)) as namespaces,
      (select string_agg(distinct w.entitlement_id, ', ') from wanted w
        where not exists (select 1 from entitlements x where x.app_id = ${appId} and x.id = w.entitlement_id
          and x.data ->> 'type' = 'usage')) as entitlements`;
  if (missing.namespaces) throw new ApiError(404, `Unknown accounts: ${missing.namespaces}`);
  if (missing.entitlements) throw new ApiError(400, `Unknown or non-usage entitlements: ${missing.entitlements}`);

  const result = await sql.begin(async (tx) => {
    const backdated = await tx`
      with input as (
        select * from jsonb_to_recordset(${{ namespaces }}::jsonb -> 'namespaces') as n(id text, created_at timestamptz)
      )
      update namespaces n
      set created_at = i.created_at, data = jsonb_set(n.data, '{created_at}', to_jsonb(i.created_at))
      from input i
      where n.app_id = ${appId} and n.id = i.id
      returning n.id`;

    // Each event's count continues from the counter as it was before the import.
    const imported = await tx`
      with input as (
        select * from rows from (
          jsonb_to_recordset(${{ events }}::jsonb -> 'events')
            as (namespace_id text, entitlement_id text, operation text, amount bigint, created_at timestamptz)
        ) with ordinality as e(namespace_id, entitlement_id, operation, amount, created_at, ord)
      )
      insert into usage_events (app_id, namespace_id, entitlement_id, operation, amount, count, created_at)
      select ${appId}, i.namespace_id, i.entitlement_id, i.operation, i.amount,
             coalesce(c.count, 0) + sum(i.amount) over (
               partition by i.namespace_id, i.entitlement_id order by i.created_at, i.ord rows unbounded preceding),
             i.created_at
      from input i
      left join usage_counters c
        on c.app_id = ${appId} and c.namespace_id = i.namespace_id and c.entitlement_id = i.entitlement_id
      order by i.created_at, i.ord
      returning id`;

    await tx`
      insert into usage_counters (app_id, namespace_id, entitlement_id, count)
      select ${appId}, namespace_id, entitlement_id, sum(amount)
      from jsonb_to_recordset(${{ events }}::jsonb -> 'events') as e(namespace_id text, entitlement_id text, amount bigint)
      group by namespace_id, entitlement_id
      on conflict (app_id, namespace_id, entitlement_id)
      do update set count = usage_counters.count + excluded.count, updated_at = now()`;

    return { namespaces: backdated.length, usage_events: imported.length };
  });

  return c.json({ imported: result });
});

export default history;
