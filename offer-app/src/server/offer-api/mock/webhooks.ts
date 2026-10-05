// In-memory webhook engine for the mock API: records events, fans them out to endpoints,
// signs and delivers them with retries. Mirrors api/src/lib/webhooks.ts.

import {
  ALL_EVENTS,
  isWebhookEventType,
  subscribes,
  USAGE_WARNING_THRESHOLD,
  type WebhookEventType,
} from "@/lib/webhooks/catalog";
import { db, getCount, getDoc, type Json, type MockWebhookDelivery, type MockWebhookEndpoint, type MockWebhookEvent } from "./db";
import { prefixedId } from "./ids";

/** Seconds to wait after each failed attempt; one more attempt than entries in total. */
const RETRY_DELAYS = [60, 300, 1800, 7200, 28800, 86400];
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 1024;
// The mock keeps a bounded history; the hosted API prunes events after 30 days.
const MAX_EVENTS = 5000;
const MAX_DELIVERIES = 5000;

export const MAX_ENDPOINTS_PER_APP = 25;
export const USER_AGENT = "OfferSDK-Webhooks/1.0";

// ---------------------------------------------------------------------------
// Validation

const allowPrivate = () => process.env.NODE_ENV !== "production";

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
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

/** Loopback, private, link-local and internal-only hostnames and IP literals. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return true;
  if (isPrivateIPv4(host)) return true;
  if (!host.includes(":")) return false;
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

/** Returns an error message, or null when the URL is acceptable. */
export function urlError(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return "url must be a valid http(s) URL";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "url must be a valid http(s) URL";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "url must be a valid http(s) URL";
  if (!allowPrivate() && isPrivateHost(url.hostname)) return "url must point to a public address";
  return null;
}

/** Normalised event list, or an error message. */
export function parseEvents(value: unknown): string[] | string {
  if (!Array.isArray(value) || value.length === 0) return "events must be a non-empty array";
  for (const type of value) {
    if (type !== ALL_EVENTS && !isWebhookEventType(type)) return `Unknown event type "${String(type)}"`;
  }
  return value.includes(ALL_EVENTS) ? [ALL_EVENTS] : [...new Set(value as string[])];
}

