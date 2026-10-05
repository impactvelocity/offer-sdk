// Webhook event catalog: types, categories, sample payloads and diffPrevious.
// Keep in sync with offer-app/src/lib/webhooks/catalog.ts.

export type WebhookEventCategory = "account" | "usage" | "plan" | "incentive" | "billing";

export const WEBHOOK_EVENT_TYPES = [
  "account.created",
  "account.updated",
  "account.deleted",
  "account.plan_changed",
  "account.incentive_applied",
  "account.incentive_removed",
  "usage.limit_warning",
  "usage.limit_reached",
  "plan.created",
  "plan.updated",
  "plan.deleted",
  "incentive.created",
  "incentive.updated",
  "incentive.deleted",
  "checkout.completed",
  "account.addon_granted",
  "subscription.renewed",
  "subscription.cancelled",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** Subscribing to "*" delivers every event type, including ones added later. */
export const ALL_EVENTS = "*";

/** Share of a usage limit at which `usage.limit_warning` fires. */
export const USAGE_WARNING_THRESHOLD = 0.8;

export interface WebhookEventDef {
  type: WebhookEventType;
  category: WebhookEventCategory;
  title: string;
  description: string;
}

export const WEBHOOK_CATEGORIES: { id: WebhookEventCategory; title: string }[] = [
  { id: "account", title: "Accounts" },
  { id: "usage", title: "Usage" },
  { id: "plan", title: "Plans" },
  { id: "incentive", title: "Incentives" },
  { id: "billing", title: "Billing" },
];

export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  { type: "account.created", category: "account", title: "Account created", description: "A new account was created." },
  {
    type: "account.updated",
    category: "account",
    title: "Account updated",
    description: "Any change to an account. `data.previous` holds the old values of changed fields.",
  },
  { type: "account.deleted", category: "account", title: "Account deleted", description: "An account was deleted." },
  {
    type: "account.plan_changed",
    category: "account",
    title: "Plan changed",
    description: "An account moved to a different plan: an upgrade, downgrade or switch.",
  },
  {
    type: "account.incentive_applied",
    category: "account",
    title: "Incentive applied",
    description: "An incentive was applied to an account, or replaced its previous one.",
  },
  {
    type: "account.incentive_removed",
    category: "account",
    title: "Incentive removed",
    description: "An account's incentive was removed.",
  },
  {
    type: "usage.limit_warning",
    category: "usage",
    title: "Usage nearing limit",
    description: "An account crossed 80% of a usage limit. Good moment for an upgrade nudge.",
  },
  {
    type: "usage.limit_reached",
    category: "usage",
    title: "Usage limit reached",
    description: "An account used up a usage limit, so its access check now returns `can: false`.",
  },
  { type: "plan.created", category: "plan", title: "Plan created", description: "A plan was added to the catalog." },
  {
    type: "plan.updated",
    category: "plan",
    title: "Plan updated",
    description: "A plan's details, limits, add-ons, metadata or pricing changed.",
  },
  { type: "plan.deleted", category: "plan", title: "Plan deleted", description: "A plan was deleted." },
  { type: "incentive.created", category: "incentive", title: "Incentive created", description: "An incentive was created." },
  {
    type: "incentive.updated",
    category: "incentive",
    title: "Incentive updated",
    description: "An incentive's details, overrides or add-ons changed.",
  },
  { type: "incentive.deleted", category: "incentive", title: "Incentive deleted", description: "An incentive was deleted." },
  {
    type: "checkout.completed",
    category: "billing",
    title: "Checkout completed",
    description: "A buyer paid for an offer through PayPal. `data.account` is the account it was applied to.",
  },
  {
    type: "account.addon_granted",
    category: "billing",
    title: "Add-on granted",
    description: "An account got an add-on of its own, e.g. from an order bump. Good moment to send a booking link.",
  },
  {
    type: "subscription.renewed",
    category: "billing",
    title: "Subscription renewed",
    description: "PayPal charged a renewal. `data.object.subscription` has the next charge date and price.",
  },
  {
    type: "subscription.cancelled",
    category: "billing",
    title: "Subscription cancelled",
    description: "A PayPal subscription was cancelled or expired. The account moved to the free plan if there is one.",
  },
];

export const isWebhookEventType = (value: unknown): value is WebhookEventType =>
  typeof value === "string" && (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);

/** Whether an endpoint subscribed to `events` receives `type`. */
export const subscribes = (events: string[], type: string) => events.includes(ALL_EVENTS) || events.includes(type);

// ---------------------------------------------------------------------------
// Sample payloads: used for test deliveries and the event reference.

