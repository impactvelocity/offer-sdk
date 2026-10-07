// Server-side gateway to the Offer API. With OFFER_API_URL set, requests go to the
// hosted API using the admin key. Without it, they are served by the in-memory mock.

import { env } from "@/server/env";
import { db, increment, mergeDoc } from "./mock/db";
import { handleMockRequest, MOCK_ADMIN_KEY } from "./mock/routes";
import {
  COURSE_TEMPLATE,
  DEMO_APPS,
  SAAS_TEMPLATE,
  sampleUsageHistory,
  seedSampleApp,
  type SampleKind,
  type SampleUsageEvent,
  type SeededAccount,
} from "./sample-data";

export const offerApiMode: "mock" | "remote" = env.OFFER_API_URL ? "remote" : "mock";

/** Where this server reaches the hosted API: the private address when set, else the public URL. */
export function offerApiServerUrl() {
  return (env.OFFER_API_INTERNAL_URL ?? env.OFFER_API_URL!).replace(/\/?$/, "/");
}

export class OfferApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OfferApiError";
  }
}

/** Raw call: returns the upstream Response untouched (used by the BFF passthrough). */
export async function offerApiFetch(
  method: string,
  path: string,
  { query, body }: { query?: URLSearchParams; body?: unknown } = {},
): Promise<Response> {
  if (offerApiMode === "mock") {
    return handleMockRequest({ method, path, query, body, apiKey: MOCK_ADMIN_KEY });
  }
  const url = new URL(path.replace(/^\//, ""), offerApiServerUrl());
  if (query) url.search = query.toString();
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.OFFER_API_ADMIN_KEY}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

export type OfferApiCall = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

/** Parsed call that throws OfferApiError on non-2xx. */
export const offerApi: OfferApiCall = async (method, path, body) => {
  const res = await offerApiFetch(method, path, { body });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error;
    throw new OfferApiError(res.status, message ?? `Offer API ${method} ${path} failed (${res.status})`);
  }
  return data;
};

// ---------------------------------------------------------------------------
// Workspaces: each dashboard workspace (a better-auth organization) has an org
// record in the Offer API listing its apps.

export interface BackendOrg {
  id: string;
  app_ids: string[];
}

/** The workspace's record in the Offer API, created on first use. */
export async function backendOrg(orgId: string): Promise<BackendOrg> {
  try {
    return await offerApi<BackendOrg>("GET", `/orgs/${encodeURIComponent(orgId)}`);
  } catch (e) {
    if (e instanceof OfferApiError && e.status === 404) {
      return offerApi<BackendOrg>("POST", "/orgs", { id: orgId, app_ids: [] });
    }
    throw e;
  }
}

/** Creates an app in a workspace, optionally with sample data. */
export async function createWorkspaceApp(orgId: string, { name, sample }: { name: string; sample?: SampleKind | null }) {
  const org = await backendOrg(orgId);
  const app = await offerApi<{ id: string }>("POST", "/apps", { name });
  // Read-modify-write of app_ids: fine for one admin at a time; move server-side with the real API.
  await offerApi("PATCH", `/orgs/${encodeURIComponent(orgId)}`, { app_ids: [...org.app_ids, app.id] });
  if (sample) await addSampleData(app.id, sample);
  return app;
}

/** Base URL tenant code (and the API reference "Try it") should call. */
export function publicApiBaseUrl(origin: string) {
  return offerApiMode === "remote" ? env.OFFER_API_URL!.replace(/\/$/, "") : `${origin}/api/mock`;
}

// ---------------------------------------------------------------------------
// Sample data

/** Mock: backdates the accounts and applies their usage in memory. */
function applyMockHistory(appId: string, accounts: SeededAccount[], events: SampleUsageEvent[]) {
  for (const account of accounts) {
    mergeDoc("namespaces", appId, account.id, { created_at: account.createdAt.toISOString() });
  }
  for (const e of events) {
    increment(appId, e.namespace_id, e.entitlement_id, e.operation, e.amount, new Date(e.created_at));
  }
  db.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

const IMPORT_CHUNK = 5000; // the import route takes at most 10,000 items per request

/** Hosted API: backdates the accounts and imports their usage (admin-only POST /apps/:appId/import). */
async function importHistory(appId: string, accounts: SeededAccount[], events: SampleUsageEvent[]) {
  const path = `/apps/${appId}/import`;
  await offerApi("POST", path, { namespaces: accounts.map((a) => ({ id: a.id, created_at: a.createdAt.toISOString() })) });
  for (let i = 0; i < events.length; i += IMPORT_CHUNK) {
    await offerApi("POST", path, { usage_events: events.slice(i, i + IMPORT_CHUNK) });
  }
}

export type { SampleKind };

/** Creates an app's sample catalog, accounts, months of usage history and saved reports (plus offers and a cancel flow on the hosted API). */
export async function addSampleData(appId: string, kind: SampleKind = "saas") {
  const template = kind === "course" ? COURSE_TEMPLATE : SAAS_TEMPLATE;
  const { accounts, random } = await seedSampleApp(offerApi, appId, template, kind === "course" ? 11 : 7);
  const events = sampleUsageHistory(template, accounts, random);
  if (offerApiMode === "mock") applyMockHistory(appId, accounts, events);
  else await importHistory(appId, accounts, events);

  for (const report of SAMPLE_REPORTS[kind]) await offerApi("POST", `/apps/${appId}/analytics/reports`, report);

  // The mock has no offers or cancel flows.
  if (offerApiMode === "remote") {
    for (const offer of template.offers ?? []) await offerApi("POST", `/apps/${appId}/offers`, offer);
    if (template.cancelFlow) await offerApi("POST", `/apps/${appId}/cancel-flows`, { ...template.cancelFlow, status: "active" });
  }
}

const SAMPLE_REPORTS: Record<SampleKind, { name: string; entitlements: string[]; interval: string }[]> = {
  saas: [
    { name: "AI credits", entitlements: ["ai_credits"], interval: "30d" },
    { name: "AI + storage", entitlements: ["ai_credits", "storage_gb"], interval: "6m" },
  ],
  course: [{ name: "Live sessions", entitlements: ["live_sessions"], interval: "60d" }],
};

/** Mock only: the demo workspace's backend org with two sample apps. Idempotent per process. */
export async function seedDemoOrg(orgId: string) {
  if (offerApiMode !== "mock" || db.seeded) return;
  db.seeded = true;

  const apps = [];
  for (const { name, plan, sample } of DEMO_APPS) {
    apps.push({ id: (await offerApi<{ id: string }>("POST", "/apps", { name, plan })).id, sample });
  }
  await offerApi("POST", "/orgs", { id: orgId, app_ids: apps.map((a) => a.id) });
  for (const { id, sample } of apps) await addSampleData(id, sample);
}
