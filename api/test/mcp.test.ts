// The MCP server end to end: the protocol, secret-key callers, settings, the call log
// and the full OAuth flow (registration → authorize → dashboard approval → PKCE token
// exchange → refresh → revoke). Needs DATABASE_URL like api.test.ts.
import { beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";

process.env.ADMIN_API_KEY = "test-admin-key";
process.env.APP_URL = "https://dash.test";
delete process.env.PUBLIC_API_URL;
delete process.env.RENDER_EXTERNAL_URL;

const { default: app } = await import("../src/app.ts");
const { migrate } = await import("../src/db/migrate.ts");
const { TOOLS } = await import("../src/mcp/tools.ts");

const ADMIN = "test-admin-key";
const ORIGIN = "http://localhost";

async function call(method: string, path: string, opts: { key?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
  const key = opts.key === undefined ? ADMIN : opts.key;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await app.request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, headers: res.headers };
}

let appId: string;
let apiKey: string;
let seq = 0;
const mcpPath = () => `/apps/${appId}/mcp`;

/** One JSON-RPC request to the app's MCP server. */
async function rpc(key: string, method: string, params?: unknown, headers?: Record<string, string>) {
  const res = await call("POST", mcpPath(), { key, body: { jsonrpc: "2.0", id: ++seq, method, params }, headers });
  return { ...res, result: res.json?.result, error: res.json?.error };
}

const toolCall = async (key: string, name: string, args: Record<string, unknown> = {}) => {
  const res = await rpc(key, "tools/call", { name, arguments: args });
  const text: string = res.result?.content?.[0]?.text ?? "";
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { isError: res.result?.isError as boolean, text, data };
};

beforeAll(async () => {
  await migrate();
  const created = await call("POST", "/apps", { key: null, body: { name: "MCP Test" } });
  ({ id: appId, api_key: apiKey } = created.json);
  await call("POST", `/apps/${appId}/entitlements`, { key: apiKey, body: { id: "credits", name: "Credits", type: "usage" } });
  await call("POST", `/apps/${appId}/plans`, { key: apiKey, body: { id: "free", name: "Free", isFree: true } });
});

describe("protocol", () => {
  test("asks for auth with the resource metadata URL", async () => {
    const res = await call("POST", mcpPath(), { key: null, body: { jsonrpc: "2.0", id: 1, method: "ping" } });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/apps/${appId}/mcp"`,
    );
  });

  test("rejects publishable keys and unknown tokens", async () => {
    const [{ public_key }] = [await call("GET", `/apps/${appId}`).then((r) => r.json)];
    expect((await rpc(public_key, "ping")).status).toBe(401);
    const bad = await rpc("mcp_at_nope", "ping");
    expect(bad.status).toBe(401);
    expect(bad.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
  });

  test("initializes, negotiating the protocol version, and hands key callers a session", async () => {
    const res = await rpc(apiKey, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "1" } });
    expect(res.result.protocolVersion).toBe("2025-06-18");
    expect(res.result.serverInfo).toMatchObject({ name: "offer", title: "Offer · MCP Test" });
    expect(res.result.capabilities).toHaveProperty("tools");
    expect(res.headers.get("Mcp-Session-Id")).toMatch(/^mcpc_/);
    const unknown = await rpc(apiKey, "initialize", { protocolVersion: "1999-01-01", capabilities: {} });
    expect(unknown.result.protocolVersion).toBe("2025-11-25");
  });

  test("answers notifications with 202, batches with an array, and unknown methods with -32601", async () => {
    const note = await call("POST", mcpPath(), { key: apiKey, body: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(note.status).toBe(202);
    const batch = await call("POST", mcpPath(), {
      key: apiKey,
      body: [
        { jsonrpc: "2.0", id: "a", method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ],
    });
    expect(batch.json).toEqual([{ jsonrpc: "2.0", id: "a", result: {} }]);
    expect((await rpc(apiKey, "nope/nope")).error.code).toBe(-32601);
    expect((await call("POST", mcpPath(), { key: apiKey, body: "{not json" })).json.error.code).toBe(-32700);
    expect((await call("GET", mcpPath(), { key: apiKey })).status).toBe(405);
  });

  test("lists every tool to the secret key, and runs them as the API would", async () => {
    const list = await rpc(apiKey, "tools/list");
    expect(list.result.tools).toHaveLength(TOOLS.length);
    expect(list.result.tools.find((t: any) => t.name === "delete_plan").annotations.destructiveHint).toBe(true);

    const created = await toolCall(apiKey, "create_account", { id: "usr_1", name: "Ada", plan: "free" });
    expect(created.isError).toBe(false);
    const got = await toolCall(apiKey, "get_account", { namespaceId: "usr_1" });
    expect(got.data).toMatchObject({ id: "usr_1", name: "Ada", plan: "free" });

    await toolCall(apiKey, "increment_usage", { namespaceId: "usr_1", entitlementId: "credits" });
    const usage = await toolCall(apiKey, "get_usage_count", { namespaceId: "usr_1", entitlementId: "credits" });
    expect(JSON.stringify(usage.data)).toContain("1");

    const meta = await toolCall(apiKey, "merge_plan_meta", { planId: "free", meta: { badge: "Starter" } });
    expect(meta.isError).toBe(false);
    expect((await toolCall(apiKey, "get_plan", { planId: "free" })).data.meta).toMatchObject({ badge: "Starter" });

    const missing = await toolCall(apiKey, "get_account", { namespaceId: "usr_nobody" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("404");
    expect((await toolCall(apiKey, "get_account", {})).text).toContain("namespaceId is required");
  });

  test("redacts keys and only renames the app", async () => {
    const got = await toolCall(apiKey, "get_app");
    expect(got.data).toMatchObject({ id: appId, api_key: "[redacted]", public_key: "[redacted]" });
    expect(JSON.stringify(got.data)).not.toContain(apiKey);
    await toolCall(apiKey, "update_app", { name: "MCP Test", api_key: "key_hijack" });
    expect((await call("GET", `/apps/${appId}`)).json.api_key).toBe(apiKey);
  });

  test("never shows webhook signing secrets", async () => {
    const created = await toolCall(apiKey, "create_webhook", { url: "https://example.com/hook", events: ["*"] });
    expect(created.isError).toBe(false);
    const raw = (await call("GET", `/apps/${appId}/webhooks/${created.data.id}`)).json;
    expect(raw.secret).toMatch(/\S/);
    expect(created.data.secret).toBe("[redacted]");
    expect((await toolCall(apiKey, "get_webhook", { webhookId: created.data.id })).text).not.toContain(raw.secret);
    expect((await toolCall(apiKey, "list_webhooks")).text).not.toContain(raw.secret);
  });

  test("serves resources, templates and prompts", async () => {
    const resources = await rpc(apiKey, "resources/list");
    expect(resources.result.resources.map((r: any) => r.uri)).toContain("offer://catalog");
    const catalog = await rpc(apiKey, "resources/read", { uri: "offer://catalog" });
    const doc = JSON.parse(catalog.result.contents[0].text);
    expect(Object.keys(doc)).toEqual(["plans", "entitlements", "addons", "incentives"]);
    expect(JSON.parse((await rpc(apiKey, "resources/read", { uri: "offer://app" })).result.contents[0].text).api_key).toBe("[redacted]");

    const templates = await rpc(apiKey, "resources/templates/list");
    expect(templates.result.resourceTemplates[0].uriTemplate).toBe("offer://accounts/{namespaceId}");
    const account = await rpc(apiKey, "resources/read", { uri: "offer://accounts/usr_1" });
    expect(JSON.parse(account.result.contents[0].text)).toHaveProperty("plan");

    const prompt = await rpc(apiKey, "prompts/get", { name: "investigate_account", arguments: { namespaceId: "usr_1" } });
    expect(prompt.result.messages[0].content.text).toContain("usr_1");
    expect((await rpc(apiKey, "prompts/get", { name: "investigate_account", arguments: {} })).error.code).toBe(-32602);
  });
});

describe("dashboard routes", () => {
  test("are admin-only", async () => {
    expect((await call("GET", `${mcpPath()}/settings`, { key: apiKey })).status).toBe(401);
  });

  test("log tool calls against the caller's connection", async () => {
    const connections = (await call("GET", `${mcpPath()}/connections`)).json;
    const conn = connections.find((c: any) => c.client_name === "test-client");
    expect(conn).toMatchObject({ auth: "key", access_level: "full" });

    const session = { "Mcp-Session-Id": conn.id };
    await rpc(apiKey, "tools/call", { name: "list_plans", arguments: {} }, session);
    const calls = (await call("GET", `${mcpPath()}/calls?connection_id=${conn.id}`)).json;
    expect(calls[0]).toMatchObject({ tool: "list_plans", status: 200, connection_id: conn.id });
    expect((await call("GET", `${mcpPath()}/connections`)).json.find((c: any) => c.id === conn.id).calls_7d).toBeGreaterThan(0);
  });

  test("validate and save settings; turning the server off blocks every caller", async () => {
    expect((await call("GET", `${mcpPath()}/settings`)).json).toMatchObject({ enabled: true, access_level: "write", tool_overrides: {} });
    expect((await call("PATCH", `${mcpPath()}/settings`, { body: { access_level: "admin" } })).status).toBe(400);
    expect((await call("PATCH", `${mcpPath()}/settings`, { body: { tool_overrides: { nope: true } } })).status).toBe(400);

    const off = await call("PATCH", `${mcpPath()}/settings`, { body: { enabled: false } });
    expect(off.json.enabled).toBe(false);
    expect((await rpc(apiKey, "ping")).status).toBe(403);
    await call("PATCH", `${mcpPath()}/settings`, { body: { enabled: true } });
    expect((await rpc(apiKey, "ping")).status).toBe(200);
  });
});

describe("oauth", () => {
  const redirectUri = "http://127.0.0.1:33418/callback";
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let clientId: string;
  let access: string;
  let refresh: string;

  const form = (path: string, body: Record<string, string>) =>
    call("POST", path, { key: null, body: new URLSearchParams(body).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });

  async function authorize(scope = "mcp:read") {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      scope,
      resource: `${ORIGIN}${mcpPath()}`,
    });
    const res = await app.request(`${ORIGIN}/oauth/authorize?${q}`);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://dash.test/oauth/consent");
    return location.searchParams.get("request")!;
  }

  test("publishes discovery metadata", async () => {
    const prm = (await call("GET", `/.well-known/oauth-protected-resource/apps/${appId}/mcp`, { key: null })).json;
    expect(prm).toMatchObject({ resource: `${ORIGIN}${mcpPath()}`, authorization_servers: [ORIGIN] });
    const as = (await call("GET", "/.well-known/oauth-authorization-server", { key: null })).json;
    expect(as).toMatchObject({
      issuer: ORIGIN,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  test("registers clients, refusing unsafe redirect URIs", async () => {
    const bad = await call("POST", "/oauth/register", { key: null, body: { redirect_uris: ["http://evil.example/cb"] } });
    expect(bad.status).toBe(400);
    const res = await call("POST", "/oauth/register", { key: null, body: { client_name: "Claude Code", redirect_uris: [redirectUri] } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ client_name: "Claude Code", token_endpoint_auth_method: "none" });
    expect(res.json.client_secret).toBeUndefined();
    clientId = res.json.client_id;
  });

  test("won't redirect to an unregistered URI", async () => {
    const res = await app.request(`${ORIGIN}/oauth/authorize?client_id=${clientId}&redirect_uri=https://evil.example/cb&response_type=code`);
    expect(res.status).toBe(400);
    expect(res.headers.get("Location")).toBeNull();
  });

  test("approves on the dashboard and exchanges the code with PKCE", async () => {
    const requestId = await authorize();
    const shown = await call("GET", `/oauth/requests/${requestId}`);
    expect(shown.json).toMatchObject({ app_id: appId, app_name: "MCP Test", requested_level: "read", client: { name: "Claude Code" } });
    expect((await call("GET", `/oauth/requests/${requestId}`, { key: apiKey })).status).toBe(401);

    const approved = await call("POST", `/oauth/requests/${requestId}/approve`, {
      body: { user: { id: "user_1", name: "Ada", email: "ada@example.com" }, access_level: "read" },
    });
    const redirect = new URL(approved.json.redirect_url);
    expect(redirect.searchParams.get("state")).toBe("xyz");
    const code = redirect.searchParams.get("code")!;
    expect((await call("GET", `/oauth/requests/${requestId}`)).status).toBe(404);

    const wrongVerifier = await form("/oauth/token", { grant_type: "authorization_code", code, code_verifier: "nope", client_id: clientId });
    expect(wrongVerifier.json.error).toBe("invalid_grant");

    // The failed attempt used up the code: start over.
    const again = await authorize();
    const ok = await call("POST", `/oauth/requests/${again}/approve`, {
      body: { user: { id: "user_1", name: "Ada", email: "ada@example.com" }, access_level: "read" },
    });
    const code2 = new URL(ok.json.redirect_url).searchParams.get("code")!;
    const token = await form("/oauth/token", {
      grant_type: "authorization_code",
      code: code2,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: redirectUri,
      resource: `${ORIGIN}${mcpPath()}`,
    });
    expect(token.status).toBe(200);
    expect(token.json).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "mcp:read" });
    ({ access_token: access, refresh_token: refresh } = token.json);
    const reuse = await form("/oauth/token", { grant_type: "authorization_code", code: code2, code_verifier: verifier, client_id: clientId });
    expect(reuse.json.error).toBe("invalid_grant");
  });

  test("scopes tools to the approved access level and the app's switches", async () => {
    const tools = (await rpc(access, "tools/list")).result.tools.map((t: any) => t.name);
    expect(tools).toContain("list_plans");
    expect(tools).not.toContain("create_plan");

    const denied = await toolCall(access, "create_plan", { id: "pro", name: "Pro" });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain("Read only access");
    expect((await toolCall(access, "list_plans")).isError).toBe(false);

    await call("PATCH", `${mcpPath()}/settings`, { body: { tool_overrides: { list_plans: false } } });
    expect((await toolCall(access, "list_plans")).text).toContain("turned off");
    // Resources follow the tools that read the same data.
    expect((await rpc(access, "resources/read", { uri: "offer://catalog" })).error.message).toContain("turned off");
    expect((await rpc(access, "resources/read", { uri: "offer://pricing" })).result).toBeDefined();
    // The secret key ignores the switches.
    expect((await toolCall(apiKey, "list_plans")).isError).toBe(false);
    await call("PATCH", `${mcpPath()}/settings`, { body: { tool_overrides: {} } });

    const conn = (await call("GET", `${mcpPath()}/connections`)).json.find((c: any) => c.auth === "oauth");
    expect(conn).toMatchObject({ client_name: "Claude Code", user_email: "ada@example.com", access_level: "read" });
    const calls = (await call("GET", `${mcpPath()}/calls?connection_id=${conn.id}`)).json;
    expect(calls.find((c: any) => c.tool === "create_plan").status).toBe(403);
  });

  test("tokens only work for their own app", async () => {
    const other = (await call("POST", "/apps", { key: null, body: { name: "Other" } })).json;
    const res = await call("POST", `/apps/${other.id}/mcp`, { key: access, body: { jsonrpc: "2.0", id: 1, method: "ping" } });
    expect(res.status).toBe(401);
  });

  test("rotates refresh tokens", async () => {
    const res = await form("/oauth/token", { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(res.status).toBe(200);
    expect(res.json.refresh_token).not.toBe(refresh);
    expect((await rpc(access, "ping")).status).toBe(401); // the old access token was replaced
    expect((await form("/oauth/token", { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId })).json.error).toBe(
      "invalid_grant",
    );
    ({ access_token: access, refresh_token: refresh } = res.json);
    expect((await rpc(access, "ping")).status).toBe(200);
  });

  test("revoking from the dashboard cuts the connection off", async () => {
    const conn = (await call("GET", `${mcpPath()}/connections`)).json.find((c: any) => c.auth === "oauth");
    expect((await call("DELETE", `${mcpPath()}/connections/${conn.id}`)).json).toEqual({ deleted: true });
    expect((await rpc(access, "ping")).status).toBe(401);
    expect((await form("/oauth/token", { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId })).json.error).toBe(
      "invalid_grant",
    );
  });

  test("denying sends the client access_denied", async () => {
    const requestId = await authorize();
    const res = await call("POST", `/oauth/requests/${requestId}/deny`);
    const url = new URL(res.json.redirect_url);
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("state")).toBe("xyz");
  });

  test("lets the person pick the app when the client sends no resource", async () => {
    const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256" });
    const res = await app.request(`${ORIGIN}/oauth/authorize?${q}`);
    const requestId = new URL(res.headers.get("Location")!).searchParams.get("request")!;
    expect((await call("GET", `/oauth/requests/${requestId}`)).json.app_id).toBeNull();
    const noApp = await call("POST", `/oauth/requests/${requestId}/approve`, { body: { user: { id: "user_2" }, access_level: "write" } });
    expect(noApp.status).toBe(400);
    const ok = await call("POST", `/oauth/requests/${requestId}/approve`, { body: { user: { id: "user_2" }, access_level: "write", app_id: appId } });
    const code = new URL(ok.json.redirect_url).searchParams.get("code")!;
    const token = await form("/oauth/token", { grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId });
    expect(token.json.scope).toBe("mcp:write");
    expect((await toolCall(token.json.access_token, "create_plan", { id: "team", name: "Team" })).isError).toBe(false);
  });

  test("confidential clients must send their secret", async () => {
    const reg = await call("POST", "/oauth/register", {
      key: null,
      body: { client_name: "Server client", redirect_uris: ["https://client.example/cb"], token_endpoint_auth_method: "client_secret_basic" },
    });
    expect(reg.json.client_secret).toMatch(/^mcp_cs_/);
    const noSecret = await form("/oauth/token", { grant_type: "refresh_token", refresh_token: "x", client_id: reg.json.client_id });
    expect(noSecret.status).toBe(401);
    const basic = Buffer.from(`${reg.json.client_id}:${reg.json.client_secret}`).toString("base64");
    const withSecret = await call("POST", "/oauth/token", {
      key: null,
      body: "grant_type=refresh_token&refresh_token=x",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    });
    expect(withSecret.json.error).toBe("invalid_grant");
  });
});
