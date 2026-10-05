import type {
  AccountHit,
  Account,
  Addon,
  AnalyticsInterval,
  App,
  Entitlement,
  EntitlementType,
  EntitlementUsageSummary,
  Incentive,
  Offer,
  OfferCheckout,
  OfferInput,
  OfferStats,
  Paginated,
  PaypalConnection,
  PublicOffer,
  Plan,
  PricingCardResponse,
  ResolvedPlan,
  SavedReport,
  SavedReportInput,
  TopAccountUsage,
  UsageCount,
  UsageEvent,
  UsageTimeseriesPoint,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEventPayload,
} from "./types";

// Browser client for the dashboard. Calls the /api/admin BFF, whose /apps/* paths match
// the hosted Offer API one-to-one.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const qs = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  const res = await fetch(`/api/admin${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

const enc = encodeURIComponent;
const app = (appId: string) => `/apps/${enc(appId)}`;

export interface WorkspaceInfo {
  mode: "mock" | "remote";
  apiBaseUrl: string;
}

export interface AccountFilters {
  q?: string;
  plan?: string;
  incentive?: string;
  /** Accounts with an active subscription bought through this offer. */
  offer?: string;
  hasIncentive?: boolean;
  page?: number;
  perPage?: number;
}

export interface EntitlementInput {
  id: string;
  name: string;
  type: EntitlementType;
  description?: string | null;
}

function attachments<Owner>(kind: "plans" | "incentives") {
  return {
    addEntitlement: (appId: string, ownerId: string, id: string, max?: number | null) =>
      request<Owner>("POST", `${app(appId)}/${kind}/${enc(ownerId)}/entitlements`, max === undefined ? { id } : { id, max }),
    updateEntitlement: (appId: string, ownerId: string, id: string, max: number | null) =>
      request<Owner>("PATCH", `${app(appId)}/${kind}/${enc(ownerId)}/entitlements/${enc(id)}`, { max }),
    removeEntitlement: (appId: string, ownerId: string, id: string) =>
      request<Owner>("DELETE", `${app(appId)}/${kind}/${enc(ownerId)}/entitlements/${enc(id)}`),
    addAddon: (appId: string, ownerId: string, id: string) =>
      request<Owner>("POST", `${app(appId)}/${kind}/${enc(ownerId)}/addons`, { id }),
    removeAddon: (appId: string, ownerId: string, id: string) =>
      request<Owner>("DELETE", `${app(appId)}/${kind}/${enc(ownerId)}/addons/${enc(id)}`),
  };
}

