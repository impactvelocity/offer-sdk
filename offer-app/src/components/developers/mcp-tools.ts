// The Offer MCP server's tools, resources and prompts. Every tool is one API endpoint from
// ./endpoints: same params, same behaviour, scoped to the app in the server URL so `appId` is
// never an argument. Endpoints that could lock you out stay off MCP.
//
// The server itself runs in the API (api/src/mcp) and reads its tools from tools.json, which
// `pnpm mcp:tools` writes from mcpToolManifest() below (test/mcp-tools.test.ts fails when stale).

import { ENDPOINTS, PATH_PARAMS, pathParams, type Endpoint, type ExampleKey, type GroupId } from "./endpoints";

/** `read`: GET. `write`: creates or changes data. `destructive`: deletes data or breaks integrations. */
export type ToolKind = "read" | "write" | "destructive";

/** What a connection is allowed to call, before per-tool overrides. */
export type AccessLevel = "read" | "write" | "full";

export const ACCESS_LEVELS: { value: AccessLevel; label: string; description: string }[] = [
  { value: "read", label: "Read only", description: "Look up accounts, catalog, usage and analytics. Nothing changes." },
  { value: "write", label: "Read & write", description: "Also create and update accounts, plans, incentives and usage. No deletes." },
  { value: "full", label: "Full access", description: "Everything, including deletes. Clients ask before running destructive tools." },
];

export function levelAllows(level: AccessLevel, kind: ToolKind) {
  if (kind === "read") return true;
  if (kind === "write") return level !== "read";
  return level === "full";
}

