import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sql from "../db/client.ts";
import type { Json } from "./http.ts";
import { prefixedId } from "./ids.ts";
import { ALL_EVENTS, diffPrevious, isWebhookEventType, type WebhookEventType } from "./webhook-events.ts";

// Seconds to wait after each failed attempt: 7 attempts in total, then `failed`.
const RETRY_DELAYS = [60, 300, 1800, 7200, 28800, 86400];
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 1024;
const USER_AGENT = "OfferSDK-Webhooks/1.0";

export const MAX_ENDPOINTS_PER_APP = 25;

const allowPrivate = () => process.env.WEBHOOKS_ALLOW_PRIVATE_URLS === "true";

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

// ─── Validation ────────────────────────────────────────

function isPrivateIPv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// Loopback, private, link-local and internal-only hostnames and IP literals.
// Only looks at the name itself; attemptDelivery() also checks what it resolves to.
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return true;
  if (isPrivateIPv4(host)) return true;
  if (isIP(host) !== 6) return false;
  if (host === "::" || host === "::1") return true;

  // IPv4-mapped, either dotted (::ffff:127.0.0.1) or as URL normalises it (::ffff:7f00:1).
  const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) return isPrivateIPv4(dotted);
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }

  const first = host.startsWith("::") ? 0 : parseInt(host.split(":")[0], 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80; // fc00::/7, fe80::/10
}

// Returns an error message, or null when the URL is acceptable.
export function urlError(value: unknown): string | null {
  const invalid = "url must be a valid http(s) URL";
  if (typeof value !== "string" || value.length > 2048) return invalid;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return invalid;
  if (!allowPrivate() && isPrivateHost(url.hostname)) return "url must point to a public address";
  return null;
}

// Normalised event list ("*" alone, no duplicates), or an error message.
export function parseEvents(value: unknown): string[] | string {
  if (!Array.isArray(value) || value.length === 0) return "events must be a non-empty array";
  for (const type of value) {
    if (type !== ALL_EVENTS && !isWebhookEventType(type)) return `Unknown event type "${String(type)}"`;
  }
  return value.includes(ALL_EVENTS) ? [ALL_EVENTS] : [...new Set(value as string[])];
}

export function createSecret() {
  return `whsec_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64")}`;
}

// ─── JSON shapes ───────────────────────────────────────

// The exact body POSTed to endpoints, also returned by GET /events.
export function eventPayload(row: Json) {
  return {
    id: row.id,
    type: row.type,
    created_at: iso(row.created_at),
    app_id: row.app_id,
    data: row.data,
    ...(row.test ? { test: true } : {}),
  };
}

export function endpointJson(row: Json) {
  return {
    id: row.id,
    app_id: row.app_id,
    url: row.url,
    description: row.description,
    events: row.events,
    enabled: row.enabled,
    source: row.source,
    secret: row.secret,
    disabled_reason: row.disabled_reason,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    stats: {
      total: row.total,
      succeeded: row.succeeded,
      failed: row.failed,
      pending: row.pending,
      last_delivery_at: iso(row.last_delivery_at),
      last_status: row.last_status,
      last_response_status: row.last_response_status,
    },
  };
}

// Rows come from listDeliveries(): the delivery joined with its event (ev_* columns).
function deliveryJson(row: Json) {
  return {
    id: row.id,
    endpoint_id: row.endpoint_id,
    event_id: row.event_id,
    event_type: row.ev_type,
    status: row.status,
    attempts: row.attempts,
    next_attempt_at: iso(row.next_attempt_at),
    last_attempt_at: iso(row.last_attempt_at),
    response_status: row.response_status,
    response_body: row.response_body,
    error: row.error,
    duration_ms: row.duration_ms,
    test: row.test,
    created_at: iso(row.created_at),
    payload: eventPayload({
      id: row.event_id,
      type: row.ev_type,
      created_at: row.ev_created_at,
      app_id: row.ev_app_id,
      data: row.ev_data,
      test: row.test,
    }),
  };
}

// ─── Queries ───────────────────────────────────────────

// Endpoints with their delivery stats in one query (lateral joins on the
// endpoint+created_at index). Test deliveries don't count.
export async function listEndpoints(appId: string, id: string | null = null) {
  const rows = await sql`
    select e.*, s.total, s.succeeded, s.failed, s.pending,
           l.status as last_status, l.response_status as last_response_status,
           coalesce(l.last_attempt_at, l.created_at) as last_delivery_at
    from webhook_endpoints e
    cross join lateral (
      select count(*)::int as total,
             (count(*) filter (where status = 'succeeded'))::int as succeeded,
             (count(*) filter (where status = 'failed'))::int as failed,
             (count(*) filter (where status = 'pending'))::int as pending
      from webhook_deliveries
      where endpoint_id = e.id and not test and created_at > now() - interval '7 days'
    ) s
    left join lateral (
      select status, response_status, last_attempt_at, created_at
      from webhook_deliveries
      where endpoint_id = e.id and not test
      order by created_at desc, id desc
      limit 1
    ) l on true
    where e.app_id = ${appId} and (${id}::text is null or e.id = ${id})
    order by e.created_at, e.id`;
  return rows.map(endpointJson);
}