export const api = {
  workspace: {
    get: () => request<WorkspaceInfo>("GET", "/workspace"),
    apps: () => request<App[]>("GET", "/workspace/apps"),
    createApp: (input: { name: string; sample?: "saas" | "course" | null }) =>
      request<App>("POST", "/workspace/apps", input),
  },

  apps: {
    get: (appId: string) => request<App>("GET", app(appId)),
    update: (appId: string, patch: Partial<Pick<App, "name" | "checkout_url">>) => request<App>("PATCH", app(appId), patch),
    delete: (appId: string) => request<{ deleted: true }>("DELETE", app(appId)),
    regenerateKey: (appId: string) => request<{ api_key: string }>("POST", `${app(appId)}/keys/regenerate`),
    regeneratePublicKey: (appId: string) =>
      request<{ public_key: string }>("POST", `${app(appId)}/public-key/regenerate`),
  },

  entitlements: {
    list: (appId: string) => request<Entitlement[]>("GET", `${app(appId)}/entitlements`),
    create: (appId: string, input: EntitlementInput) =>
      request<Entitlement>("POST", `${app(appId)}/entitlements`, input),
    update: (appId: string, id: string, patch: Partial<Omit<EntitlementInput, "id">>) =>
      request<Entitlement>("PATCH", `${app(appId)}/entitlements/${enc(id)}`, patch),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/entitlements/${enc(id)}`),
  },

  addons: {
    list: (appId: string) => request<Addon[]>("GET", `${app(appId)}/addons`),
    create: (appId: string, input: { id: string; name: string; description?: string | null }) =>
      request<Addon>("POST", `${app(appId)}/addons`, input),
    update: (appId: string, id: string, patch: { name?: string; description?: string | null }) =>
      request<Addon>("PATCH", `${app(appId)}/addons/${enc(id)}`, patch),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/addons/${enc(id)}`),
  },

  plans: {
    list: (appId: string) => request<Plan[]>("GET", `${app(appId)}/plans`),
    get: (appId: string, planId: string) => request<Plan>("GET", `${app(appId)}/plans/${enc(planId)}`),
    create: (
      appId: string,
      input: Pick<Plan, "id" | "name"> & Partial<Pick<Plan, "description" | "isFree" | "note" | "pricingCard">>,
    ) => request<Plan>("POST", `${app(appId)}/plans`, input),
    /** Shallow merge. Send `null` to clear a field. */
    update: (appId: string, planId: string, patch: Partial<Omit<Plan, "id" | "app_id">>) =>
      request<Plan>("PATCH", `${app(appId)}/plans/${enc(planId)}`, patch),
    /** Merges into plan.meta; set a key to null to clear its value. */
    updateMeta: (appId: string, planId: string, meta: Record<string, unknown>) =>
      request<Plan>("PATCH", `${app(appId)}/plans/${enc(planId)}/meta`, meta),
    delete: (appId: string, planId: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/plans/${enc(planId)}`),
    accounts: (appId: string, planId: string, page = 1, perPage = 20) =>
      request<Paginated<{ id: string; name: string }>>("GET", `${app(appId)}/plans/${enc(planId)}/namespaces`, undefined, {
        page,
        per_page: perPage,
      }),
    pricing: (appId: string) => request<PricingCardResponse[]>("GET", `${app(appId)}/plans/pricing`),
    ...attachments<Plan>("plans"),
  },

  incentives: {
    list: (appId: string) => request<Incentive[]>("GET", `${app(appId)}/incentives`),
    get: (appId: string, id: string) => request<Incentive>("GET", `${app(appId)}/incentives/${enc(id)}`),
    create: (appId: string, input: { id: string; name: string; description?: string | null }) =>
      request<Incentive>("POST", `${app(appId)}/incentives`, input),
    update: (appId: string, id: string, patch: { name?: string; description?: string | null }) =>
      request<Incentive>("PATCH", `${app(appId)}/incentives/${enc(id)}`, patch),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/incentives/${enc(id)}`),
    accounts: (appId: string, incentiveId: string, page = 1, perPage = 20) =>
      request<Paginated<AccountHit>>("GET", `${app(appId)}/namespaces/with-incentive`, undefined, {
        incentive: incentiveId,
        page,
        per_page: perPage,
      }),
    ...attachments<Incentive>("incentives"),
  },

  offers: {
    /** Resolves to null on an API version without offers (e.g. the in-memory mock). */
    list: (appId: string) => optional(request<Offer[]>("GET", `${app(appId)}/offers`)),
    get: (appId: string, id: string) => request<Offer>("GET", `${app(appId)}/offers/${enc(id)}`),
    create: (appId: string, input: OfferInput) => request<Offer>("POST", `${app(appId)}/offers`, input),
    update: (appId: string, id: string, patch: OfferInput) => request<Offer>("PATCH", `${app(appId)}/offers/${enc(id)}`, patch),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/offers/${enc(id)}`),
    publish: (appId: string, id: string) => request<Offer>("POST", `${app(appId)}/offers/${enc(id)}/publish`),
    archive: (appId: string, id: string) => request<Offer>("POST", `${app(appId)}/offers/${enc(id)}/archive`),
    /** What the checkout page would show for unsaved fields. Rejects with the validation error. */
    previewDraft: (appId: string, input: OfferInput) =>
      request<PublicOffer>("POST", `${app(appId)}/offers/draft-preview`, input),
    stats: (appId: string, id: string) => request<OfferStats>("GET", `${app(appId)}/offers/${enc(id)}/stats`),
    checkouts: (appId: string, opts: { offer?: string; status?: string; limit?: number } = {}) =>
      request<OfferCheckout[]>("GET", `${app(appId)}/checkouts`, undefined, opts),
  },

  paypal: {
    get: (appId: string) => request<PaypalConnection>("GET", `${app(appId)}/paypal`),
    connect: (appId: string, input: { client_id: string; client_secret: string; env: "sandbox" | "live" }) =>
      request<PaypalConnection>("PUT", `${app(appId)}/paypal`, input),
    disconnect: (appId: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/paypal`),
  },

  accounts: {
    list: (appId: string, f: AccountFilters = {}) =>
      request<Paginated<AccountHit>>("GET", `${app(appId)}/namespaces`, undefined, {
        q: f.q || "*",
        plan: f.plan,
        incentive: f.incentive,
        offer: f.offer,
        has_incentive: f.hasIncentive ? "true" : undefined,
        page: f.page ?? 1,
        per_page: f.perPage ?? 25,
      }),
    count: (appId: string) => request<{ count: number }>("GET", `${app(appId)}/namespaces/count`),
    get: (appId: string, id: string) => request<Account>("GET", `${app(appId)}/namespaces/${enc(id)}`),
    create: (appId: string, input: { id: string; name: string; plan: string; incentive?: string | null }) =>
      request<Account>("POST", `${app(appId)}/namespaces`, input),
    update: (appId: string, id: string, patch: { name?: string; plan?: string; incentive?: string | null }) =>
      request<Account>("PATCH", `${app(appId)}/namespaces/${enc(id)}`, patch),
    removeIncentive: (appId: string, id: string) =>
      request<Account>("DELETE", `${app(appId)}/namespaces/${enc(id)}/incentive`),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/namespaces/${enc(id)}`),
    /** Resolved access as the SDK sees it with a public key (private meta stripped). */
    plan: (appId: string, id: string) => request<ResolvedPlan>("GET", `${app(appId)}/namespaces/${enc(id)}/plan`),
    fullPlan: (appId: string, id: string) =>
      request<ResolvedPlan>("GET", `${app(appId)}/namespaces/${enc(id)}/full-plan`),
    usage: {
      add: (appId: string, id: string, entitlementId: string) =>
        request<UsageCount>("POST", `${app(appId)}/namespaces/${enc(id)}/usage/${enc(entitlementId)}/add`),
      remove: (appId: string, id: string, entitlementId: string) =>
        request<UsageCount>("POST", `${app(appId)}/namespaces/${enc(id)}/usage/${enc(entitlementId)}/remove`),
      amount: (appId: string, id: string, entitlementId: string, amount: number) =>
        request<UsageCount>("POST", `${app(appId)}/namespaces/${enc(id)}/usage/${enc(entitlementId)}/amount`, {
          amount,
        }),
    },
  },

  analytics: {
    summary: (appId: string, interval: AnalyticsInterval, namespace?: string) =>
      request<EntitlementUsageSummary[]>("GET", `${app(appId)}/analytics`, undefined, { interval, namespace }),
    topAccounts: (appId: string, interval: AnalyticsInterval, opts: { limit?: number; entitlement?: string } = {}) =>
      request<TopAccountUsage[]>("GET", `${app(appId)}/analytics/top-namespaces`, undefined, {
        interval,
        limit: opts.limit ?? 10,
        entitlement: opts.entitlement,
      }),
    /** Resolves to null on an API version without this endpoint. */
    timeseries: (appId: string, interval: AnalyticsInterval, opts: { namespace?: string; entitlement?: string } = {}) =>
      optional(
        request<UsageTimeseriesPoint[]>("GET", `${app(appId)}/analytics/timeseries`, undefined, { interval, ...opts }),
      ),
    /** Resolves to null on an API version without this endpoint. */
    events: (appId: string, opts: { namespace?: string; entitlement?: string; limit?: number } = {}) =>
      optional(request<UsageEvent[]>("GET", `${app(appId)}/analytics/events`, undefined, opts)),
    /** Saved reports. `list` resolves to null on an API version without them. */
    reports: {
      list: (appId: string) => optional(request<SavedReport[]>("GET", `${app(appId)}/analytics/reports`)),
      create: (appId: string, input: SavedReportInput) =>
        request<SavedReport>("POST", `${app(appId)}/analytics/reports`, input),
      update: (appId: string, id: string, patch: Partial<SavedReportInput>) =>
        request<SavedReport>("PATCH", `${app(appId)}/analytics/reports/${enc(id)}`, patch),
      delete: (appId: string, id: string) =>
        request<{ deleted: true }>("DELETE", `${app(appId)}/analytics/reports/${enc(id)}`),
    },
  },

  webhooks: {
    list: (appId: string) => request<WebhookEndpoint[]>("GET", `${app(appId)}/webhooks`),
    get: (appId: string, id: string) => request<WebhookEndpoint>("GET", `${app(appId)}/webhooks/${enc(id)}`),
    create: (appId: string, input: WebhookEndpointInput) => request<WebhookEndpoint>("POST", `${app(appId)}/webhooks`, input),
    update: (appId: string, id: string, patch: Partial<Omit<WebhookEndpointInput, "source">>) =>
      request<WebhookEndpoint>("PATCH", `${app(appId)}/webhooks/${enc(id)}`, patch),
    delete: (appId: string, id: string) => request<{ deleted: true }>("DELETE", `${app(appId)}/webhooks/${enc(id)}`),
    regenerateSecret: (appId: string, id: string) =>
      request<{ secret: string }>("POST", `${app(appId)}/webhooks/${enc(id)}/secret/regenerate`),
    /** Sends a sample event now and resolves with the finished delivery. */
    test: (appId: string, id: string, type?: string) =>
      request<WebhookDelivery>("POST", `${app(appId)}/webhooks/${enc(id)}/test`, type ? { type } : {}),
    deliveries: (appId: string, id: string, opts: { status?: WebhookDeliveryStatus; limit?: number } = {}) =>
      request<WebhookDelivery[]>("GET", `${app(appId)}/webhooks/${enc(id)}/deliveries`, undefined, opts),
    retry: (appId: string, id: string, deliveryId: string) =>
      request<WebhookDelivery>("POST", `${app(appId)}/webhooks/${enc(id)}/deliveries/${enc(deliveryId)}/retry`),
    /** Recent events recorded for the app (newest first), whether or not anything subscribed. */
    events: (appId: string, opts: { type?: string; limit?: number } = {}) =>
      request<WebhookEventPayload[]>("GET", `${app(appId)}/events`, undefined, opts),
  },
};

async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