type JsonSchema = {
  type?: string | string[];
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface McpTool {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  endpoint: Endpoint;
  inputSchema: JsonSchema;
  /** MCP tool annotations, as clients see them. */
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  /** Arguments with {{placeholders}}; fill with fillExample(). */
  exampleArgs: Record<string, unknown>;
  /** How the tool differs from calling the endpoint directly. */
  note?: string;
}

/** "GET /namespaces/:namespaceId/plan": the endpoint path without the /apps/:appId prefix. */
export function routeKey(e: Pick<Endpoint, "method" | "path">) {
  return `${e.method} ${e.path.replace(/^\/apps\/:appId/, "") || "/"}`;
}

const NS = "/namespaces/:namespaceId";
const USAGE = `${NS}/usage/:entitlementId`;

/** Tool name per endpoint, or why the endpoint isn't exposed. Every endpoint must be listed. */
const TOOL_NAMES: Record<string, string | { excluded: string }> = {
  "GET /namespaces": "list_accounts",
  "GET /namespaces/count": "count_accounts",
  "GET /namespaces/with-incentive": "list_accounts_with_incentive",
  "POST /namespaces": "create_account",
  [`GET ${NS}`]: "get_account",
  [`PATCH ${NS}`]: "update_account",
  [`DELETE ${NS}`]: "delete_account",
  [`DELETE ${NS}/incentive`]: "remove_account_incentive",

  [`GET ${NS}/plan`]: "get_account_access",
  [`GET ${NS}/full-plan`]: "get_account_access_private",

  [`GET ${NS}/usage`]: "get_account_usage",
  [`GET ${USAGE}`]: "get_usage_count",
  [`POST ${USAGE}/add`]: "increment_usage",
  [`POST ${USAGE}/remove`]: "decrement_usage",
  [`POST ${USAGE}/amount`]: "add_usage_amount",

  "GET /plans": "list_plans",
  "POST /plans": "create_plan",
  "GET /plans/:planId": "get_plan",
  "PATCH /plans/:planId": "update_plan",
  "DELETE /plans/:planId": "delete_plan",
  "PATCH /plans/:planId/meta": "merge_plan_meta",
  "GET /plans/:planId/namespaces": "list_plan_accounts",
  "POST /plans/:planId/entitlements": "attach_plan_entitlement",
  "PATCH /plans/:planId/entitlements/:entitlementId": "set_plan_entitlement_limit",
  "DELETE /plans/:planId/entitlements/:entitlementId": "detach_plan_entitlement",
  "POST /plans/:planId/addons": "attach_plan_addon",
  "DELETE /plans/:planId/addons/:addonId": "detach_plan_addon",

  "GET /plans/pricing": "list_pricing_cards",
  "GET /plans/:planId/pricing": "get_pricing_card",

  "GET /entitlements": "list_entitlements",
  "POST /entitlements": "create_entitlement",
  "GET /entitlements/:entitlementId": "get_entitlement",
  "PATCH /entitlements/:entitlementId": "update_entitlement",
  "DELETE /entitlements/:entitlementId": "delete_entitlement",

  "GET /addons": "list_addons",
  "POST /addons": "create_addon",
  "GET /addons/:addonId": "get_addon",
  "PATCH /addons/:addonId": "update_addon",
  "DELETE /addons/:addonId": "delete_addon",

  "GET /incentives": "list_incentives",
  "POST /incentives": "create_incentive",
  "GET /incentives/:incentiveId": "get_incentive",
  "PATCH /incentives/:incentiveId": "update_incentive",
  "DELETE /incentives/:incentiveId": "delete_incentive",
  "POST /incentives/:incentiveId/entitlements": "attach_incentive_entitlement",
  "PATCH /incentives/:incentiveId/entitlements/:entitlementId": "set_incentive_entitlement_limit",
  "DELETE /incentives/:incentiveId/entitlements/:entitlementId": "detach_incentive_entitlement",
  "POST /incentives/:incentiveId/addons": "attach_incentive_addon",
  "DELETE /incentives/:incentiveId/addons/:addonId": "detach_incentive_addon",

  "GET /analytics": "get_usage_summary",
  "GET /analytics/top-namespaces": "top_accounts_by_usage",
  "GET /analytics/timeseries": "get_usage_timeseries",
  "GET /analytics/events": "list_usage_events",

  "GET /webhooks": "list_webhooks",
  "POST /webhooks": "create_webhook",
  "GET /webhooks/:webhookId": "get_webhook",
  "PATCH /webhooks/:webhookId": "update_webhook",
  "DELETE /webhooks/:webhookId": "delete_webhook",
  "POST /webhooks/:webhookId/secret/regenerate": {
    excluded: "Rolling the signing secret breaks verification until your server has the new one. Do it from the webhook's page.",
  },
  "POST /webhooks/:webhookId/test": "send_test_event",
  "GET /webhooks/:webhookId/deliveries": "list_webhook_deliveries",
  "POST /webhooks/:webhookId/deliveries/:deliveryId/retry": "retry_webhook_delivery",
  "GET /events": "list_events",

  "GET /": "get_app",
  "PATCH /": "update_app",
  "DELETE /": { excluded: "Deleting the app removes every record. Only possible from App settings." },
  "POST /keys/regenerate": { excluded: "Rotating keys would cut off your servers. Rotate them from API keys." },
  "POST /public-key/regenerate": { excluded: "Rotating keys would cut off your clients. Rotate them from API keys." },
};

const NOTES: Record<string, string> = {
  get_app: "`api_key` and `public_key` are redacted over MCP.",
  update_app: "Only `name` can change. Keys can't be rotated over MCP.",
  merge_plan_meta: "Takes the keys to merge under `meta` instead of as the raw body.",
  list_webhooks: "Signing secrets are redacted over MCP; copy them from the webhook's page.",
  get_webhook: "The signing secret is redacted over MCP; copy it from the webhook's page.",
  create_webhook: "The signing secret is redacted over MCP; copy it from the webhook's page.",
  update_webhook: "The signing secret is redacted over MCP.",
};

/** Calls that reach your own systems (webhook URLs), so clients treat them as open-world. */
const OPEN_WORLD = new Set(["send_test_event", "retry_webhook_delivery"]);

/** Turns the reference's loose type strings ("number | null", `"usage" | "boolean"`) into JSON Schema. */
function fieldSchema(type: string, description: string): JsonSchema {
  const nullable = /\|\s*null$/.test(type);
  const base = type.replace(/\s*\|\s*null$/, "").trim();
  let schema: JsonSchema;
  if (base.startsWith('"')) schema = { type: "string", enum: base.split("|").map((v) => v.trim().replace(/"/g, "")) };
  else if (base === "string[]") schema = { type: "array", items: { type: "string" } };
  else if (base.endsWith("[]")) schema = { type: "array", items: { type: "object" } };
  else if (["string", "integer", "number", "boolean", "object"].includes(base)) schema = { type: base };
  else schema = {};
  if (nullable && typeof schema.type === "string") schema.type = [schema.type, "null"];
  return { ...schema, description };
}

function buildSchema(e: Endpoint): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const name of pathParams(e.path)) {
    if (name === "appId") continue;
    properties[name] = { type: "string", description: PATH_PARAMS[name]?.description ?? `${name}.` };
    required.push(name);
  }
  for (const q of e.query ?? []) {
    const type = q.type === "integer" ? "integer" : q.type === "boolean" ? "boolean" : "string";
    properties[q.name] = {
      type,
      description: q.description,
      ...(q.options && type === "string" ? { enum: q.options } : {}),
      ...(q.default !== undefined ? { default: type === "integer" ? Number(q.default) : q.default } : {}),
    };
    if (q.required) required.push(q.name);
  }
  for (const f of e.body ?? []) {
    if (f.name === "<key>") {
      properties.meta = { type: "object", additionalProperties: true, description: "Key/value pairs to merge into `meta`." };
      required.push("meta");
      continue;
    }
    properties[f.name] = fieldSchema(f.type, f.description);
    if (f.required) required.push(f.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function buildExampleArgs(e: Endpoint): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const name of pathParams(e.path)) {
    if (name === "appId") continue;
    const key: ExampleKey | undefined = e.examples?.[name] ?? PATH_PARAMS[name]?.example;
    args[name] = key ? `{{${key}}}` : name;
  }
  for (const q of e.query ?? []) if (q.example) args[q.name] = q.type === "integer" ? Number(q.example) : q.example;
  if (e.exampleBody && typeof e.exampleBody === "object") {
    if (e.body?.some((f) => f.name === "<key>")) args.meta = e.exampleBody;
    else Object.assign(args, e.exampleBody);
  }
  return args;
}

function kindOf(e: Endpoint): ToolKind {
  if (e.method === "GET") return "read";
  if (e.method === "DELETE" || e.confirm) return "destructive";
  return "write";
}

export const MCP_TOOLS: McpTool[] = ENDPOINTS.flatMap((e) => {
  const entry = TOOL_NAMES[routeKey(e)];
  if (typeof entry !== "string") return [];
  const kind = kindOf(e);
  const description = [e.summary + ".", e.description, e.warning].filter(Boolean).join(" ");
  return [
    {
      name: entry,
      title: e.summary,
      description,
      kind,
      endpoint: e,
      inputSchema: buildSchema(e),
      annotations: {
        readOnlyHint: kind === "read",
        destructiveHint: kind === "destructive",
        idempotentHint: e.method !== "POST",
        openWorldHint: OPEN_WORLD.has(entry),
      },
      exampleArgs: buildExampleArgs(e),
      note: NOTES[entry],
    },
  ];
});

/** What the API's MCP server needs to list and run each tool (api/src/mcp/tools.json). */
export function mcpToolManifest() {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.note ? `${t.description} ${t.note}` : t.description,
    kind: t.kind,
    method: t.endpoint.method,
    path: t.endpoint.path,
    query: (t.endpoint.query ?? []).map((q) => q.name),
    /** `fields`: the arguments left after path and query params are the JSON body. `meta`: the `meta` argument is. */
    body: t.endpoint.method === "GET" || t.endpoint.method === "DELETE" ? null : t.endpoint.body?.some((f) => f.name === "<key>") ? "meta" : "fields",
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  }));
}

