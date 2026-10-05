// In-memory stand-in for the hosted API's Postgres tables. Lives on globalThis so it
// survives dev-server module reloads; it is reset when the process restarts.

// Documents are schemaless JSON, like the API's jsonb columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;
export type DocTable = "plans" | "entitlements" | "addons" | "incentives" | "namespaces" | "reports" | "agent_threads";

export interface MockOrg {
  id: string;
  app_ids: string[];
  created_at: string;
}

export interface MockEvent {
  id: number;
  app_id: string;
  namespace_id: string;
  entitlement_id: string;
  operation: "add" | "remove" | "amount";
  amount: number;
  count: number;
  created_at: string;
}

export interface MockWebhookEndpoint {
  id: string;
  app_id: string;
  url: string;
  description: string | null;
  events: string[];
  enabled: boolean;
  source: "custom" | "zapier";
  secret: string;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockWebhookEvent {
  id: string;
  app_id: string;
  type: string;
  data: Json;
  test: boolean;
  created_at: string;
}

export interface MockWebhookDelivery {
  id: string;
  app_id: string;
  endpoint_id: string;
  event_id: string;
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  test: boolean;
  created_at: string;
}

export interface MockDb {
  apps: Map<string, Json>;
  orgs: Map<string, MockOrg>;
  docs: Record<DocTable, Map<string, Map<string, Json>>>;
  /** key: appId \0 namespaceId \0 entitlementId */
  counters: Map<string, number>;
  events: MockEvent[];
  eventSeq: number;
  seeded: boolean;
  webhooks: Map<string, MockWebhookEndpoint>;
  webhookEvents: MockWebhookEvent[];
  webhookDeliveries: MockWebhookDelivery[];
}

const globalForDb = globalThis as unknown as { __offerMockDb?: MockDb };

export const db: MockDb = (globalForDb.__offerMockDb ??= {
  apps: new Map(),
  orgs: new Map(),
  docs: {
    plans: new Map(),
    entitlements: new Map(),
    addons: new Map(),
    incentives: new Map(),
    namespaces: new Map(),
    reports: new Map(),
    agent_threads: new Map(),
  },
  counters: new Map(),
  events: [],
  eventSeq: 0,
  seeded: false,
  webhooks: new Map(),
  webhookEvents: [],
  webhookDeliveries: [],
});

// Added after the first release: a db created by an older module version lacks these.
db.webhooks ??= new Map();
db.webhookEvents ??= [];
db.webhookDeliveries ??= [];
db.docs.reports ??= new Map();
db.docs.agent_threads ??= new Map();

const clone = <T>(value: T): T => structuredClone(value);

function table(name: DocTable, appId: string) {
  let docs = db.docs[name].get(appId);
  if (!docs) {
    docs = new Map();
    db.docs[name].set(appId, docs);
  }
  return docs;
}

const byCreated = (a: Json, b: Json) =>
  String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id));

export function listDocs(name: DocTable, appId: string): Json[] {
  return [...table(name, appId).values()].sort(byCreated).map(clone);
}

export function getDoc(name: DocTable, appId: string, id: string | undefined | null): Json | null {
  if (!id) return null;
  const doc = table(name, appId).get(id);
  return doc ? clone(doc) : null;
}

/** Returns false when a doc with this id already exists. */
export function insertDoc(name: DocTable, appId: string, id: string, data: Json): boolean {
  const docs = table(name, appId);
  if (docs.has(id)) return false;
  docs.set(id, clone(data));
  return true;
}

/** Shallow merge, like the API's `data || patch`. */
export function mergeDoc(name: DocTable, appId: string, id: string, patch: Json): Json | null {
  const docs = table(name, appId);
  const current = docs.get(id);
  if (!current) return null;
  const next = { ...current, ...clone(patch) };
  docs.set(id, next);
  return clone(next);
}

export function updateDoc(name: DocTable, appId: string, id: string, fn: (doc: Json) => Json): Json | null {
  const docs = table(name, appId);
  const current = docs.get(id);
  if (!current) return null;
  const next = fn(clone(current));
  docs.set(id, next);
  return clone(next);
}

export function deleteDoc(name: DocTable, appId: string, id: string): boolean {
  const deleted = table(name, appId).delete(id);
  if (deleted && name === "namespaces") {
    // Counters cascade with the namespace; events are kept for analytics.
    const prefix = `${appId}\0${id}\0`;
    for (const key of db.counters.keys()) if (key.startsWith(prefix)) db.counters.delete(key);
  }
  return deleted;
}

export function deleteApp(appId: string): boolean {
  if (!db.apps.delete(appId)) return false;
  for (const name of Object.keys(db.docs) as DocTable[]) db.docs[name].delete(appId);
  for (const key of db.counters.keys()) if (key.startsWith(`${appId}\0`)) db.counters.delete(key);
  db.events = db.events.filter((e) => e.app_id !== appId);
  for (const [id, endpoint] of db.webhooks) if (endpoint.app_id === appId) db.webhooks.delete(id);
  db.webhookEvents = db.webhookEvents.filter((e) => e.app_id !== appId);
  db.webhookDeliveries = db.webhookDeliveries.filter((d) => d.app_id !== appId);
  return true;
}

const counterKey = (appId: string, namespaceId: string, entitlementId: string) =>
  `${appId}\0${namespaceId}\0${entitlementId}`;

export function getCount(appId: string, namespaceId: string, entitlementId: string): number {
  return db.counters.get(counterKey(appId, namespaceId, entitlementId)) ?? 0;
}

/** Bumps the counter and appends an analytics event, like the API's single-statement upsert. */
export function increment(
  appId: string,
  namespaceId: string,
  entitlementId: string,
  operation: MockEvent["operation"],
  amount: number,
  at = new Date(),
): number {
  const key = counterKey(appId, namespaceId, entitlementId);
  const count = (db.counters.get(key) ?? 0) + amount;
  db.counters.set(key, count);
  db.events.push({
    id: ++db.eventSeq,
    app_id: appId,
    namespace_id: namespaceId,
    entitlement_id: entitlementId,
    operation,
    amount,
    count,
    created_at: at.toISOString(),
  });
  return count;
}
