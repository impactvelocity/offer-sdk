// The Offer API's per-app endpoints, as served by the hosted API (api/src/routes) and the
// mock. Drives the API reference and its "Try it" runner. Strings in examples may contain
// {{placeholders}} (see ExampleKey) that are filled with real ids from the current app.

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** `secret`: the app's secret key only. `public-or-secret`: the public key is accepted too. */
export type EndpointAuth = "secret" | "public-or-secret";

export type GroupId =
  | "accounts"
  | "access"
  | "usage"
  | "plans"
  | "pricing"
  | "entitlements"
  | "addons"
  | "incentives"
  | "analytics"
  | "webhooks"
  | "app";

/** Real ids from the current app, used to prefill path params and examples. */
export type ExampleKey =
  | "appId"
  | "appName"
  | "account"
  | "plan"
  | "freePlan"
  | "pricedPlan"
  | "entitlement"
  | "usageEntitlement"
  | "planEntitlement"
  | "unattachedEntitlement"
  | "addon"
  | "planAddon"
  | "unattachedAddon"
  | "incentive"
  | "incentiveEntitlement"
  | "webhook";

export interface QueryParam {
  name: string;
  type: "string" | "integer" | "boolean";
  description: string;
  required?: boolean;
  options?: string[];
  /** Prefilled in "Try it". May contain {{placeholders}}. */
  example?: string;
  default?: string;
}

