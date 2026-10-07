// The MCP server's resources and prompts. Plain data with no imports: the dashboard's
// test (offer-app/test/mcp-tools.test.ts) checks its own list against this one.

export interface McpResourceDef {
  uri: string;
  name: string;
  description: string;
  /** API routes (under /apps/:appId) whose JSON makes up the resource, keyed by field. */
  routes: Record<string, string>;
  /** Tools that read the same data: an OAuth connection can read the resource only when it may call all of them. */
  tools: string[];
  /** A URI template (RFC 6570) rather than a fixed resource. */
  template?: boolean;
}

export const MCP_RESOURCES: McpResourceDef[] = [
  { uri: "offer://app", name: "App", description: "Name and ID. Keys are redacted.", routes: { app: "" }, tools: ["get_app"] },
  {
    uri: "offer://catalog",
    name: "Catalog",
    description: "Every plan, entitlement, add-on and incentive in one document. Clients usually load this first.",
    routes: { plans: "/plans", entitlements: "/entitlements", addons: "/addons", incentives: "/incentives" },
    tools: ["list_plans", "list_entitlements", "list_addons", "list_incentives"],
  },
  { uri: "offer://pricing", name: "Pricing cards", description: "The pricing cards your pricing page renders.", routes: { pricing: "/plans/pricing" }, tools: ["list_pricing_cards"] },
  {
    uri: "offer://accounts/{namespaceId}",
    name: "Account access",
    description: "An account's resolved plan, incentive, add-ons and live usage.",
    routes: { access: "/namespaces/{namespaceId}/plan" },
    tools: ["get_account_access"],
    template: true,
  },
  { uri: "offer://events", name: "Recent events", description: "Events from the last 30 days, newest first.", routes: { events: "/events" }, tools: ["list_events"] },
];

export interface McpPromptDef {
  name: string;
  title: string;
  description: string;
  arguments: { name: string; description: string; required?: boolean }[];
  /** The user message the prompt expands to. */
  text: (args: Record<string, string | undefined>) => string;
}

export const MCP_PROMPTS: McpPromptDef[] = [
  {
    name: "review_catalog",
    title: "Review the catalog",
    description: "Audit plans, entitlements and incentives for gaps, unused records and dangling references.",
    arguments: [],
    text: () =>
      [
        "Review this app's Offer catalog. Read the offer://catalog resource (or call list_plans, list_entitlements, list_addons and list_incentives).",
        "Report, as a short list per finding:",
        "- entitlements no plan or incentive uses,",
        "- plans with no entitlements, and whether exactly one plan is free,",
        "- incentives that reference entitlements or add-ons that don't exist,",
        "- limits that look inconsistent between plans (a cheaper plan allowing more than a pricier one).",
        "Suggest fixes, but don't change anything until I confirm.",
      ].join("\n"),
  },
  {
    name: "investigate_account",
    title: "Investigate an account",
    description: "Explain what an account can do right now, and why: plan, incentive overrides and usage.",
    arguments: [{ name: "namespaceId", description: "The account ID.", required: true }],
    text: (a) =>
      [
        `Explain what account \`${a.namespaceId}\` can do right now, and why.`,
        `Call get_account and get_account_access with namespaceId "${a.namespaceId}".`,
        "Cover: its plan, any incentive and which limits it overrides, add-ons, and each usage entitlement's count against its limit.",
        "Call out anything at or near its limit, and what would change if the incentive were removed.",
      ].join("\n"),
  },
  {
    name: "launch_incentive",
    title: "Launch an incentive",
    description: "Draft an incentive, attach its overrides, and list the accounts it should go to.",
    arguments: [
      { name: "goal", description: "What the offer should achieve, e.g. “win back churned Pro accounts”.", required: true },
      { name: "plan", description: "Only target accounts on this plan." },
    ],
    text: (a) =>
      [
        `Help me launch an incentive. Goal: ${a.goal}`,
        a.plan ? `Only target accounts on the \`${a.plan}\` plan (list_plan_accounts).` : "Pick the accounts that fit the goal (list_accounts, top_accounts_by_usage).",
        "1. Read offer://catalog and propose the incentive: id, name, description and the entitlement overrides or add-ons it grants.",
        "2. After I approve, create it with create_incentive, attach_incentive_entitlement and attach_incentive_addon.",
        "3. List the accounts it should go to, then assign it with update_account (incentive field) only once I confirm the list.",
      ].join("\n"),
  },
  {
    name: "debug_webhooks",
    title: "Debug webhooks",
    description: "Find failing webhook deliveries and suggest a fix.",
    arguments: [{ name: "webhookId", description: "One endpoint. Omit to check all of them." }],
    text: (a) =>
      [
        a.webhookId ? `Check webhook endpoint \`${a.webhookId}\`.` : "Check every webhook endpoint (list_webhooks).",
        "Call list_webhook_deliveries with status \"failed\" and read the response codes and bodies.",
        "Group the failures by cause (DNS, timeouts, 4xx from the receiver, signature checks), say which events were affected, and suggest a fix for each.",
        "Offer to retry failed deliveries with retry_webhook_delivery or send a test with send_test_event, but ask first.",
      ].join("\n"),
  },
];