/** Endpoints deliberately kept off MCP, with the reason. */
export const EXCLUDED_ENDPOINTS: { endpoint: Endpoint; reason: string }[] = ENDPOINTS.flatMap((e) => {
  const entry = TOOL_NAMES[routeKey(e)];
  return entry && typeof entry === "object" ? [{ endpoint: e, reason: entry.excluded }] : [];
});

/** Route keys with no entry in TOOL_NAMES. Should always be empty (checked in tests). */
export const UNMAPPED_ROUTES = ENDPOINTS.map(routeKey).filter((key) => !(key in TOOL_NAMES));

export const toolsByGroup = (group: GroupId) => MCP_TOOLS.filter((t) => t.endpoint.group === group);

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  /** The GET routes the resource reads. */
  routes: string[];
}

export const MCP_RESOURCES: McpResource[] = [
  { uri: "offer://app", name: "App", description: "Name and ID. Keys are redacted.", routes: ["GET /"] },
  {
    uri: "offer://catalog",
    name: "Catalog",
    description: "Every plan, entitlement, add-on and incentive in one document. Clients usually load this first.",
    routes: ["GET /plans", "GET /entitlements", "GET /addons", "GET /incentives"],
  },
  { uri: "offer://pricing", name: "Pricing cards", description: "The pricing cards your pricing page renders.", routes: ["GET /plans/pricing"] },
  {
    uri: "offer://accounts/{namespaceId}",
    name: "Account access",
    description: "An account's resolved plan, incentive, add-ons and live usage.",
    routes: [`GET ${NS}/plan`],
  },
  { uri: "offer://events", name: "Recent events", description: "Events from the last 30 days, newest first.", routes: ["GET /events"] },
];

export interface McpPrompt {
  name: string;
  description: string;
  arguments: { name: string; description: string; required?: boolean }[];
}

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "review_catalog",
    description: "Audit plans, entitlements and incentives for gaps, unused records and dangling references.",
    arguments: [],
  },
  {
    name: "investigate_account",
    description: "Explain what an account can do right now, and why: plan, incentive overrides and usage.",
    arguments: [{ name: "namespaceId", description: "The account ID.", required: true }],
  },
  {
    name: "launch_incentive",
    description: "Draft an incentive, attach its overrides, and list the accounts it should go to.",
    arguments: [
      { name: "goal", description: "What the offer should achieve, e.g. “win back churned Pro accounts”.", required: true },
      { name: "plan", description: "Only target accounts on this plan." },
    ],
  },
  {
    name: "debug_webhooks",
    description: "Find failing webhook deliveries and suggest a fix.",
    arguments: [{ name: "webhookId", description: "One endpoint. Omit to check all of them." }],
  },
];