export function createSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${btoa(String.fromCharCode(...bytes))}`;
}

// ---------------------------------------------------------------------------
// JSON shapes

export function eventPayload(event: MockWebhookEvent) {
  return {
    id: event.id,
    type: event.type,
    created_at: event.created_at,
    app_id: event.app_id,
    data: event.data,
    ...(event.test ? { test: true } : {}),
  };
}

export function deliveryJson(delivery: MockWebhookDelivery) {
  const event = db.webhookEvents.find((e) => e.id === delivery.event_id);
  const rest: Partial<MockWebhookDelivery> = { ...delivery };
  delete rest.app_id;
  return { ...rest, event_type: event?.type ?? null, payload: event ? eventPayload(event) : null };
}

export function endpointJson(endpoint: MockWebhookEndpoint) {
  const since = Date.now() - 7 * 86_400_000;
  const stats = { total: 0, succeeded: 0, failed: 0, pending: 0 };
  let last: MockWebhookDelivery | undefined;
  for (const d of db.webhookDeliveries) {
    if (d.endpoint_id !== endpoint.id || d.test) continue;
    if (!last || d.created_at >= last.created_at) last = d;
    if (new Date(d.created_at).getTime() < since) continue;
    stats.total += 1;
    stats[d.status] += 1;
  }
  return {
    ...endpoint,
    stats: {
      ...stats,
      last_delivery_at: last ? (last.last_attempt_at ?? last.created_at) : null,
      last_status: last?.status ?? null,
      last_response_status: last?.response_status ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Emitting

const endpointsFor = (appId: string) => [...db.webhooks.values()].filter((e) => e.app_id === appId);

function trim<T>(list: T[], max: number) {
  if (list.length > max) list.splice(0, list.length - max);
}

function createDelivery(event: MockWebhookEvent, endpoint: MockWebhookEndpoint): MockWebhookDelivery {
  const delivery: MockWebhookDelivery = {
    id: prefixedId("whd", 24),
    app_id: event.app_id,
    endpoint_id: endpoint.id,
    event_id: event.id,
    status: "pending",
    attempts: 0,
    next_attempt_at: event.created_at,
    last_attempt_at: null,
    response_status: null,
    response_body: null,
    error: null,
    duration_ms: null,
    test: event.test,
    created_at: event.created_at,
  };
  db.webhookDeliveries.push(delivery);
  trim(db.webhookDeliveries, MAX_DELIVERIES);
  return delivery;
}

function recordEvent(appId: string, type: string, data: Json, test = false): MockWebhookEvent {
  const event = { id: prefixedId("evt", 24), app_id: appId, type, data, test, created_at: new Date().toISOString() };
  db.webhookEvents.push(event);
  trim(db.webhookEvents, MAX_EVENTS);
  return event;
}

/** Records an event and queues a delivery for every enabled endpoint subscribed to it. */
export function emit(appId: string, type: WebhookEventType, data: Json) {
  const event = recordEvent(appId, type, structuredClone(data));
  for (const endpoint of endpointsFor(appId)) {
    if (endpoint.enabled && subscribes(endpoint.events, type)) schedule(createDelivery(event, endpoint), 0);
  }
}

export function hasUsageSubscribers(appId: string) {
  return endpointsFor(appId).some(
    (e) => e.enabled && (subscribes(e.events, "usage.limit_warning") || subscribes(e.events, "usage.limit_reached")),
  );
}

/** Fires usage.limit_warning / usage.limit_reached when this change crossed a threshold. */
export function emitUsageThresholds(appId: string, namespaceId: string, entitlementId: string, amount: number) {
  if (!hasUsageSubscribers(appId)) return;
  const namespace = getDoc("namespaces", appId, namespaceId);
  if (!namespace) return;
  const plan = getDoc("plans", appId, namespace.plan);
  const incentive = namespace.incentive ? getDoc("incentives", appId, namespace.incentive) : null;
  const ref =
    incentive?.entitlements?.find((e: Json) => e.id === entitlementId) ??
    plan?.entitlements?.find((e: Json) => e.id === entitlementId);
  const max: number | null | undefined = ref?.max;
  if (max === null || max === undefined || max <= 0) return;

  const count = getCount(appId, namespaceId, entitlementId);
  const prev = count - amount;
  const type: WebhookEventType | null =
    prev < max && count >= max
      ? "usage.limit_reached"
      : prev < max * USAGE_WARNING_THRESHOLD && count >= max * USAGE_WARNING_THRESHOLD
        ? "usage.limit_warning"
        : null;
  if (!type) return;

  const entitlement = getDoc("entitlements", appId, entitlementId);
  emit(appId, type, {
    object: {
      account_id: namespaceId,
      entitlement_id: entitlementId,
      entitlement_name: entitlement?.name ?? entitlementId,
      usage: count,
      max,
      left: Math.max(0, max - count),
      percent: Math.round((count / max) * 100),
    },
  });
}

// ---------------------------------------------------------------------------
// Delivery

function schedule(delivery: MockWebhookDelivery, delaySeconds: number) {
  const timer = setTimeout(() => void attempt(delivery.id), delaySeconds * 1000);
  // Don't keep the process (or a test run) alive for a retry hours away.
  (timer as { unref?: () => void }).unref?.();
}

async function sign(secret: string, id: string, timestamp: number, body: string) {
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
}

async function send(endpoint: MockWebhookEndpoint, event: MockWebhookEvent) {
  const body = JSON.stringify(eventPayload(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const started = Date.now();
  if (!allowPrivate() && isPrivateHost(new URL(endpoint.url).hostname)) {
    return { status: null, body: null, error: "Resolves to a private address", duration: 0 };
  }
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "webhook-id": event.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": await sign(endpoint.secret, event.id, timestamp, body),
      },
      body,
    });
    const text = (await res.text().catch(() => "")).slice(0, MAX_RESPONSE_BODY);
    return { status: res.status, body: text || null, error: null, duration: Date.now() - started };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    const message = timedOut ? `Timed out after ${TIMEOUT_MS / 1000}s` : e instanceof Error ? (e.cause as Error)?.message || e.message : "Request failed";
    return { status: null, body: null, error: message, duration: Date.now() - started };
  }
}

/**
 * One delivery attempt. Automatic attempts follow the retry schedule; `final` attempts
 * (tests and manual retries) end the delivery either way.
 */
export async function attempt(deliveryId: string, { final = false } = {}): Promise<MockWebhookDelivery | null> {
  const delivery = db.webhookDeliveries.find((d) => d.id === deliveryId);
  if (!delivery || (!final && delivery.status !== "pending")) return delivery ?? null;
  const endpoint = db.webhooks.get(delivery.endpoint_id);
  const event = db.webhookEvents.find((e) => e.id === delivery.event_id);
  if (!endpoint || !event) return null;

  const now = new Date().toISOString();
  if (!endpoint.enabled && !delivery.test) {
    Object.assign(delivery, { status: "failed", error: "Endpoint disabled", next_attempt_at: null, last_attempt_at: now });
    return delivery;
  }

  const result = await send(endpoint, event);
  const ok = result.status !== null && result.status >= 200 && result.status < 300;
  delivery.attempts += 1;
  Object.assign(delivery, {
    last_attempt_at: now,
    response_status: result.status,
    response_body: result.body,
    error: result.error ?? (ok ? null : `HTTP ${result.status}`),
    duration_ms: result.duration,
  });

  // Zapier (and others) answer 410 Gone when a subscription should stop.
  const gone = result.status === 410;
  if (gone) {
    Object.assign(endpoint, { enabled: false, disabled_reason: "Endpoint returned 410 Gone", updated_at: now });
  }

  const retryIn = RETRY_DELAYS[delivery.attempts - 1];
  if (ok) {
    Object.assign(delivery, { status: "succeeded", next_attempt_at: null });
  } else if (final || gone || retryIn === undefined) {
    Object.assign(delivery, { status: "failed", next_attempt_at: null });
  } else {
    Object.assign(delivery, { status: "pending", next_attempt_at: new Date(Date.now() + retryIn * 1000).toISOString() });
    schedule(delivery, retryIn);
  }
  return delivery;
}

/** Sends a sample event to one endpoint right away. */
export async function sendTest(endpoint: MockWebhookEndpoint, type: WebhookEventType, data: Json) {
  const event = recordEvent(endpoint.app_id, type, data, true);
  const delivery = createDelivery(event, endpoint);
  return attempt(delivery.id, { final: true });
}
