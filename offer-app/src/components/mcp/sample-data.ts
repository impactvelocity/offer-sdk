import type { Examples } from "@/components/developers/use-dev-context";
import { fillExample } from "@/components/developers/use-dev-context";
import { MCP_TOOLS, type AccessLevel } from "@/components/developers/mcp-tools";
import type { McpCallRecord, McpConnectionRecord } from "@/lib/api/types";
import { clientFromName, type ClientId, type McpAuth } from "./clients";

// Connections and tool calls as the MCP page shows them, plus sample ones for the preview
// against the in-memory mock (the server runs in the hosted API). Samples use the app's
// real ids so the activity log reads like this app's data.

export interface McpConnection {
  id: string;
  client: ClientId;
  label: string;
  /** Who approved it. Null for clients using the secret key. */
  user: { name: string; email: string } | null;
  auth: McpAuth;
  access: AccessLevel;
  connectedAt: string;
  lastUsedAt: string;
  calls7d: number;
}

export interface McpCall {
  id: string;
  at: string;
  connectionId: string | null;
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
      user: null,
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

export function toConnection(r: McpConnectionRecord): McpConnection {
  return {
    id: r.id,
    client: clientFromName(r.client_name),
    label: r.client_name,
    user: r.auth === "oauth" ? { name: r.user_name || r.user_email || "Unknown", email: r.user_email ?? "" } : null,
    auth: r.auth,
    access: r.access_level,
    connectedAt: r.created_at,
    lastUsedAt: r.last_used_at ?? r.created_at,
    calls7d: r.calls_7d,
  };
}

export function toCall(r: McpCallRecord): McpCall {
  return {
    id: r.id,
    at: r.created_at,
    connectionId: r.connection_id,
    tool: r.tool,
    args: r.args ?? {},
    status: r.status,
    durationMs: r.duration_ms,
    result: r.result,
  };
}
