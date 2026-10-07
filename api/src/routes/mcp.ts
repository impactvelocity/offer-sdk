import { type Context, Hono } from "hono";
import sql from "../db/client.ts";
import { adminAuth } from "../lib/auth.ts";
import { type Json, limitParam, readObject } from "../lib/http.ts";
import {
  ACCESS_TOKEN_PREFIX,
  type Caller,
  connectionForToken,
  getSettings,
  keyConnection,
  upsertKeyConnection,
} from "../mcp/connections.ts";
import { handleMessage, rpcError } from "../mcp/server.ts";
import { ACCESS_LEVELS, TOOLS_BY_NAME } from "../mcp/tools.ts";
import { publicOrigin, resourceMetadataUrl } from "../mcp/urls.ts";

// Each app's MCP server, at /apps/:appId/mcp (see src/mcp). Mounted ahead of appAuth:
// it takes OAuth access tokens from /oauth/token as well as the app's secret key.

type Fetch = (req: Request) => Response | Promise<Response>;

function bearer(c: Context) {
  const auth = c.req.header("Authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

function unauthorized(c: Context, appId: string, error?: "invalid_token") {
  const params = [`resource_metadata="${resourceMetadataUrl(publicOrigin(c), appId)}"`];
  if (error) params.push(`error="${error}"`, `error_description="The access token is invalid or expired"`);
  c.header("WWW-Authenticate", `Bearer ${params.join(", ")}`);
  return c.json({ error: error ? "Invalid or expired access token" : "Unauthorized" }, 401);
}

async function resolveCaller(c: Context, appId: string, apiKey: string): Promise<Caller | "invalid" | null> {
  const token = bearer(c);
  if (!token) return null;
  if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
    const conn = await connectionForToken(appId, token);
    return conn ? { auth: "oauth", connectionId: conn.id, accessLevel: conn.access_level } : "invalid";
  }
  const isAdmin = !!process.env.ADMIN_API_KEY && token === process.env.ADMIN_API_KEY;
  if (isAdmin || token === apiKey) {
    return { auth: "key", connectionId: await keyConnection(appId, c.req.header("Mcp-Session-Id")), accessLevel: null };
  }
  return "invalid";
}

export function createMcpServer(apiFetch: Fetch) {
  const server = new Hono();

  server.post("/", async (c) => {
    const appId = c.req.param("appId")!;
    const [app] = await sql`select api_key, data->>'name' as name from apps where id = ${appId}`;
    if (!app) return c.json({ error: "App not found" }, 404);

    const caller = await resolveCaller(c, appId, app.api_key);
    if (!caller) return unauthorized(c, appId);
    if (caller === "invalid") return unauthorized(c, appId, "invalid_token");

    const settings = await getSettings(appId);
    if (!settings.enabled) {
      return c.json({ error: "This app's MCP server is turned off. Turn it on in the dashboard under Developers → MCP server." }, 403);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, "Parse error"), 400);
    }
    const messages = Array.isArray(body) ? body : [body];

    // Key callers get a connection per client name at initialize; the session id
    // points later calls at it.
    const init = messages.find((m) => m?.method === "initialize");
    if (init && caller.auth === "key") {
      const name = String(init.params?.clientInfo?.name ?? "").trim().slice(0, 80) || "Secret key";
      caller.connectionId = await upsertKeyConnection(appId, name);
    }
    if (init && caller.connectionId) c.header("Mcp-Session-Id", caller.connectionId);

    const ctx = {
      appId,
      appName: app.name ?? appId,
      settings,
      caller,
      api: async (req: { method: string; path: string; body?: unknown }) => {
        const res = await apiFetch(
          new Request(`http://mcp.internal${req.path}`, {
            method: req.method,
            headers: { Authorization: `Bearer ${app.api_key}`, "Content-Type": "application/json" },
            body: req.body === undefined ? undefined : JSON.stringify(req.body),
          }),
        );
        const text = await res.text();
        let json: unknown = text;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}
        return { status: res.status, json };
      },
    };

    const responses = (await Promise.all(messages.map((m) => handleMessage(ctx, m)))).filter((r) => r !== null);
    if (!responses.length) return c.body(null, 202);
    return c.json(Array.isArray(body) ? responses : responses[0]);
  });

  // No server-to-client stream and no session teardown: this server is stateless.
  const notAllowed = (c: Context) => {
    c.header("Allow", "POST");
    return c.json({ error: "Method not allowed. Send JSON-RPC messages with POST." }, 405);
  };
  server.get("/", notAllowed);
  server.delete("/", notAllowed);

  return server;
}

