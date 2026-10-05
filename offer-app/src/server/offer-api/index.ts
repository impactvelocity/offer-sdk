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
  type SampleTemplate,
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

/** Base URL tenant code (and the API reference "Try it") should call. */
export function publicApiBaseUrl(origin: string) {
  return offerApiMode === "remote" ? env.OFFER_API_URL!.replace(/\/$/, "") : `${origin}/api/mock`;
}

// ---------------------------------------------------------------------------
// Sample data

/** Mock only: backdate accounts and apply months of usage events so analytics have shape. */
function seedUsageHistory(appId: string, template: SampleTemplate, { accounts, random }: Awaited<ReturnType<typeof seedSampleApp>>) {
  for (const account of accounts) {
    mergeDoc("namespaces", appId, account.id, { created_at: account.createdAt.toISOString() });
  }
  for (const e of sampleUsageHistory(template, accounts, random)) {
    increment(appId, e.namespace_id, e.entitlement_id, e.operation, e.amount, new Date(e.created_at));
  }
  db.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type { SampleKind };

/** Creates an app's sample catalog (and, in mock mode, usage history). */
export async function addSampleData(appId: string, kind: SampleKind = "saas") {
  const template = kind === "course" ? COURSE_TEMPLATE : SAAS_TEMPLATE;
  const seeded = await seedSampleApp(offerApi, appId, template, kind === "course" ? 11 : 7);
  if (offerApiMode === "mock") seedUsageHistory(appId, template, seeded);
  for (const report of SAMPLE_REPORTS[kind]) await offerApi("POST", `/apps/${appId}/analytics/reports`, report);
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
