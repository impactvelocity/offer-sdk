import { createHash, randomBytes } from "node:crypto";
import sql from "../db/client.ts";
import { prefixedId } from "../lib/ids.ts";
import { type AccessLevel, levelAllows, type ToolDef } from "./tools.ts";

// Who is calling an app's MCP server, and what they may do.
//   oauth: an access token from /oauth/token, tied to one person's approved connection.
//   key:   the app's secret key (or the admin key). Skips the access level and tool
//          switches, like the REST API; calls are logged under a connection per client name.

export const ACCESS_TOKEN_PREFIX = "mcp_at_";
export const REFRESH_TOKEN_PREFIX = "mcp_rt_";
export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const randomToken = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;

export interface McpSettings {
  enabled: boolean;
  access_level: AccessLevel;
  tool_overrides: Record<string, boolean>;
  updated_at: string | null;
}

export async function getSettings(appId: string): Promise<McpSettings> {
  const [row] = await sql`select enabled, access_level, tool_overrides, updated_at from mcp_settings where app_id = ${appId}`;
  return row ?? { enabled: true, access_level: "write", tool_overrides: {}, updated_at: null };
}

/** The app-wide switch for a tool: its override, else what the access level allows. */
export const toolSwitchedOn = (settings: McpSettings, tool: ToolDef) =>
  settings.tool_overrides[tool.name] ?? levelAllows(settings.access_level, tool.kind);

export interface Caller {
  auth: "oauth" | "key";
  /** Null for key callers that haven't initialized (no Mcp-Session-Id). */
  connectionId: string | null;
  /** OAuth only: the level the person approved. */
  accessLevel: AccessLevel | null;
}

/**
 * Whether a caller may use a tool, or why not. OAuth connections need the app-wide
 * switch on and an access level that covers the tool; the secret key needs neither.
 */
export function toolDenial(settings: McpSettings, caller: Caller, tool: ToolDef): string | null {
  if (caller.auth === "key") return null;
  if (!toolSwitchedOn(settings, tool)) return `${tool.name} is turned off for this app's MCP server.`;
  if (caller.accessLevel && !levelAllows(caller.accessLevel, tool.kind)) {
    const needs = tool.kind === "write" ? "Read & write" : "Full";
    const has = { read: "Read only", write: "Read & write", full: "Full" }[caller.accessLevel];
    return `This connection has ${has} access. ${tool.name} needs ${needs} access. Reconnect with a higher access level to use it.`;
  }
  return null;
}

/** Looks up an OAuth access token for this app. */
export async function connectionForToken(appId: string, token: string) {
  const [row] = await sql`
    select id, access_level from mcp_connections
    where access_token_hash = ${hashToken(token)} and app_id = ${appId} and access_expires_at > now()`;
  return row as { id: string; access_level: AccessLevel } | undefined;
}

/** A key caller's connection, from the Mcp-Session-Id the server handed out at initialize. */
export async function keyConnection(appId: string, sessionId: string | undefined) {
  if (!sessionId) return null;
  const [row] = await sql`select id from mcp_connections where id = ${sessionId} and app_id = ${appId} and auth = 'key'`;
  return (row?.id as string | undefined) ?? null;
}

export async function upsertKeyConnection(appId: string, clientName: string) {
  const [row] = await sql`
    insert into mcp_connections (id, app_id, auth, client_name, access_level, last_used_at)
    values (${prefixedId("mcpc", 16)}, ${appId}, 'key', ${clientName}, 'full', now())
    on conflict (app_id, client_name) where auth = 'key' do update set last_used_at = now()
    returning id`;
  return row.id as string;
}

/** Issues a fresh access and refresh token for a connection, replacing the old pair. */
export async function mintTokens(connectionId: string) {
  const access = randomToken(ACCESS_TOKEN_PREFIX);
  const refresh = randomToken(REFRESH_TOKEN_PREFIX);
  await sql`
    update mcp_connections set
      access_token_hash = ${hashToken(access)},
      access_expires_at = now() + make_interval(secs => ${ACCESS_TOKEN_TTL}),
      refresh_token_hash = ${hashToken(refresh)},
      refresh_expires_at = now() + make_interval(secs => ${REFRESH_TOKEN_TTL})
    where id = ${connectionId}`;
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TOKEN_TTL };
}

export async function touchConnection(connectionId: string) {
  await sql`update mcp_connections set last_used_at = now() where id = ${connectionId}`;
}

const MAX_RESULT_CHARS = 20_000;

/** Logs a tool call for the dashboard's Activity tab. Calls older than 30 days are pruned now and then. */
export async function logCall(call: {
  appId: string;
  connectionId: string | null;
  tool: string;
  args: unknown;
  status: number;
  durationMs: number;
  result: unknown;
}) {
  // Bun sends objects and arrays as JSON; other values are wrapped so they stay valid jsonb.
  const text = JSON.stringify(call.result ?? null);
  const result =
    text.length > MAX_RESULT_CHARS
      ? { truncated: true, preview: text.slice(0, MAX_RESULT_CHARS) }
      : call.result && typeof call.result === "object"
        ? call.result
        : { value: call.result ?? null };
  await sql`
    insert into mcp_calls (id, app_id, connection_id, tool, args, status, duration_ms, result)
    values (${prefixedId("mcpr", 16)}, ${call.appId}, ${call.connectionId}, ${call.tool}, ${(call.args ?? {}) as object}::jsonb,
            ${call.status}, ${call.durationMs}, ${result}::jsonb)`;
  if (Math.random() < 0.01) await sql`delete from mcp_calls where created_at < now() - interval '30 days'`;
}