// Dashboard routes for the MCP page: settings, connections and the call log.
// Admin key only; app keys get 401. Not part of the public API.
export const mcpAdmin = new Hono();

mcpAdmin.use("*", adminAuth);

function settingsFields(body: Json): Json | { error: string } {
  const out: Json = {};
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") return { error: "enabled must be a boolean" };
    out.enabled = body.enabled;
  }
  if ("access_level" in body) {
    if (!ACCESS_LEVELS.includes(body.access_level)) return { error: "access_level must be read, write or full" };
    out.access_level = body.access_level;
  }
  if ("tool_overrides" in body) {
    const o = body.tool_overrides;
    if (!o || typeof o !== "object" || Array.isArray(o)) return { error: "tool_overrides must be an object" };
    for (const [name, on] of Object.entries(o)) {
      if (!TOOLS_BY_NAME.has(name)) return { error: `Unknown tool: ${name}` };
      if (typeof on !== "boolean") return { error: `tool_overrides.${name} must be a boolean` };
    }
    out.tool_overrides = o;
  }
  return out;
}

// GET /apps/:appId/mcp/settings
mcpAdmin.get("/settings", async (c) => c.json(await getSettings(c.req.param("appId")!)));

// PATCH /apps/:appId/mcp/settings  body: { enabled?, access_level?, tool_overrides? }
// tool_overrides replaces the whole map.
mcpAdmin.patch("/settings", async (c) => {
  const appId = c.req.param("appId")!;
  const f = settingsFields(await readObject(c));
  if ("error" in f) return c.json(f, 400);
  const [exists] = await sql`select 1 from apps where id = ${appId}`;
  if (!exists) return c.json({ error: "App not found" }, 404);
  const current = await getSettings(appId);
  const next = { ...current, ...f };
  const [row] = await sql`
    insert into mcp_settings (app_id, enabled, access_level, tool_overrides, updated_at)
    values (${appId}, ${next.enabled}, ${next.access_level}, ${next.tool_overrides}::jsonb, now())
    on conflict (app_id) do update set
      enabled = excluded.enabled,
      access_level = excluded.access_level,
      tool_overrides = excluded.tool_overrides,
      updated_at = now()
    returning enabled, access_level, tool_overrides, updated_at`;
  return c.json(row);
});

// GET /apps/:appId/mcp/connections
// Most recently used first, with each connection's tool calls in the last 7 days.
mcpAdmin.get("/connections", async (c) => {
  const rows = await sql`
    select mc.id, mc.auth, mc.client_id, mc.client_name, mc.user_id, mc.user_name, mc.user_email, mc.access_level,
           mc.created_at, mc.last_used_at, oc.client_uri, oc.logo_uri,
           (select count(*)::int from mcp_calls k where k.connection_id = mc.id and k.created_at > now() - interval '7 days') as calls_7d
    from mcp_connections mc
    left join mcp_oauth_clients oc on oc.id = mc.client_id
    where mc.app_id = ${c.req.param("appId")!}
    order by coalesce(mc.last_used_at, mc.created_at) desc`;
  return c.json(rows);
});

// DELETE /apps/:appId/mcp/connections/:connectionId
// OAuth connections lose access on their next call. Key connections just leave the
// list: the secret key keeps working until it's rotated.
mcpAdmin.delete("/connections/:connectionId", async (c) => {
  const [row] = await sql`
    delete from mcp_connections where app_id = ${c.req.param("appId")!} and id = ${c.req.param("connectionId")}
    returning id`;
  return row ? c.json({ deleted: true }) : c.json({ error: "Connection not found" }, 404);
});

// GET /apps/:appId/mcp/calls?connection_id=&limit=50
// Tool calls, newest first (kept 30 days).
mcpAdmin.get("/calls", async (c) => {
  const connectionId = c.req.query("connection_id");
  const rows = await sql`
    select id, connection_id, tool, args, status, duration_ms, result, created_at from mcp_calls
    where app_id = ${c.req.param("appId")!} and (${connectionId ?? null}::text is null or connection_id = ${connectionId ?? null})
    order by created_at desc
    limit ${limitParam(c, 50)}`;
  return c.json(rows);
});
