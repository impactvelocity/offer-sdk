import type { Interval as OfferInterval } from "@/sdk/checkout/types";
import type { SaveOfferDetails } from "@/sdk/cancel/types";

// Shapes returned by the hosted Offer API (see /api in the monorepo).
// The dashboard talks to it through the /api/admin BFF, which forwards paths unchanged.

export type EntitlementType = "usage" | "boolean";

export interface App {
  id: string;
  name: string;
  plan?: string;
  api_key: string;
  public_key: string;
  created_at: string;
  /** The tenant's own checkout page; over-limit upgrade links and share links point here. */
  checkout_url?: string | null;
}

export interface Entitlement {
  id: string;
  app_id: string;
  type: EntitlementType;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface Addon {
  id: string;
  app_id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

/** An entitlement attached to a plan or incentive. `max: null` = unlimited. Boolean entitlements carry no max. */
export interface EntitlementRef {
  id: string;
  max?: number | null;
}

export type PricingType = "subscription" | "one_time";

export interface PricingBenefit {
  id: string;
  title: string;
}

export interface PricingCard {
  title: string;
  description?: string | null;
  benefits: PricingBenefit[];
  featured?: boolean;
  type?: PricingType;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  price?: number | null;
  currency: string;
}

export type MetaValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface Plan {
  id: string;
  app_id: string;
  name: string;
  description?: string | null;
  note?: string | null;
  isFree?: boolean;
  pricingCard?: PricingCard | null;
  entitlements: EntitlementRef[];
  addons: string[];
  meta: Record<string, MetaValue>;
  privateMetaKeys?: string[];
  created_at: string;
}

export interface Incentive {
  id: string;
  app_id: string;
  name: string;
  description?: string | null;
  entitlements: EntitlementRef[];
  addons: string[];
  created_at: string;
}

/** An end customer / user / workspace in the tenant's product ("namespace" in the API). */
export interface Account {
  id: string;
  app_id: string;
  name: string;
  plan: string;
  incentive: string | null;
  created_at: string;
}

/** A row from the namespace search endpoints (list, with-incentive). `created_at` is unix seconds. */
export interface AccountHit {
  id: string;
  namespace_id: string;
  name: string;
  plan: string;
  has_incentive: boolean;
  incentive?: string;
  created_at: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ResolvedEntitlement {
  id: string;
  feature: string;
  name: string;
  type: EntitlementType;
  usage: number;
  max: number | null;
  left: number | null;
  can: boolean;
}

/** GET /namespaces/:id/plan (or /full-plan): what the SDK sees for one account. */
export interface ResolvedPlan {
  plan: {
    id: string;
    name: string;
    description: string | null;
    isFree: boolean;
    meta: Record<string, MetaValue>;
    privateMetaKeys?: string[];
  };
  incentive: string | null;
  addons: string[];
  entitlements: ResolvedEntitlement[];
}

export type PricingCardResponse = PricingCard & { plan_id: string; isFree: boolean };

export type AnalyticsInterval = "7d" | "30d" | "60d" | "6m" | "year" | "alltime";

export interface EntitlementUsageSummary {
  entitlement_id: string;
  calls: number;
  total_amount: number;
}

export interface TopAccountUsage {
  namespace_id: string;
  calls: number;
  total_amount: number;
}

/** GET /apps/:appId/analytics/timeseries */
export interface UsageTimeseriesPoint {
  date: string;
  entitlement_id: string;
  calls: number;
  total_amount: number;
}

/** A saved analytics view (GET /apps/:appId/analytics/reports). */
export interface SavedReport {
  id: string;
  app_id: string;
  name: string;
  /** Entitlement ids to focus on. Empty means all entitlements. */
  entitlements: string[];
  interval: AnalyticsInterval;
  created_at: string;
  updated_at: string;
}

export type SavedReportInput = Pick<SavedReport, "name" | "entitlements" | "interval">;

export type UsageOperation = "add" | "remove" | "amount";

/** GET /apps/:appId/analytics/events */
export interface UsageEvent {
  id: number;
  namespace_id: string;
  entitlement_id: string;
  operation: UsageOperation;
  amount: number;
  count: number;
  created_at: string;
}

export interface UsageCount {
  entitlement: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Webhooks

export type WebhookSource = "custom" | "zapier";
export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed";

/** An HTTPS endpoint that receives signed event payloads. `events: ["*"]` subscribes to everything. */
export interface WebhookEndpoint {
  id: string;
  app_id: string;
  url: string;
  description: string | null;
  events: string[];
  enabled: boolean;
  source: WebhookSource;
  /** `whsec_…`: signs every delivery (Standard Webhooks). */
  secret: string;
  /** Set when the API turned the endpoint off, e.g. after a 410 Gone. */
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Deliveries created in the last 7 days (tests excluded), plus the latest one. */
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    last_delivery_at: string | null;
    last_status: WebhookDeliveryStatus | null;
    last_response_status: number | null;
  };
}

/** The JSON body POSTed to endpoints, and what GET /events returns. */
export interface WebhookEventPayload {
  id: string;
  type: string;
  created_at: string;
  app_id: string;
  data: { object: Record<string, unknown>; previous?: Record<string, unknown> };
  test?: true;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  test: boolean;
  created_at: string;
  payload: WebhookEventPayload;
}

export interface WebhookEndpointInput {
  url: string;
  events: string[];
  description?: string | null;
  source?: WebhookSource;
  enabled?: boolean;
}

// ─── Offers ────────────────────────────────────────────

export type { Checkout as OfferCheckout, Interval as OfferInterval, PublicOffer } from "@/sdk/checkout/types";

export type OfferStatus = "draft" | "active" | "archived";

export interface OfferPlanEntry {
  plan_id: string;
  /** Per-interval price overrides; otherwise the offer's discount applies to the plan's list price. */
  prices?: Partial<Record<OfferInterval, { amount: number; cycles?: number }>>;
  /** Entitlements added or raised on top of the plan ("extras"). */
  entitlements: { id: string; max?: number | null }[];
  addons: string[];
  /** How long extras last: "subscription", "discount" or an ISO duration like "P6M". */
  extras_for: string;
}

export interface OfferBump {
  id: string;
  label: string;
  description?: string;
  price: { amount: number };
  grant: { addons?: string[]; credits?: { entitlement: string; amount: number } };
  applies_to?: { plans?: string[]; intervals?: OfferInterval[] };
}

export interface Offer {
  id: string;
  app_id: string;
  name: string;
  type: "shareable" | "targeted";
  account_id?: string;
  status: OfferStatus;
  source: string;
  copy: { headline?: string; subhead?: string; cta?: string; bullets?: string[] };
  currency: string;
  discount: { percent?: number; amount_off?: number; cycles?: number } | null;
  intervals: OfferInterval[];
  plans: OfferPlanEntry[];
  default_plan: string | null;
  bumps: OfferBump[];
  grant: { addons: string[] };
  expires_at: string | null;
  max_redemptions: number | null;
  published_at: string | null;
  created_at: string;
  /** Completed checkouts. */
  redemptions?: number;
  /** Live state from the API: "available", "expired", "sold_out", "draft", "archived"… */
  availability?: string;
}

export type OfferInput = Partial<
  Pick<
    Offer,
    | "id"
    | "name"
    | "type"
    | "account_id"
    | "copy"
    | "currency"
    | "discount"
    | "intervals"
    | "plans"
    | "default_plan"
    | "bumps"
    | "grant"
    | "expires_at"
    | "max_redemptions"
  >
>;

export interface OfferStatsRow {
  checkouts: number;
  completed: number;
  revenue: number;
}

export interface OfferStats {
  offer_id: string;
  views: number;
  checkouts: number;
  completed: number;
  conversion: number | null;
  revenue: number;
  by_plan: (OfferStatsRow & { plan_id: string; interval: OfferInterval })[];
  by_ref: (OfferStatsRow & { ref: string | null })[];
  bumps: { id: string; taken: number; rate: number }[];
}

export interface PaypalConnection {
  connected: boolean;
  env?: "sandbox" | "live";
  client_id?: string;
  webhook?: "registered" | "not_registered";
  updated_at?: string;
}

// ─── Cancel flows ──────────────────────────────────────

export type SaveOfferKind = "discount" | "pause" | "downgrade" | "incentive";

export interface SaveOfferCopy {
  headline?: string;
  body?: string;
  cta?: string;
}

export type SaveOfferSpec =
  | { kind: "discount"; percent: number; cycles: number; copy?: SaveOfferCopy }
  | { kind: "pause"; months: number; copy?: SaveOfferCopy }
  | { kind: "downgrade"; plan: string; copy?: SaveOfferCopy }
  | { kind: "incentive"; incentive: string; months: number; copy?: SaveOfferCopy };

export interface SaveOfferGuardrails {
  kinds: SaveOfferKind[];
  max_discount_percent: number;
  max_discount_cycles: number;
  max_pause_months: number;
  max_incentive_months: number;
  incentives: string[];
  downgrade_plans: string[];
  instructions: string;
}

export interface CancelFlowAnswer {
  id: string;
  label: string;
  next?: string | null;
  text?: boolean;
}

export type CancelFlowStep =
  | { id: string; type: "question"; title: string; description?: string; answers: CancelFlowAnswer[]; next?: string | null }
  | { id: string; type: "text"; title: string; description?: string; placeholder?: string; required?: boolean; next?: string | null }
  | {
      id: string;
      type: "offer";
      title?: string;
      dynamic: boolean;
      guardrails: SaveOfferGuardrails;
      default: SaveOfferSpec | null;
      by_answer: Record<string, SaveOfferSpec | null>;
      decline_label?: string;
      next?: string | null;
    }
  | { id: string; type: "confirm"; title: string; description?: string; cta?: string };

export interface CancelFlow {
  id: string;
  app_id: string;
  name: string;
  status: "active" | "draft";
  steps: CancelFlowStep[];
  created_at: string;
  updated_at: string;
  capabilities?: { dynamic_offers: boolean; pause_workflows: boolean };
  last_30_days?: { sessions: number; saved: number };
}

export interface CancelFlowInput {
  id?: string;
  name?: string;
  status?: "active" | "draft";
  steps?: CancelFlowStep[];
}

export interface PresentedSaveOffer {
  kind: SaveOfferKind;
  source: "static" | "dynamic";
  details: SaveOfferDetails;
  headline: string;
  body: string;
  cta: string;
  reasoning?: string | null;
  status: "shown" | "accepted" | "declined";
  result?: Record<string, unknown>;
}

export interface CancelAccountSnapshot {
  id: string;
  name: string | null;
  plan: string;
  plan_name: string;
  created_at: string | null;
  subscription: {
    provider: string | null;
    status: string;
    interval: string;
    price: number;
    currency: string;
    renews_at: string | null;
    payments: number;
    offer_name: string | null;
  } | null;
  monthly_value: number;
  billing_offers: boolean;
}

export interface CancelSessionRecord {
  id: string;
  app_id: string;
  flow_id: string;
  account_id: string;
  status: "open" | "saved" | "cancelled" | "abandoned";
  answers: { step: string; step_title: string; answer: string | null; label: string | null; text: string | null }[];
  offer: PresentedSaveOffer | null;
  decide: { used: boolean; skipped: string | null } | null;
  account: CancelAccountSnapshot;
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface CancelFlowStats {
  days: number;
  started: number;
  saved: number;
  cancelled: number;
  abandoned: number;
  open: number;
  save_rate: number | null;
  monthly_revenue_saved: number;
  monthly_revenue_lost: number;
  reasons: { step: string; step_title: string; answer: string; label: string; count: number; saved: number; cancelled: number }[];
  offers: { kind: SaveOfferKind; source: "static" | "dynamic"; shown: number; accepted: number }[];
  daily: { day: string; sessions: number; saved: number; cancelled: number }[];
}

export interface CancelOfferPreview {
  account: CancelAccountSnapshot | null;
  offer: PresentedSaveOffer | null;
  dynamic: { used: boolean; skipped: string | null } | null;
  static_offer: PresentedSaveOffer | null;
}

// MCP server (admin-only routes under /apps/:appId/mcp in the hosted API; the mock has none)

export type McpAccessLevel = "read" | "write" | "full";

export interface McpSettings {
  enabled: boolean;
  access_level: McpAccessLevel;
  /** Tool name → on/off, where it differs from what access_level allows. */
  tool_overrides: Record<string, boolean>;
  updated_at: string | null;
}

export interface McpConnectionRecord {
  id: string;
  auth: "oauth" | "key";
  client_id: string | null;
  client_name: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  access_level: McpAccessLevel;
  client_uri: string | null;
  logo_uri: string | null;
  calls_7d: number;
  created_at: string;
  last_used_at: string | null;
}

export interface McpCallRecord {
  id: string;
  connection_id: string | null;
  tool: string;
  args: Record<string, unknown>;
  status: number;
  duration_ms: number;
  result: unknown;
  created_at: string;
}