export interface BodyField {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

export interface StatusCode {
  code: number;
  description: string;
}

export interface Endpoint {
  group: GroupId;
  method: HttpMethod;
  /** Full path with `:params`, e.g. /apps/:appId/namespaces/:namespaceId */
  path: string;
  summary: string;
  description?: string;
  auth: EndpointAuth;
  /** Served by the mock only; not in the hosted API yet. */
  proposed?: boolean;
  /** A caveat worth calling out (known issues, surprising behaviour). */
  warning?: string;
  /** Path param → example source, when the default for that param name doesn't fit. */
  examples?: Partial<Record<string, ExampleKey>>;
  query?: QueryParam[];
  body?: BodyField[];
  exampleBody?: unknown;
  response: { description: string; example?: unknown };
  statuses: StatusCode[];
  /** Ask before sending from "Try it" (and why). */
  confirm?: string;
  /** "Try it" is disabled, with the reason. */
  noTryIt?: string;
}

export interface EndpointGroup {
  id: GroupId;
  title: string;
  description: string;
}

export const GROUPS: EndpointGroup[] = [
  { id: "accounts", title: "Accounts", description: "Your end customers (namespaces in the API). Each is on exactly one plan and at most one incentive." },
  { id: "access", title: "Access", description: "Resolve what an account can do right now: plan, incentive overrides, add-ons and current usage." },
  { id: "usage", title: "Usage", description: "Per-account counters for usage entitlements. Writes never enforce limits; check `can` first." },
  { id: "plans", title: "Plans", description: "Bundles of entitlements (with limits), add-ons and metadata." },
  { id: "pricing", title: "Pricing", description: "Pricing cards for your pricing page. Readable with the public key." },
  { id: "entitlements", title: "Entitlements", description: "Features you gate: counted usage limits or boolean feature flags." },
  { id: "addons", title: "Add-ons", description: "Named extras a plan or incentive can include." },
  { id: "incentives", title: "Incentives", description: "Offers layered on top of an account's plan: override limits or grant extra entitlements and add-ons." },
  { id: "analytics", title: "Analytics", description: "Aggregated usage events." },
  { id: "webhooks", title: "Webhooks", description: "Endpoints that receive signed event payloads, their delivery logs, and the app's event log." },
  { id: "app", title: "App & keys", description: "The app itself and its API keys." },
];

/** Shared descriptions and default examples for path params. */
export const PATH_PARAMS: Record<string, { description: string; example: ExampleKey }> = {
  appId: { description: "Your app's ID. Filled in for you.", example: "appId" },
  namespaceId: { description: "The account ID you chose when creating it (e.g. your user or workspace ID).", example: "account" },
  planId: { description: "Plan ID.", example: "plan" },
  entitlementId: { description: "Entitlement ID.", example: "entitlement" },
  addonId: { description: "Add-on ID.", example: "addon" },
  incentiveId: { description: "Incentive ID.", example: "incentive" },
  webhookId: { description: "Webhook endpoint ID (`whk_…`).", example: "webhook" },
  deliveryId: { description: "Delivery ID (`whd_…`) from the endpoint's delivery log.", example: "webhook" },
};

export function pathParams(path: string) {
  return [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
}

/** Stable anchor id, e.g. "get-namespaces-namespaceid-plan". */
export function endpointId(e: Pick<Endpoint, "method" | "path">) {
  const rest = e.path.replace(/^\/apps\/:appId/, "") || "/app";
  return `${e.method}${rest}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
}

// ---------------------------------------------------------------------------
// Shared shapes

const ok = (description = "Success"): StatusCode => ({ code: 200, description });
const created: StatusCode = { code: 201, description: "Created" };
const unauthorized: StatusCode = { code: 401, description: "Missing or invalid key, or the key isn't allowed on this route" };
const notFound = (what: string): StatusCode => ({ code: 404, description: `${what} not found` });
const conflict = (what: string): StatusCode => ({ code: 409, description: `${what} with this ID already exists` });
const badRequest = (description: string): StatusCode => ({ code: 400, description });
const deleted = { description: "`{ deleted: true }`", example: { deleted: true } };

const EVENT_EXAMPLE = {
  id: "evt_Kq3mXbT9wLcN2pRfYs8dHjAe",
  type: "account.plan_changed",
  created_at: "2026-10-03T09:41:00.000Z",
  app_id: "{{appId}}",
  data: { object: { id: "{{account}}", name: "Acme Inc", plan: "{{plan}}", incentive: null }, previous: { plan: "{{freePlan}}" } },
};

const WEBHOOK_EXAMPLE = {
  id: "{{webhook}}",
  app_id: "{{appId}}",
  url: "https://api.example.com/webhooks/offer",
  description: "Billing service",
  events: ["account.plan_changed", "usage.limit_reached"],
  enabled: true,
  source: "custom",
  secret: "whsec_…",
  disabled_reason: null,
  created_at: "2026-10-01T09:00:00.000Z",
  updated_at: "2026-10-01T09:00:00.000Z",
  stats: { total: 128, succeeded: 127, failed: 1, pending: 0, last_delivery_at: "2026-10-03T09:41:01.000Z", last_status: "succeeded", last_response_status: 200 },
};

const DELIVERY_EXAMPLE = {
  id: "whd_Pz8nRtYw2KcLm4QsVb6XjHfD",
  endpoint_id: "{{webhook}}",
  event_id: EVENT_EXAMPLE.id,
  event_type: EVENT_EXAMPLE.type,
  status: "succeeded",
  attempts: 1,
  next_attempt_at: null,
  last_attempt_at: "2026-10-03T09:41:01.000Z",
  response_status: 200,
  response_body: "ok",
  error: null,
  duration_ms: 182,
  test: false,
  created_at: "2026-10-03T09:41:00.000Z",
  payload: EVENT_EXAMPLE,
};

const PAGINATION: QueryParam[] = [
  { name: "page", type: "integer", description: "Page number, from 1.", default: "1" },
  { name: "per_page", type: "integer", description: "Results per page (max 100).", default: "20" },
];

const INTERVAL_OPTIONS = ["7d", "30d", "60d", "6m", "year", "alltime"];

const ACCOUNT = {
  id: "{{account}}",
  app_id: "{{appId}}",
  name: "Ada Lovelace",
  plan: "{{plan}}",
  incentive: null,
  created_at: "2026-09-14T10:12:00.000Z",
};

const ACCOUNT_HIT = {
  id: "{{account}}",
  namespace_id: "{{account}}",
  name: "Ada Lovelace",
  plan: "{{plan}}",
  has_incentive: false,
  created_at: 1789812720,
};

const RESOLVED_PLAN = {
  plan: { id: "{{plan}}", name: "Pro", description: "For growing teams.", isFree: false, meta: { badge: "Most popular" } },
  incentive: null,
  addons: ["{{planAddon}}"],
  entitlements: [
    { id: "{{usageEntitlement}}", feature: "{{usageEntitlement}}", name: "AI credits", type: "usage", usage: 420, max: 2500, left: 2080, can: true },
    { id: "export_pdf", feature: "export_pdf", name: "PDF export", type: "boolean", usage: 0, max: null, left: null, can: true },
  ],
};

const PRICING_CARD = {
  title: "Pro",
  description: "For growing teams.",
  benefits: [
    { id: "b1", title: "Unlimited projects" },
    { id: "b2", title: "Priority support" },
  ],
  featured: true,
  type: "subscription",
  monthlyPrice: 29,
  yearlyPrice: 290,
  currency: "USD",
};

const PLAN = {
  id: "{{plan}}",
  app_id: "{{appId}}",
  name: "Pro",
  description: "For growing teams.",
  note: null,
  isFree: false,
  pricingCard: PRICING_CARD,
  entitlements: [
    { id: "{{usageEntitlement}}", max: 2500 },
    { id: "export_pdf" },
  ],
  addons: ["{{planAddon}}"],
  meta: { badge: "Most popular", stripe_price_monthly: "price_123" },
  privateMetaKeys: ["stripe_price_monthly"],
  created_at: "2026-06-01T09:00:00.000Z",
};

const ENTITLEMENT = {
  id: "{{entitlement}}",
  app_id: "{{appId}}",
  type: "usage",
  name: "AI credits",
  description: "Credits spent on AI generations.",
  created_at: "2026-06-01T09:00:00.000Z",
};

const ADDON = {
  id: "{{addon}}",
  app_id: "{{appId}}",
  name: "Extra storage pack",
  description: "+500 GB of storage.",
  created_at: "2026-06-01T09:00:00.000Z",
};

const INCENTIVE = {
  id: "{{incentive}}",
  app_id: "{{appId}}",
  name: "Summer promo",
  description: "Double AI credits through August.",
  entitlements: [{ id: "{{usageEntitlement}}", max: 5000 }],
  addons: [],
  created_at: "2026-06-01T09:00:00.000Z",
};

const PRICING_FIELDS: BodyField[] = [
  { name: "pricingCard", type: "object | null", description: "`{ title, description, benefits: [{ id, title }], featured, type: \"subscription\" | \"one_time\", monthlyPrice?, yearlyPrice?, price?, currency }`." },
];

// ---------------------------------------------------------------------------
// Attachments shared by plans and incentives

function attachmentEndpoints(owner: "plans" | "incentives"): Endpoint[] {
  const param = owner === "plans" ? "planId" : "incentiveId";
  const label = owner === "plans" ? "plan" : "incentive";
  const aLabel = owner === "plans" ? "a plan" : "an incentive";
  const Label = owner === "plans" ? "Plan" : "Incentive";
  const base = `/apps/:appId/${owner}/:${param}`;
  const attachedEntitlement: ExampleKey = owner === "plans" ? "planEntitlement" : "incentiveEntitlement";
  const example = owner === "plans" ? PLAN : INCENTIVE;
  return [
    {
      group: owner,
      method: "POST",
      path: `${base}/entitlements`,
      summary: `Attach an entitlement to ${aLabel}`,
      description:
        owner === "plans"
          ? "`max` is stored for usage entitlements only; `null` or omitted means unlimited."
          : "An incentive's `max` overrides the plan's for the same entitlement; entitlements the plan lacks are added.",
      auth: "secret",
      body: [
        { name: "id", type: "string", required: true, description: "An existing entitlement ID." },
        { name: "max", type: "number | null", description: "Limit for usage entitlements. `null` = unlimited." },
      ],
      exampleBody: { id: "{{unattachedEntitlement}}", max: 100 },
      response: { description: `The updated ${label}.`, example },
      statuses: [ok(), unauthorized, notFound(`${Label} or entitlement`), { code: 409, description: `Already on this ${label}` }],
    },
    {
      group: owner,
      method: "PATCH",
      path: `${base}/entitlements/:entitlementId`,
      summary: `Change an entitlement's limit on ${aLabel}`,
      auth: "secret",
      examples: { entitlementId: attachedEntitlement },
      body: [{ name: "max", type: "number | null", required: true, description: "New limit. `null` = unlimited." }],
      exampleBody: { max: 500 },
      response: { description: `The updated ${label}.`, example },
      statuses: [ok(), unauthorized, { code: 404, description: `${Label} not found, or the entitlement isn't on it` }],
    },
    {
      group: owner,
      method: "DELETE",
      path: `${base}/entitlements/:entitlementId`,
      summary: `Detach an entitlement from ${aLabel}`,
      auth: "secret",
      examples: { entitlementId: attachedEntitlement },
      response: { description: `The updated ${label}.`, example },
      statuses: [ok(), unauthorized, notFound(Label)],
    },
    {
      group: owner,
      method: "POST",
      path: `${base}/addons`,
      summary: `Attach an add-on to ${aLabel}`,
      auth: "secret",
      body: [{ name: "id", type: "string", required: true, description: "An existing add-on ID." }],
      exampleBody: { id: "{{unattachedAddon}}" },
      response: { description: `The updated ${label}.`, example },
      statuses: [ok(), unauthorized, notFound(`${Label} or add-on`), { code: 409, description: `Already on this ${label}` }],
    },
    {
      group: owner,
      method: "DELETE",
      path: `${base}/addons/:addonId`,
      summary: `Detach an add-on from ${aLabel}`,
      auth: "secret",
      examples: owner === "plans" ? { addonId: "planAddon" } : undefined,
      response: { description: `The updated ${label}.`, example },
      statuses: [ok(), unauthorized, notFound(Label)],
    },
  ];
}

// ---------------------------------------------------------------------------
// Catalog

const NS = "/apps/:appId/namespaces/:namespaceId";
const USAGE = `${NS}/usage/:entitlementId`;

export const ENDPOINTS: Endpoint[] = [
  // Accounts
  {
    group: "accounts",
    method: "GET",
    path: "/apps/:appId/namespaces",
    summary: "List and search accounts",
    description: "Matches `q` against name and ID. Newest first.",
    auth: "secret",
    query: [
      { name: "q", type: "string", description: "Search text. `*` matches everything.", default: "*", example: "*" },
      { name: "plan", type: "string", description: "Only accounts on this plan." },
      { name: "incentive", type: "string", description: "Only accounts with this incentive." },
      { name: "has_incentive", type: "boolean", description: "`true` for accounts with any incentive.", options: ["true"] },
      ...PAGINATION,
    ],
    response: { description: "A page of accounts. `created_at` is in unix seconds.", example: { data: [ACCOUNT_HIT], total: 1, page: 1, per_page: 20 } },
    statuses: [ok(), unauthorized],
  },
  {
    group: "accounts",
    method: "GET",
    path: "/apps/:appId/namespaces/count",
    summary: "Count accounts",
    auth: "secret",
    response: { description: "Total accounts in the app.", example: { count: 1284 } },
    statuses: [ok(), unauthorized],
  },
  {
    group: "accounts",
    method: "GET",
    path: "/apps/:appId/namespaces/with-incentive",
    summary: "List accounts with an incentive",
    auth: "secret",
    query: [
      { name: "incentive", type: "string", description: "Only this incentive. Omit for any.", example: "{{incentive}}" },
      ...PAGINATION,
    ],
    response: {
      description: "Same shape as the account list.",
      example: { data: [{ ...ACCOUNT_HIT, has_incentive: true, incentive: "{{incentive}}" }], total: 1, page: 1, per_page: 20 },
    },
    statuses: [ok(), unauthorized],
  },
  {
    group: "accounts",
    method: "POST",
    path: "/apps/:appId/namespaces",
    summary: "Create an account",
    description: "Call this when someone signs up. Treat 409 as success so retries are safe.",
    auth: "secret",
    warning: "An unknown `incentive` is silently dropped rather than rejected.",
    body: [
      { name: "id", type: "string", required: true, description: "Your own ID for this customer (user or workspace). Stored as sent." },
      { name: "name", type: "string", description: "Display name." },
      { name: "plan", type: "string", required: true, description: "An existing plan ID." },
      { name: "incentive", type: "string", description: "An incentive ID to apply." },
    ],
    exampleBody: { id: "usr_demo_1", name: "Ada Lovelace", plan: "{{freePlan}}" },
    response: { description: "The new account.", example: { ...ACCOUNT, id: "usr_demo_1", plan: "{{freePlan}}" } },
    statuses: [created, badRequest("`id` is missing"), unauthorized, notFound("Plan"), conflict("An account")],
  },
  {
    group: "accounts",
    method: "GET",
    path: NS,
    summary: "Get an account",
    auth: "secret",
    response: { description: "The account record. Use `/plan` for resolved access.", example: ACCOUNT },
    statuses: [ok(), unauthorized, notFound("Account")],
  },
  {
    group: "accounts",
    method: "PATCH",
    path: NS,
    summary: "Update an account",
    description: "Shallow merge. Change `plan` from your billing webhooks; set `incentive` to apply an offer. Takes effect on the next `/plan` read.",
    auth: "secret",
    body: [
      { name: "name", type: "string", description: "Display name." },
      { name: "plan", type: "string", description: "Move the account to this plan." },
      { name: "incentive", type: "string | null", description: "Apply an incentive, or `null` to remove it." },
    ],
    exampleBody: { plan: "{{plan}}" },
    response: { description: "The updated account.", example: ACCOUNT },
    statuses: [ok(), unauthorized, notFound("Account, plan or incentive")],
  },
  {
    group: "accounts",
    method: "DELETE",
    path: NS,
    summary: "Delete an account",
    description: "Also deletes its usage counters. Usage events stay in analytics.",
    auth: "secret",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Account")],
  },
  {
    group: "accounts",
    method: "DELETE",
    path: `${NS}/incentive`,
    summary: "Remove an account's incentive",
    auth: "secret",
    response: { description: "The account with `incentive: null`.", example: ACCOUNT },
    statuses: [ok(), unauthorized, notFound("Account")],
  },

  // Access
  {
    group: "access",
    method: "GET",
    path: `${NS}/plan`,
    summary: "Get an account's resolved access",
    description:
      "The main read path. Gate features on `can`: `usage < max`, or always `true` when `max` is `null` (unlimited, and every boolean entitlement). `left` is `null` when unlimited. Entitlements that aren't listed aren't granted. Incentive overrides are already applied, and private meta keys are stripped.",
    auth: "public-or-secret",
    response: { description: "Plan, incentive, add-ons and entitlements with live usage.", example: RESOLVED_PLAN },
    statuses: [ok(), unauthorized, { code: 404, description: "Account not found, or its plan was deleted" }],
  },
  {
    group: "access",
    method: "GET",
    path: `${NS}/full-plan`,
    summary: "Get resolved access including private meta",
    description: "Same as `/plan`, plus private meta keys and `privateMetaKeys`. For your server: the public key gets `401`.",
    auth: "secret",
    response: {
      description: "Resolved access with private meta.",
      example: {
        ...RESOLVED_PLAN,
        plan: { ...RESOLVED_PLAN.plan, meta: { badge: "Most popular", stripe_price_monthly: "price_123" }, privateMetaKeys: ["stripe_price_monthly"] },
      },
    },
    statuses: [ok(), unauthorized, { code: 404, description: "Account not found, or its plan was deleted" }],
  },

  // Usage
  {
    group: "usage",
    method: "GET",
    path: `${NS}/usage`,
    summary: "Get all usage counts for an account",
    description: "Counts for the entitlements on the account's plan. Entitlements granted only by an incentive aren't included; read `/plan` for those.",
    auth: "public-or-secret",
    response: { description: "Map of entitlement ID to count.", example: { "{{usageEntitlement}}": 420, projects: 7 } },
    statuses: [ok(), unauthorized, notFound("Account")],
  },
  {
    group: "usage",
    method: "GET",
    path: USAGE,
    summary: "Get one usage count",
    auth: "public-or-secret",
    examples: { entitlementId: "usageEntitlement" },
    response: { description: "The current count.", example: { entitlement: "{{usageEntitlement}}", count: 420 } },
    statuses: [ok(), badRequest("Not a usage entitlement"), unauthorized, notFound("Account or entitlement")],
  },
  {
    group: "usage",
    method: "POST",
    path: `${USAGE}/add`,
    summary: "Add 1 to a usage count",
    auth: "public-or-secret",
    examples: { entitlementId: "usageEntitlement" },
    response: { description: "The new count.", example: { entitlement: "{{usageEntitlement}}", count: 421 } },
    statuses: [ok(), badRequest("Not a usage entitlement"), unauthorized, notFound("Account or entitlement")],
  },
  {
    group: "usage",
    method: "POST",
    path: `${USAGE}/remove`,
    summary: "Subtract 1 from a usage count",
    description: "Counts can go below zero. The public key can't lower a count.",
    auth: "secret",
    examples: { entitlementId: "usageEntitlement" },
    response: { description: "The new count.", example: { entitlement: "{{usageEntitlement}}", count: 419 } },
    statuses: [ok(), badRequest("Not a usage entitlement"), unauthorized, notFound("Account or entitlement")],
  },
  {
    group: "usage",
    method: "POST",
    path: `${USAGE}/amount`,
    summary: "Add an amount to a usage count",
    description: "Adds `amount` to the count (it doesn't set it). Negative amounts subtract: post the negative of the current count to reset a quota. The public key can only send a positive amount (or zero).",
    auth: "public-or-secret",
    examples: { entitlementId: "usageEntitlement" },
    body: [{ name: "amount", type: "integer", required: true, description: "Amount to add. May be negative." }],
    exampleBody: { amount: 25 },
    response: { description: "The new count.", example: { entitlement: "{{usageEntitlement}}", count: 445 } },
    statuses: [
      ok(),
      badRequest("Not a usage entitlement, or `amount` isn't an integer"),
      unauthorized,
      { code: 403, description: "Negative amount sent with the public key" },
      notFound("Account or entitlement"),
    ],
  },

  // Plans
  {
    group: "plans",
    method: "GET",
    path: "/apps/:appId/plans",
    summary: "List plans",
    auth: "secret",
    response: { description: "Every plan in the app.", example: [PLAN] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "plans",
    method: "POST",
    path: "/apps/:appId/plans",
    summary: "Create a plan",
    description: "Starts with no entitlements, add-ons or meta. The ID is slugified (lowercase `a-z`, `0-9`, `_`).",
    auth: "secret",
    body: [
      { name: "id", type: "string", required: true, description: "Plan ID." },
      { name: "name", type: "string", required: true, description: "Display name." },
      { name: "description", type: "string", description: "Shown in `/plan` responses." },
      { name: "note", type: "string", description: "Internal note. Never returned by `/plan`." },
      { name: "isFree", type: "boolean", description: "Marks the plan as free." },
      ...PRICING_FIELDS,
    ],
    exampleBody: { id: "team", name: "Team", description: "For small teams.", isFree: false },
    response: { description: "The new plan.", example: { ...PLAN, id: "team", name: "Team", entitlements: [], addons: [], meta: {}, pricingCard: null } },
    statuses: [created, badRequest("`id` is missing"), unauthorized, conflict("A plan")],
  },
  {
    group: "plans",
    method: "GET",
    path: "/apps/:appId/plans/:planId",
    summary: "Get a plan",
    auth: "secret",
    response: { description: "The plan.", example: PLAN },
    statuses: [ok(), unauthorized, notFound("Plan")],
  },
  {
    group: "plans",
    method: "PATCH",
    path: "/apps/:appId/plans/:planId",
    summary: "Update a plan",
    description: "Shallow merge: top-level fields you send replace the stored ones. `id` and `app_id` are ignored.",
    auth: "secret",
    body: [
      { name: "name", type: "string", description: "Display name." },
      { name: "description", type: "string | null", description: "Description." },
      { name: "note", type: "string | null", description: "Internal note." },
      { name: "isFree", type: "boolean", description: "Marks the plan as free." },
      ...PRICING_FIELDS,
      { name: "privateMetaKeys", type: "string[]", description: "Meta keys stripped from `/plan` responses." },
    ],
    exampleBody: { description: "For growing teams that need more power." },
    response: { description: "The updated plan.", example: PLAN },
    statuses: [ok(), unauthorized, notFound("Plan")],
  },
  {
    group: "plans",
    method: "DELETE",
    path: "/apps/:appId/plans/:planId",
    summary: "Delete a plan",
    auth: "secret",
    warning: "Accounts on this plan keep its ID, and their `/plan` calls return 404 until you move them to another plan.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Plan")],
  },
  {
    group: "plans",
    method: "PATCH",
    path: "/apps/:appId/plans/:planId/meta",
    summary: "Merge plan metadata",
    description: "Shallow-merges the body into `meta`. Setting a key to `null` stores `null`.",
    auth: "secret",
    body: [{ name: "<key>", type: "any JSON", description: "Any key/value pairs." }],
    exampleBody: { badge: "Most popular", trial_days: 14 },
    response: { description: "The updated plan.", example: PLAN },
    statuses: [ok(), unauthorized, notFound("Plan")],
  },
  {
    group: "plans",
    method: "GET",
    path: "/apps/:appId/plans/:planId/namespaces",
    summary: "List accounts on a plan",
    auth: "secret",
    query: PAGINATION,
    response: { description: "A page of `{ id, name }`.", example: { data: [{ id: "{{account}}", name: "Ada Lovelace" }], total: 1, page: 1, per_page: 20 } },
    statuses: [ok(), unauthorized],
  },
  ...attachmentEndpoints("plans"),

  // Pricing
  {
    group: "pricing",
    method: "GET",
    path: "/apps/:appId/plans/pricing",
    summary: "List pricing cards",
    description: "One card per plan that has a pricing card, flattened with `plan_id` and `isFree`.",
    auth: "public-or-secret",
    response: { description: "Pricing cards.", example: [{ plan_id: "{{pricedPlan}}", isFree: false, ...PRICING_CARD }] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "pricing",
    method: "GET",
    path: "/apps/:appId/plans/:planId/pricing",
    summary: "Get one plan's pricing card",
    auth: "public-or-secret",
    examples: { planId: "pricedPlan" },
    response: { description: "The pricing card.", example: { plan_id: "{{pricedPlan}}", isFree: false, ...PRICING_CARD } },
    statuses: [ok(), unauthorized, { code: 404, description: "Plan not found, or it has no pricing card" }],
  },

  // Entitlements
  {
    group: "entitlements",
    method: "GET",
    path: "/apps/:appId/entitlements",
    summary: "List entitlements",
    auth: "secret",
    response: { description: "Every entitlement in the app.", example: [ENTITLEMENT] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "entitlements",
    method: "POST",
    path: "/apps/:appId/entitlements",
    summary: "Create an entitlement",
    description: "The ID is slugified (lowercase `a-z`, `0-9`, `_`).",
    auth: "secret",
    body: [
      { name: "id", type: "string", required: true, description: "Entitlement ID, e.g. `ai_credits`." },
      { name: "type", type: '"usage" | "boolean"', required: true, description: "`usage` is counted against a max; `boolean` is a feature flag." },
      { name: "name", type: "string", required: true, description: "Display name." },
      { name: "description", type: "string", description: "Description." },
    ],
    exampleBody: { id: "exports", type: "usage", name: "Exports", description: "Exports per month." },
    response: { description: "The new entitlement.", example: { ...ENTITLEMENT, id: "exports", name: "Exports", description: "Exports per month." } },
    statuses: [created, badRequest("`id` is missing or `type` is invalid"), unauthorized, conflict("An entitlement")],
  },
  {
    group: "entitlements",
    method: "GET",
    path: "/apps/:appId/entitlements/:entitlementId",
    summary: "Get an entitlement",
    auth: "secret",
    response: { description: "The entitlement.", example: ENTITLEMENT },
    statuses: [ok(), unauthorized, notFound("Entitlement")],
  },
  {
    group: "entitlements",
    method: "PATCH",
    path: "/apps/:appId/entitlements/:entitlementId",
    summary: "Update an entitlement",
    description: "Shallow merge. `type` is validated when sent.",
    auth: "secret",
    body: [
      { name: "name", type: "string", description: "Display name." },
      { name: "description", type: "string | null", description: "Description." },
      { name: "type", type: '"usage" | "boolean"', description: "Changing it leaves existing limits on plans untouched." },
    ],
    exampleBody: { description: "Credits spent on AI generations each billing period." },
    response: { description: "The updated entitlement.", example: ENTITLEMENT },
    statuses: [ok(), badRequest("`type` is invalid"), unauthorized, notFound("Entitlement")],
  },
  {
    group: "entitlements",
    method: "DELETE",
    path: "/apps/:appId/entitlements/:entitlementId",
    summary: "Delete an entitlement",
    auth: "secret",
    warning: "Doesn't detach it from plans or incentives. Remove those references first, or `/plan` shows the raw ID.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Entitlement")],
  },

  // Add-ons
  {
    group: "addons",
    method: "GET",
    path: "/apps/:appId/addons",
    summary: "List add-ons",
    auth: "secret",
    response: { description: "Every add-on in the app.", example: [ADDON] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "addons",
    method: "POST",
    path: "/apps/:appId/addons",
    summary: "Create an add-on",
    description: "The ID is slugified (lowercase `a-z`, `0-9`, `_`).",
    auth: "secret",
    body: [
      { name: "id", type: "string", required: true, description: "Add-on ID." },
      { name: "name", type: "string", required: true, description: "Display name." },
      { name: "description", type: "string", description: "Description." },
    ],
    exampleBody: { id: "priority_queue", name: "Priority queue" },
    response: { description: "The new add-on.", example: { ...ADDON, id: "priority_queue", name: "Priority queue", description: null } },
    statuses: [created, badRequest("`id` is missing"), unauthorized, conflict("An add-on")],
  },
  {
    group: "addons",
    method: "GET",
    path: "/apps/:appId/addons/:addonId",
    summary: "Get an add-on",
    auth: "secret",
    response: { description: "The add-on.", example: ADDON },
    statuses: [ok(), unauthorized, notFound("Add-on")],
  },
  {
    group: "addons",
    method: "PATCH",
    path: "/apps/:appId/addons/:addonId",
    summary: "Update an add-on",
    description: "Shallow merge.",
    auth: "secret",
    body: [
      { name: "name", type: "string", description: "Display name." },
      { name: "description", type: "string | null", description: "Description." },
    ],
    exampleBody: { description: "+500 GB of storage across all projects." },
    response: { description: "The updated add-on.", example: ADDON },
    statuses: [ok(), unauthorized, notFound("Add-on")],
  },
  {
    group: "addons",
    method: "DELETE",
    path: "/apps/:appId/addons/:addonId",
    summary: "Delete an add-on",
    auth: "secret",
    warning: "Doesn't detach it from plans or incentives. Remove those references first.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Add-on")],
  },

