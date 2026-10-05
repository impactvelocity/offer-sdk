import type { Examples } from "@/components/developers/use-dev-context";
import { fillExample } from "@/components/developers/use-dev-context";
import { MCP_TOOLS, type AccessLevel } from "@/components/developers/mcp-tools";
import type { ClientId, McpAuth } from "./clients";

// Sample connections and tool calls for the MCP page until the server exists. Built from the
// app's real ids so the activity log reads like this app's data.

export interface McpConnection {
  id: string;
  client: ClientId;
  label: string;
  user: { name: string; email: string };
  auth: McpAuth;
  access: AccessLevel;
  connectedAt: string;
  lastUsedAt: string;
  calls7d: number;
}

export interface McpCall {
  id: string;
  at: string;
  connectionId: string;
  tool: string;
  args: Record<string, unknown>;
  status: number;
  durationMs: number;
  result: unknown;
}

const MIN = 60_000;
const ago = (now: number, minutes: number) => new Date(now - minutes * MIN).toISOString();

export function sampleConnections(now: number, me?: { name: string; email: string }): McpConnection[] {
  return [
    {
      id: "mcpc_1",
      client: "claude",
      label: "Claude Desktop",
      user: me ?? { name: "Dylan Jones", email: "dylan@example.com" },
      auth: "oauth",
      access: "write",
      connectedAt: ago(now, 60 * 24 * 12),
      lastUsedAt: ago(now, 4),
      calls7d: 312,
    },
    {
      id: "mcpc_2",
      client: "cursor",
      label: "Cursor",
      user: { name: "Priya Shah", email: "priya@example.com" },
      auth: "oauth",
      access: "read",
      connectedAt: ago(now, 60 * 24 * 3),
      lastUsedAt: ago(now, 52),
      calls7d: 88,
    },
    {
      id: "mcpc_3",
      client: "claude-code",
      label: "Claude Code · billing-service",
      user: { name: "Marcus Lee", email: "marcus@example.com" },
      auth: "key",
      access: "full",
      connectedAt: ago(now, 60 * 24 * 30),
      lastUsedAt: ago(now, 60 * 26),
      calls7d: 41,
    },
  ];
}

const responseFor = (tool: string, ex: Examples) => {
  const example = MCP_TOOLS.find((t) => t.name === tool)?.endpoint.response.example;
  return example === undefined ? { ok: true } : fillExample(example, ex);
};

export function sampleActivity(now: number, ex: Examples): McpCall[] {
  const calls: Omit<McpCall, "id" | "result">[] = [
    { at: ago(now, 4), connectionId: "mcpc_1", tool: "update_account", args: { namespaceId: ex.account, incentive: ex.incentive }, status: 200, durationMs: 142 },
    { at: ago(now, 4.2), connectionId: "mcpc_1", tool: "get_account_access", args: { namespaceId: ex.account }, status: 200, durationMs: 61 },
    { at: ago(now, 5), connectionId: "mcpc_1", tool: "top_accounts_by_usage", args: { interval: "30d", entitlement: ex.usageEntitlement, limit: 10 }, status: 200, durationMs: 188 },
    { at: ago(now, 19), connectionId: "mcpc_1", tool: "delete_plan", args: { planId: ex.freePlan }, status: 403, durationMs: 9 },
    { at: ago(now, 52), connectionId: "mcpc_2", tool: "list_plans", args: {}, status: 200, durationMs: 47 },
    { at: ago(now, 53), connectionId: "mcpc_2", tool: "get_account", args: { namespaceId: "usr_does_not_exist" }, status: 404, durationMs: 22 },
    { at: ago(now, 60 * 3), connectionId: "mcpc_1", tool: "set_plan_entitlement_limit", args: { planId: ex.plan, entitlementId: ex.planEntitlement, max: 5000 }, status: 200, durationMs: 133 },
    { at: ago(now, 60 * 3.1), connectionId: "mcpc_1", tool: "get_plan", args: { planId: ex.plan }, status: 200, durationMs: 38 },
    { at: ago(now, 60 * 26), connectionId: "mcpc_3", tool: "list_webhook_deliveries", args: { webhookId: ex.webhook, status: "failed", limit: 20 }, status: 200, durationMs: 95 },
    { at: ago(now, 60 * 26.2), connectionId: "mcpc_3", tool: "create_incentive", args: { id: "black_friday", name: "Black Friday", description: "Unlimited projects for a month." }, status: 201, durationMs: 120 },
  ];
  return calls.map((c, i) => ({
    ...c,
    id: `mcpr_${i + 1}`,
    result:
      c.status === 403
        ? { error: "This connection has Read & write access. delete_plan needs Full access." }
        : c.status === 404
          ? { error: "Namespace not found" }
          : responseFor(c.tool, ex),
  }));
}