// Deliveries of one endpoint (newest first), or a single delivery by id.
export async function listDeliveries(params: {
  endpointId?: string;
  id?: string;
  status?: string;
  limit?: number;
}) {
  const endpointId = params.endpointId ?? null;
  const id = params.id ?? null;
  const status = params.status ?? null;
  const rows = await sql`
    select d.*, ev.type as ev_type, ev.app_id as ev_app_id, ev.data as ev_data, ev.created_at as ev_created_at
    from webhook_deliveries d
    join webhook_events ev on ev.id = d.event_id
    where (${endpointId}::text is null or d.endpoint_id = ${endpointId})
      and (${id}::text is null or d.id = ${id})
      and (${status}::text is null or d.status = ${status})
    order by d.created_at desc, d.id desc
    limit ${params.limit ?? 1}`;
  return rows.map(deliveryJson);
}

// ─── Emitting ──────────────────────────────────────────

// The worker registers itself here so new deliveries go out right away.
let wake = () => {};
export function onDeliveriesQueued(fn: () => void) {
  wake = fn;
}

// Records the event and queues a delivery for every enabled endpoint subscribed
// to it, in one statement. Never throws: a webhook problem must not fail the
// API request that caused it.
export async function emit(appId: string, type: WebhookEventType, data: Json) {
  try {
    const rows = await sql`
      with event as (
        insert into webhook_events (id, app_id, type, data)
        values (${prefixedId("evt", 24)}, ${appId}, ${type}, ${data}::jsonb)
        returning id, created_at
      )
      insert into webhook_deliveries (id, endpoint_id, event_id, next_attempt_at, created_at)
      select webhook_random_id('whd', 24), e.id, event.id, event.created_at, event.created_at
      from webhook_endpoints e, event
      where e.app_id = ${appId} and e.enabled and (e.events ? ${type} or e.events ? '*')
      returning id`;
    if (rows.length) wake();
  } catch (err) {
    console.error(`webhook emit ${type} failed:`, err);
  }
}

// `<type>.updated` with the old values of changed fields; nothing if nothing changed.
export async function emitUpdated(appId: string, type: WebhookEventType, before: Json, after: Json) {
  const previous = diffPrevious(before, after);
  if (Object.keys(previous).length) await emit(appId, type, { object: after, previous });
}

// account.updated, plus the specific plan/incentive events, for a namespace change.
export async function emitAccountChanges(appId: string, before: Json, after: Json) {
  const previous = diffPrevious(before, after);
  if (!Object.keys(previous).length) return;
  await emit(appId, "account.updated", { object: after, previous });

  if ((before.plan ?? null) !== (after.plan ?? null)) {
    await emit(appId, "account.plan_changed", { object: after, previous: { plan: before.plan ?? null } });
  }
  const incentive = before.incentive ?? null;
  if (incentive !== (after.incentive ?? null)) {
    const type = after.incentive ? "account.incentive_applied" : "account.incentive_removed";
    await emit(appId, type, { object: after, previous: { incentive } });
  }
}

// Usage events are only computed when someone listens, to keep the usage path cheap.
export async function hasUsageSubscribers(appId: string): Promise<boolean> {
  const [row] = await sql`
    select exists (
      select 1 from webhook_endpoints
      where app_id = ${appId} and enabled
        and events ?| array['usage.limit_warning', 'usage.limit_reached', '*']
    ) as yes`;
  return row.yes;
}

// Stores a test event (hidden from GET /events and stats) with one delivery to
// this endpoint, sends it once and returns the delivery.
export async function sendTest(appId: string, endpointId: string, type: WebhookEventType, data: Json) {
  const [row] = await sql`
    with event as (
      insert into webhook_events (id, app_id, type, data, test)
      values (${prefixedId("evt", 24)}, ${appId}, ${type}, ${data}::jsonb, true)
      returning id, created_at
    )
    insert into webhook_deliveries (id, endpoint_id, event_id, test, created_at)
    select ${prefixedId("whd", 24)}, ${endpointId}, event.id, true, event.created_at from event
    returning id`;
  return attemptDelivery(row.id, { final: true });
}

// ─── Delivery ──────────────────────────────────────────