  // Incentives
  {
    group: "incentives",
    method: "GET",
    path: "/apps/:appId/incentives",
    summary: "List incentives",
    auth: "secret",
    response: { description: "Every incentive in the app.", example: [INCENTIVE] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "incentives",
    method: "POST",
    path: "/apps/:appId/incentives",
    summary: "Create an incentive",
    description: "The ID is slugified. Apply it to an account with `PATCH …/namespaces/:id { incentive }`.",
    auth: "secret",
    warning: "Inline `entitlements` and `addons` aren't validated here. Prefer the attach routes below.",
    body: [
      { name: "id", type: "string", required: true, description: "Incentive ID." },
      { name: "name", type: "string", required: true, description: "Display name." },
      { name: "description", type: "string", description: "Description." },
      { name: "entitlements", type: "{ id, max? }[]", description: "Entitlement overrides." },
      { name: "addons", type: "string[]", description: "Add-on IDs." },
    ],
    exampleBody: { id: "black_friday", name: "Black Friday", description: "Unlimited projects for a month." },
    response: { description: "The new incentive.", example: { ...INCENTIVE, id: "black_friday", name: "Black Friday", entitlements: [] } },
    statuses: [created, badRequest("`id` is missing"), unauthorized, conflict("An incentive")],
  },
  {
    group: "incentives",
    method: "GET",
    path: "/apps/:appId/incentives/:incentiveId",
    summary: "Get an incentive",
    auth: "secret",
    response: { description: "The incentive.", example: INCENTIVE },
    statuses: [ok(), unauthorized, notFound("Incentive")],
  },
  {
    group: "incentives",
    method: "PATCH",
    path: "/apps/:appId/incentives/:incentiveId",
    summary: "Update an incentive",
    description: "Shallow merge.",
    auth: "secret",
    body: [
      { name: "name", type: "string", description: "Display name." },
      { name: "description", type: "string | null", description: "Description." },
    ],
    exampleBody: { description: "Double AI credits through August." },
    response: { description: "The updated incentive.", example: INCENTIVE },
    statuses: [ok(), unauthorized, notFound("Incentive")],
  },
  {
    group: "incentives",
    method: "DELETE",
    path: "/apps/:appId/incentives/:incentiveId",
    summary: "Delete an incentive",
    auth: "secret",
    warning: "Accounts that have it keep the dangling ID. Remove it from them first.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Incentive")],
  },
  ...attachmentEndpoints("incentives"),

  // Analytics
  {
    group: "analytics",
    method: "GET",
    path: "/apps/:appId/analytics",
    summary: "Usage summary by entitlement",
    auth: "secret",
    query: [
      { name: "interval", type: "string", required: true, description: "Time window.", options: INTERVAL_OPTIONS, example: "30d" },
      { name: "namespace", type: "string", description: "Only this account." },
    ],
    response: {
      description: "`calls` is the number of usage writes; `total_amount` their summed amount.",
      example: [{ entitlement_id: "{{usageEntitlement}}", calls: 1840, total_amount: 23310 }],
    },
    statuses: [ok(), badRequest("`interval` is missing or invalid"), unauthorized],
  },
  {
    group: "analytics",
    method: "GET",
    path: "/apps/:appId/analytics/top-namespaces",
    summary: "Top accounts by usage",
    auth: "secret",
    query: [
      { name: "interval", type: "string", description: "Time window.", options: INTERVAL_OPTIONS, default: "7d", example: "30d" },
      { name: "limit", type: "integer", description: "1–100.", default: "10" },
      { name: "entitlement", type: "string", description: "Only this entitlement.", example: "{{usageEntitlement}}" },
    ],
    response: { description: "Accounts ordered by calls.", example: [{ namespace_id: "{{account}}", calls: 212, total_amount: 3120 }] },
    statuses: [ok(), badRequest("`interval` or `limit` is invalid"), unauthorized],
  },
  {
    group: "analytics",
    method: "GET",
    path: "/apps/:appId/analytics/timeseries",
    summary: "Usage over time",
    description: "Daily buckets up to 60 days, weekly beyond.",
    auth: "secret",
    query: [
      { name: "interval", type: "string", description: "Time window.", options: INTERVAL_OPTIONS, default: "30d", example: "30d" },
      { name: "namespace", type: "string", description: "Only this account." },
      { name: "entitlement", type: "string", description: "Only this entitlement." },
    ],
    response: {
      description: "One row per bucket and entitlement.",
      example: [{ date: "2026-09-29", entitlement_id: "{{usageEntitlement}}", calls: 64, total_amount: 812 }],
    },
    statuses: [ok(), badRequest("`interval` is invalid"), unauthorized],
  },
  {
    group: "analytics",
    method: "GET",
    path: "/apps/:appId/analytics/events",
    summary: "Recent usage events",
    auth: "secret",
    query: [
      { name: "namespace", type: "string", description: "Only this account.", example: "{{account}}" },
      { name: "entitlement", type: "string", description: "Only this entitlement." },
      { name: "limit", type: "integer", description: "1–200.", default: "50", example: "20" },
    ],
    response: {
      description: "Newest first. `count` is the counter value after the write.",
      example: [
        { id: 9123, namespace_id: "{{account}}", entitlement_id: "{{usageEntitlement}}", operation: "amount", amount: 25, count: 445, created_at: "2026-10-03T09:41:00.000Z" },
      ],
    },
    statuses: [ok(), unauthorized],
  },

  // Webhooks
  {
    group: "webhooks",
    method: "GET",
    path: "/apps/:appId/webhooks",
    summary: "List webhook endpoints",
    auth: "secret",
    response: { description: "Endpoints in creation order, each with delivery stats for the last 7 days.", example: [WEBHOOK_EXAMPLE] },
    statuses: [ok(), unauthorized],
  },
  {
    group: "webhooks",
    method: "POST",
    path: "/apps/:appId/webhooks",
    summary: "Create a webhook endpoint",
    description:
      "Also the subscribe call for Zapier REST hooks: pass Zapier's `targetUrl` as `url`, one event and `source: \"zapier\"`, and store the returned `id` to unsubscribe.",
    auth: "secret",
    body: [
      { name: "url", type: "string", description: "Public http(s) URL to POST events to.", required: true },
      { name: "events", type: "string[]", description: "Event types, or `[\"*\"]` for all of them (including future ones).", required: true },
      { name: "description", type: "string", description: "Shown in the dashboard." },
      { name: "source", type: "string", description: "`custom` (default) or `zapier`." },
      { name: "enabled", type: "boolean", description: "Defaults to true." },
    ],
    exampleBody: { url: "https://api.example.com/webhooks/offer", events: ["account.plan_changed", "usage.limit_reached"], description: "Billing service" },
    response: { description: "The endpoint, including its `whsec_…` signing secret.", example: WEBHOOK_EXAMPLE },
    statuses: [created, badRequest("Invalid URL, unknown event type, or too many endpoints"), unauthorized],
  },
  {
    group: "webhooks",
    method: "GET",
    path: "/apps/:appId/webhooks/:webhookId",
    summary: "Get a webhook endpoint",
    auth: "secret",
    response: { description: "The endpoint.", example: WEBHOOK_EXAMPLE },
    statuses: [ok(), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "PATCH",
    path: "/apps/:appId/webhooks/:webhookId",
    summary: "Update a webhook endpoint",
    description: "Change the URL, events or description, or pause it with `enabled: false`. Re-enabling clears `disabled_reason`.",
    auth: "secret",
    body: [
      { name: "url", type: "string", description: "New URL." },
      { name: "events", type: "string[]", description: "Replaces the subscribed events." },
      { name: "description", type: "string | null", description: "Shown in the dashboard." },
      { name: "enabled", type: "boolean", description: "Pause or resume deliveries." },
    ],
    exampleBody: { enabled: true },
    response: { description: "The updated endpoint.", example: WEBHOOK_EXAMPLE },
    statuses: [ok(), badRequest("Invalid URL or unknown event type"), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "DELETE",
    path: "/apps/:appId/webhooks/:webhookId",
    summary: "Delete a webhook endpoint",
    description: "Stops deliveries and deletes the endpoint's delivery log. The unsubscribe call for Zapier REST hooks.",
    auth: "secret",
    confirm: "The endpoint stops receiving events and its delivery log is deleted.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "POST",
    path: "/apps/:appId/webhooks/:webhookId/secret/regenerate",
    summary: "Roll the signing secret",
    description: "The old secret stops working immediately.",
    auth: "secret",
    confirm: "The current signing secret stops working immediately; deliveries fail verification until your server has the new one.",
    response: { description: "The new secret.", example: { secret: "whsec_…" } },
    statuses: [ok(), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "POST",
    path: "/apps/:appId/webhooks/:webhookId/test",
    summary: "Send a test event",
    description: "Sends a sample payload (marked `\"test\": true`) right away and returns the finished delivery. Works on paused endpoints too.",
    auth: "secret",
    body: [{ name: "type", type: "string", description: "Event type to sample. Defaults to the endpoint's first event." }],
    exampleBody: { type: "account.plan_changed" },
    response: { description: "The delivery, after its single attempt.", example: DELIVERY_EXAMPLE },
    statuses: [ok(), badRequest("Unknown event type"), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "GET",
    path: "/apps/:appId/webhooks/:webhookId/deliveries",
    summary: "List deliveries",
    auth: "secret",
    query: [
      { name: "status", type: "string", description: "Only deliveries with this status.", options: ["pending", "succeeded", "failed"] },
      { name: "limit", type: "integer", description: "1–100.", default: "50", example: "20" },
    ],
    response: { description: "Newest first, with the request body and the endpoint's response.", example: [DELIVERY_EXAMPLE] },
    statuses: [ok(), unauthorized, notFound("Webhook endpoint")],
  },
  {
    group: "webhooks",
    method: "POST",
    path: "/apps/:appId/webhooks/:webhookId/deliveries/:deliveryId/retry",
    summary: "Retry a delivery",
    description: "Attempts the delivery once more, right away.",
    auth: "secret",
    noTryIt: "Retry deliveries from the endpoint's delivery log.",
    response: { description: "The delivery after the attempt.", example: DELIVERY_EXAMPLE },
    statuses: [ok(), unauthorized, notFound("Delivery")],
  },
  {
    group: "webhooks",
    method: "GET",
    path: "/apps/:appId/events",
    summary: "List recent events",
    description: "Every event recorded for the app in the last 30 days, in the same shape that's delivered. Use it as Zapier's `performList` sample.",
    auth: "secret",
    query: [
      { name: "type", type: "string", description: "Only this event type.", example: "account.created" },
      { name: "limit", type: "integer", description: "1–100.", default: "20", example: "3" },
    ],
    response: { description: "Event payloads, newest first.", example: [EVENT_EXAMPLE] },
    statuses: [ok(), badRequest("Unknown event type"), unauthorized],
  },

  // App & keys
  {
    group: "app",
    method: "GET",
    path: "/apps/:appId",
    summary: "Get the app",
    auth: "secret",
    response: {
      description: "The app, including both keys.",
      example: { id: "{{appId}}", name: "{{appName}}", api_key: "key_…", public_key: "pub_…", created_at: "2026-06-01T09:00:00.000Z" },
    },
    statuses: [ok(), unauthorized, notFound("App")],
  },
  {
    group: "app",
    method: "PATCH",
    path: "/apps/:appId",
    summary: "Update the app",
    description: "Shallow merge. `id`, `api_key`, `public_key` and `created_at` are ignored; use the regenerate routes for keys.",
    auth: "secret",
    body: [{ name: "name", type: "string", description: "App name." }],
    exampleBody: { name: "{{appName}}" },
    response: {
      description: "The updated app.",
      example: { id: "{{appId}}", name: "{{appName}}", api_key: "key_…", public_key: "pub_…", created_at: "2026-06-01T09:00:00.000Z" },
    },
    statuses: [ok(), unauthorized, notFound("App")],
  },
  {
    group: "app",
    method: "DELETE",
    path: "/apps/:appId",
    summary: "Delete the app",
    description: "Permanently deletes the app with every plan, entitlement, add-on, incentive, account and usage record.",
    auth: "secret",
    noTryIt: "Delete apps from App settings, so your workspace stays in sync.",
    response: deleted,
    statuses: [ok(), unauthorized, notFound("App")],
  },
  {
    group: "app",
    method: "POST",
    path: "/apps/:appId/keys/regenerate",
    summary: "Regenerate the secret key",
    description: "The old key stops working immediately.",
    auth: "secret",
    confirm: "The current secret key stops working immediately. Servers using it get 401s until you update OFFER_SECRET_KEY.",
    response: { description: "The new key.", example: { api_key: "key_…" } },
    statuses: [ok(), unauthorized, notFound("App")],
  },
  {
    group: "app",
    method: "POST",
    path: "/apps/:appId/public-key/regenerate",
    summary: "Regenerate the public key",
    description: "The old key stops working immediately.",
    auth: "secret",
    confirm: "The current public key stops working immediately. Browsers using it get 401s until you ship the new key.",
    response: { description: "The new key.", example: { public_key: "pub_…" } },
    statuses: [ok(), unauthorized, notFound("App")],
  },
];