const SAMPLE_TIME = "2026-10-01T12:00:00.000Z";

function sampleAccount(appId: string) {
  return { id: "user_8f3k2", app_id: appId, name: "Acme Inc", plan: "pro", incentive: null as string | null, created_at: SAMPLE_TIME };
}

function samplePlan(appId: string) {
  return {
    id: "pro",
    app_id: appId,
    name: "Pro",
    description: "For growing teams",
    note: null,
    isFree: false,
    pricingCard: null,
    entitlements: [{ id: "ai_credits", max: 1000 }, { id: "sso" }],
    addons: [],
    meta: {},
    created_at: SAMPLE_TIME,
  };
}

function sampleIncentive(appId: string) {
  return {
    id: "black_friday",
    app_id: appId,
    name: "Black Friday",
    description: "Double AI credits through November",
    entitlements: [{ id: "ai_credits", max: 2000 }],
    addons: [],
    created_at: SAMPLE_TIME,
  };
}

function sampleSubscription() {
  return {
    offer_id: "5050",
    offer_name: "Half off",
    plan_id: "pro",
    interval: "month",
    currency: "USD",
    price: 49,
    list_price: 99,
    cycles: 3,
    discounted_cycles_left: 2,
    renews_at: "2026-11-01T12:00:00.000Z",
    renews_at_price: 49,
    status: "active",
    provider: "paypal",
    provider_id: "I-BW452GLLEP1G",
    checkout_id: "chk_Q2wErTyUiOpAsDfG",
    ref: "partner-x",
    started_at: SAMPLE_TIME,
    extras: { entitlements: [{ id: "ai_credits", max: 2000 }], addons: [], ends: "subscription", ends_at: null },
  };
}

function sampleUsage(max: number, usage: number) {
  return {
    account_id: "user_8f3k2",
    entitlement_id: "ai_credits",
    entitlement_name: "AI credits",
    usage,
    max,
    left: Math.max(0, max - usage),
    percent: Math.round((usage / max) * 100),
  };
}

/** The `data` of a sample event of this type. */
export function sampleEventData(type: WebhookEventType, appId: string): Record<string, unknown> {
  const account = sampleAccount(appId);
  switch (type) {
    case "account.created":
    case "account.deleted":
      return { object: account };
    case "account.updated":
      return { object: account, previous: { name: "Acme" } };
    case "account.plan_changed":
      return { object: account, previous: { plan: "starter" } };
    case "account.incentive_applied":
      return { object: { ...account, incentive: "black_friday" }, previous: { incentive: null } };
    case "account.incentive_removed":
      return { object: account, previous: { incentive: "black_friday" } };
    case "usage.limit_warning":
      return { object: sampleUsage(1000, 800) };
    case "usage.limit_reached":
      return { object: sampleUsage(1000, 1000) };
    case "plan.created":
    case "plan.deleted":
      return { object: samplePlan(appId) };
    case "plan.updated":
      return { object: samplePlan(appId), previous: { description: null } };
    case "incentive.created":
    case "incentive.deleted":
      return { object: sampleIncentive(appId) };
    case "incentive.updated":
      return { object: sampleIncentive(appId), previous: { description: null } };
    case "checkout.completed": {
      const subscribed = { ...account, subscription: sampleSubscription(), addons: ["welcome-call"] };
      return {
        object: {
          id: "chk_Q2wErTyUiOpAsDfG",
          app_id: appId,
          offer_id: "5050",
          plan_id: "pro",
          interval: "month",
          bumps: ["welcome-call"],
          account_id: account.id,
          email: null,
          ref: "partner-x",
          status: "completed",
          currency: "USD",
          total_today: 99,
          paypal: { kind: "subscription", id: "I-BW452GLLEP1G" },
          created_at: SAMPLE_TIME,
          completed_at: SAMPLE_TIME,
        },
        account: subscribed,
      };
    }
    case "account.addon_granted":
      return { object: { ...account, addons: ["welcome-call"] }, addon_id: "welcome-call", source: "checkout" };
    case "subscription.renewed":
      return { object: { ...account, subscription: { ...sampleSubscription(), discounted_cycles_left: 1 } } };
    case "subscription.cancelled":
      return {
        object: { ...account, plan: "free", subscription: { ...sampleSubscription(), status: "cancelled" } },
        previous: { plan: "pro" },
      };
  }
}

/** Old values of the top-level fields that differ between two documents. */
export function diffPrevious(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const previous: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) previous[key] = before[key] ?? null;
  }
  return previous;
}