// Standard Webhooks signature: base64 HMAC-SHA256 of "<id>.<timestamp>.<body>",
// keyed with the base64-decoded secret.
export async function sign(secret: string, id: string, timestamp: number, body: string) {
  const raw = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${Buffer.from(mac).toString("base64")}`;
}

// Fails the attempt if the host is, or resolves to, a private address. Checked
// at send time too because DNS can change after the endpoint was saved.
async function resolvesPrivate(hostname: string) {
  if (allowPrivate()) return false;
  if (isPrivateHost(hostname)) return true;
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return false;
  const addresses = await lookup(host, { all: true });
  return addresses.some((a) => isPrivateHost(a.address));
}

// Reads at most MAX_RESPONSE_BODY chars, so a huge response can't eat memory.
async function readSnippet(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < MAX_RESPONSE_BODY) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return text.slice(0, MAX_RESPONSE_BODY);
}

type SendResult = { status: number | null; body: string | null; error: string | null; duration: number };

async function send(url: string, secret: string, event: Json): Promise<SendResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  try {
    if (await resolvesPrivate(new URL(url).hostname)) {
      return { status: null, body: null, error: "Resolves to a private address", duration: elapsed() };
    }
    const body = JSON.stringify(eventPayload(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual", // a 3xx counts as a failure
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "webhook-id": event.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": await sign(secret, event.id, timestamp, body),
      },
      body,
    });
    const text = await readSnippet(res).catch(() => "");
    return { status: res.status, body: text || null, error: null, duration: elapsed() };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    const error = timedOut
      ? `Timed out after ${TIMEOUT_MS / 1000}s`
      : e instanceof Error
        ? e.message
        : "Request failed";
    return { status: null, body: null, error, duration: elapsed() };
  }
}

// One delivery attempt. Worker attempts follow the retry schedule; `final`
// attempts (test sends and manual retries) end the delivery either way.
// Returns the delivery JSON, or null if it no longer exists.
export async function attemptDelivery(id: string, { final = false } = {}) {
  const [row] = await sql`
    select d.status, d.attempts, d.test, e.id as endpoint_id, e.url, e.secret, e.enabled,
           ev.id, ev.type, ev.app_id, ev.data, ev.created_at
    from webhook_deliveries d
    join webhook_endpoints e on e.id = d.endpoint_id
    join webhook_events ev on ev.id = d.event_id
    where d.id = ${id}`;
  if (!row) return null;
  if (!final && row.status !== "pending") return (await listDeliveries({ id }))[0] ?? null;

  if (!row.enabled && !row.test) {
    await sql`
      update webhook_deliveries
      set status = 'failed', error = 'Endpoint disabled', next_attempt_at = null, last_attempt_at = now()
      where id = ${id}`;
    return (await listDeliveries({ id }))[0] ?? null;
  }

  const result = await send(row.url, row.secret, row);
  const ok = result.status !== null && result.status >= 200 && result.status < 300;
  // Zapier (and others) answer 410 Gone when a subscription should stop.
  const gone = result.status === 410;
  const attempts = row.attempts + 1;
  const retryIn = RETRY_DELAYS[attempts - 1];

  const status = ok ? "succeeded" : final || gone || retryIn === undefined ? "failed" : "pending";
  const delay = status === "pending" ? retryIn : null;

  await sql`
    update webhook_deliveries
    set status = ${status},
        attempts = ${attempts},
        last_attempt_at = now(),
        next_attempt_at = case when ${delay}::int is null then null else now() + make_interval(secs => ${delay}::int) end,
        response_status = ${result.status},
        response_body = ${result.body},
        error = ${result.error ?? (ok ? null : `HTTP ${result.status}`)},
        duration_ms = ${result.duration}
    where id = ${id}`;

  if (gone) {
    await sql`
      update webhook_endpoints
      set enabled = false, disabled_reason = 'Endpoint returned 410 Gone', updated_at = now()
      where id = ${row.endpoint_id}`;
  }

  return (await listDeliveries({ id }))[0] ?? null;
}

// Hands due deliveries to this instance. The lease (pushing next_attempt_at
// out) plus `skip locked` means several instances never send the same one; if
// an instance dies mid-attempt, the delivery is retried when the lease ends.
export async function claimDueDeliveries(limit: number): Promise<string[]> {
  const rows = await sql`
    update webhook_deliveries
    set next_attempt_at = now() + interval '2 minutes'
    where id in (
      select id from webhook_deliveries
      where status = 'pending' and next_attempt_at <= now()
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    returning id`;
  return rows.map((r: { id: string }) => r.id);
}

// Events (and, by cascade, their deliveries) are kept for 30 days.
export async function pruneEvents() {
  await sql`delete from webhook_events where created_at < now() - interval '30 days'`;
}
