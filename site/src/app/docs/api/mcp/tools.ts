/*
 * The MCP server's tools, grouped like the Endpoint reference. Copied from api/src/mcp/tools.json,
 * which the dashboard generates from its API reference (offer-app: `pnpm mcp:tools`). Routes are
 * relative to /apps/:appId. Update this list when tools.json changes.
 */

export type ToolKind = "read" | "write" | "destructive";
export type McpToolDoc = { name: string; kind: ToolKind; route: string };
export type McpToolGroup = { title: string; tools: McpToolDoc[] };

export const MCP_TOOL_GROUPS: McpToolGroup[] = [
  {
    title: "Accounts",
    tools: [
      { name: "list_accounts", kind: "read", route: "GET /namespaces" },
      { name: "count_accounts", kind: "read", route: "GET /namespaces/count" },
      { name: "list_accounts_with_incentive", kind: "read", route: "GET /namespaces/with-incentive" },
      { name: "create_account", kind: "write", route: "POST /namespaces" },
      { name: "get_account", kind: "read", route: "GET /namespaces/:namespaceId" },
      { name: "update_account", kind: "write", route: "PATCH /namespaces/:namespaceId" },
      { name: "delete_account", kind: "destructive", route: "DELETE /namespaces/:namespaceId" },
      { name: "remove_account_incentive", kind: "destructive", route: "DELETE /namespaces/:namespaceId/incentive" },
      { name: "get_account_access", kind: "read", route: "GET /namespaces/:namespaceId/plan" },
      { name: "get_account_access_private", kind: "read", route: "GET /namespaces/:namespaceId/full-plan" },
    ],
  },
  {
    title: "Usage",
    tools: [
      { name: "get_account_usage", kind: "read", route: "GET /namespaces/:namespaceId/usage" },
      { name: "get_usage_count", kind: "read", route: "GET /namespaces/:namespaceId/usage/:entitlementId" },
      { name: "increment_usage", kind: "write", route: "POST /namespaces/:namespaceId/usage/:entitlementId/add" },
      { name: "decrement_usage", kind: "write", route: "POST /namespaces/:namespaceId/usage/:entitlementId/remove" },
      { name: "add_usage_amount", kind: "write", route: "POST /namespaces/:namespaceId/usage/:entitlementId/amount" },
    ],
  },
  {
    title: "Plans and pricing",
    tools: [
      { name: "list_plans", kind: "read", route: "GET /plans" },
      { name: "create_plan", kind: "write", route: "POST /plans" },
      { name: "get_plan", kind: "read", route: "GET /plans/:planId" },
      { name: "update_plan", kind: "write", route: "PATCH /plans/:planId" },
      { name: "delete_plan", kind: "destructive", route: "DELETE /plans/:planId" },
      { name: "merge_plan_meta", kind: "write", route: "PATCH /plans/:planId/meta" },
      { name: "list_plan_accounts", kind: "read", route: "GET /plans/:planId/namespaces" },
      { name: "attach_plan_entitlement", kind: "write", route: "POST /plans/:planId/entitlements" },
      { name: "set_plan_entitlement_limit", kind: "write", route: "PATCH /plans/:planId/entitlements/:entitlementId" },
      { name: "detach_plan_entitlement", kind: "destructive", route: "DELETE /plans/:planId/entitlements/:entitlementId" },
      { name: "attach_plan_addon", kind: "write", route: "POST /plans/:planId/addons" },
      { name: "detach_plan_addon", kind: "destructive", route: "DELETE /plans/:planId/addons/:addonId" },
      { name: "list_pricing_cards", kind: "read", route: "GET /plans/pricing" },
      { name: "get_pricing_card", kind: "read", route: "GET /plans/:planId/pricing" },
    ],
  },
  {
    title: "Entitlements",
    tools: [
      { name: "list_entitlements", kind: "read", route: "GET /entitlements" },
      { name: "create_entitlement", kind: "write", route: "POST /entitlements" },
      { name: "get_entitlement", kind: "read", route: "GET /entitlements/:entitlementId" },
      { name: "update_entitlement", kind: "write", route: "PATCH /entitlements/:entitlementId" },
      { name: "delete_entitlement", kind: "destructive", route: "DELETE /entitlements/:entitlementId" },
    ],
  },
  {
    title: "Add-ons",
    tools: [
      { name: "list_addons", kind: "read", route: "GET /addons" },
      { name: "create_addon", kind: "write", route: "POST /addons" },
      { name: "get_addon", kind: "read", route: "GET /addons/:addonId" },
      { name: "update_addon", kind: "write", route: "PATCH /addons/:addonId" },
      { name: "delete_addon", kind: "destructive", route: "DELETE /addons/:addonId" },
    ],
  },
  {
    title: "Incentives",
    tools: [
      { name: "list_incentives", kind: "read", route: "GET /incentives" },
      { name: "create_incentive", kind: "write", route: "POST /incentives" },
      { name: "get_incentive", kind: "read", route: "GET /incentives/:incentiveId" },
      { name: "update_incentive", kind: "write", route: "PATCH /incentives/:incentiveId" },
      { name: "delete_incentive", kind: "destructive", route: "DELETE /incentives/:incentiveId" },
      { name: "attach_incentive_entitlement", kind: "write", route: "POST /incentives/:incentiveId/entitlements" },
      { name: "set_incentive_entitlement_limit", kind: "write", route: "PATCH /incentives/:incentiveId/entitlements/:entitlementId" },
      { name: "detach_incentive_entitlement", kind: "destructive", route: "DELETE /incentives/:incentiveId/entitlements/:entitlementId" },
      { name: "attach_incentive_addon", kind: "write", route: "POST /incentives/:incentiveId/addons" },
      { name: "detach_incentive_addon", kind: "destructive", route: "DELETE /incentives/:incentiveId/addons/:addonId" },
    ],
  },
  {
    title: "Analytics",
    tools: [
      { name: "get_usage_summary", kind: "read", route: "GET /analytics" },
      { name: "top_accounts_by_usage", kind: "read", route: "GET /analytics/top-namespaces" },
      { name: "get_usage_timeseries", kind: "read", route: "GET /analytics/timeseries" },
      { name: "list_usage_events", kind: "read", route: "GET /analytics/events" },
    ],
  },
  {
    title: "Webhooks and events",
    tools: [
      { name: "list_webhooks", kind: "read", route: "GET /webhooks" },
      { name: "create_webhook", kind: "write", route: "POST /webhooks" },
      { name: "get_webhook", kind: "read", route: "GET /webhooks/:webhookId" },
      { name: "update_webhook", kind: "write", route: "PATCH /webhooks/:webhookId" },
      { name: "delete_webhook", kind: "destructive", route: "DELETE /webhooks/:webhookId" },
      { name: "send_test_event", kind: "write", route: "POST /webhooks/:webhookId/test" },
      { name: "list_webhook_deliveries", kind: "read", route: "GET /webhooks/:webhookId/deliveries" },
      { name: "retry_webhook_delivery", kind: "write", route: "POST /webhooks/:webhookId/deliveries/:deliveryId/retry" },
      { name: "list_events", kind: "read", route: "GET /events" },
    ],
  },
  {
    title: "App",
    tools: [
      { name: "get_app", kind: "read", route: "GET /" },
      { name: "update_app", kind: "write", route: "PATCH /" },
    ],
  },
];

export const MCP_TOOL_COUNT = MCP_TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);
