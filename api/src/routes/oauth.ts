import { createHash, timingSafeEqual } from "node:crypto";
import { type Context, Hono } from "hono";
import sql from "../db/client.ts";
import { adminAuth } from "../lib/auth.ts";
import { prefixedId } from "../lib/ids.ts";
import { type Json, readObject } from "../lib/http.ts";
import { getSettings, hashToken, mintTokens, randomToken } from "../mcp/connections.ts";
import { ACCESS_LEVELS, type AccessLevel } from "../mcp/tools.ts";
import { appIdFromResource, dashboardUrl, mcpResourceUrl, publicOrigin } from "../mcp/urls.ts";

// OAuth 2.1 for the MCP server, as MCP clients expect it: protected resource metadata
// (RFC 9728), authorization server metadata (RFC 8414), dynamic client registration
// (RFC 7591), authorization code + PKCE (S256 only), rotating refresh tokens and
// revocation (RFC 7009). The API is both the resource and the authorization server;
// people sign in and approve on the dashboard's consent page (APP_URL/oauth/consent),
// which reports back through the admin-only /oauth/requests routes.

const REQUEST_TTL = 15 * 60; // seconds to sign in and approve
const CODE_TTL = 5 * 60;
const SCOPES = ACCESS_LEVELS.map((l) => `mcp:${l}`);

// ---------------------------------------------------------------------------
// Discovery: /.well-known/*

export const wellKnown = new Hono();

function authServerMetadata(c: Context) {
  const origin = publicOrigin(c);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: SCOPES,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    service_documentation: `${dashboardUrl()}/`,
  };
}

// GET /.well-known/oauth-protected-resource/apps/:appId/mcp
wellKnown.get("/oauth-protected-resource/apps/:appId/mcp", async (c) => {
  const appId = c.req.param("appId");
  const [app] = await sql`select data->>'name' as name from apps where id = ${appId}`;
  if (!app) return c.json({ error: "App not found" }, 404);
  const origin = publicOrigin(c);
  return c.json({
    resource: mcpResourceUrl(origin, appId),
    resource_name: `Offer · ${app.name ?? appId}`,
    authorization_servers: [origin],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
  });
});

// GET /.well-known/oauth-protected-resource (clients that drop the path)
wellKnown.get("/oauth-protected-resource", (c) => {
  const origin = publicOrigin(c);
  return c.json({ resource: origin, authorization_servers: [origin], scopes_supported: SCOPES, bearer_methods_supported: ["header"] });
});

// GET /.well-known/oauth-authorization-server (plus path-suffixed and OpenID spellings
// some clients try first)
wellKnown.get("/oauth-authorization-server", (c) => c.json(authServerMetadata(c)));
wellKnown.get("/oauth-authorization-server/*", (c) => c.json(authServerMetadata(c)));
wellKnown.get("/openid-configuration", (c) => c.json(authServerMetadata(c)));

// ---------------------------------------------------------------------------
// /oauth/*

export const oauth = new Hono();

oauth.use("/requests/*", adminAuth);

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:"]);

// https anywhere, http only on loopback (native clients), and app schemes like cursor://.
function validRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
    return !BLOCKED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

// Exact match, except loopback redirects may use any port (RFC 8252 §7.3).
function redirectMatches(registered: string[], uri: string) {
  if (registered.includes(uri)) return true;
  const url = new URL(uri);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) return false;
  return registered.some((r) => {
    const reg = new URL(r);
    return reg.protocol === "http:" && reg.hostname === url.hostname && reg.pathname === url.pathname;
  });
}

const tokenError = (c: Context, error: string, description: string, status: 400 | 401 = 400) => {
  c.header("Cache-Control", "no-store");
  return c.json({ error, error_description: description }, status);
};

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// POST /oauth/register  (RFC 7591)
oauth.post("/register", async (c) => {
  let body: Json;
  try {
    body = await readObject(c);
  } catch {
    return c.json({ error: "invalid_client_metadata", error_description: "Body must be a JSON object" }, 400);
  }
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every(validRedirectUri)) {
    return c.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must list https URLs, loopback http URLs or app schemes" },
      400,
    );
  }
  const method = body.token_endpoint_auth_method ?? "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
    return c.json({ error: "invalid_client_metadata", error_description: `Unsupported token_endpoint_auth_method: ${method}` }, 400);
  }
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 100) : "MCP client";
  const str = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v.slice(0, 500) : null);
  const id = prefixedId("mcpcl", 20);
  const secret = method === "none" ? null : randomToken("mcp_cs_");

  await sql`
    insert into mcp_oauth_clients (id, name, redirect_uris, secret_hash, client_uri, logo_uri)
    values (${id}, ${name}, ${uris}::jsonb, ${secret ? hashToken(secret) : null}, ${str(body.client_uri)}, ${str(body.logo_uri)})`;

  return c.json(
    {
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: method,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    },
    201,
  );
});

const errorPage = (c: Context, message: string) =>
  c.html(
    `<!doctype html><meta charset="utf-8"><title>Can't connect</title><body style="font:15px system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1 style="font-size:20px">Can't connect to Offer</h1><p>${message.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`)}</p><p>Go back to your MCP client and try connecting again.</p></body>`,
    400,
  );

function redirectWith(uri: string, params: Record<string, string | null | undefined>) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

// GET /oauth/authorize?response_type=code&client_id&redirect_uri&code_challenge&code_challenge_method=S256&state&scope&resource
// Saves the request and sends the browser to the dashboard to sign in and approve.
oauth.get("/authorize", async (c) => {
  const q = c.req.query();
  const [client] = await sql`select id, redirect_uris from mcp_oauth_clients where id = ${q.client_id ?? ""}`;
  if (!client) return errorPage(c, "This client isn't registered with Offer.");
  const registered = client.redirect_uris as string[];
  const redirectUri = q.redirect_uri ?? (registered.length === 1 ? registered[0] : "");
  if (!validRedirectUri(redirectUri) || !redirectMatches(registered, redirectUri)) {
    return errorPage(c, "The redirect URI doesn't match the ones this client registered.");
  }

  const fail = (error: string, description: string) =>
    c.redirect(redirectWith(redirectUri, { error, error_description: description, state: q.state }));
  if (q.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  if (!q.code_challenge || q.code_challenge_method !== "S256") return fail("invalid_request", "PKCE with S256 is required");

  const origin = publicOrigin(c);
  let appId: string | null = null;
  if (q.resource) {
    appId = appIdFromResource(origin, q.resource);
    if (!appId) return fail("invalid_target", "resource must be an Offer MCP server URL");
    const [app] = await sql`select 1 from apps where id = ${appId}`;
    if (!app) return fail("invalid_target", "No app has this MCP server URL");
  }

  await sql`delete from mcp_oauth_requests where expires_at < now()`;
  const id = randomToken("mcpq_");
  await sql`
    insert into mcp_oauth_requests (id, client_id, app_id, redirect_uri, code_challenge, state, scope, resource, expires_at)
    values (${id}, ${client.id}, ${appId}, ${redirectUri}, ${q.code_challenge}, ${q.state ?? null}, ${q.scope ?? null},
            ${q.resource ?? null}, now() + make_interval(secs => ${REQUEST_TTL}))`;

  return c.redirect(`${dashboardUrl()}/oauth/consent?request=${encodeURIComponent(id)}`);
});

// Client authentication for /token and /revoke: HTTP Basic or client_id (+ client_secret) in the body.
async function authenticateClient(c: Context, form: Record<string, string>) {
  let clientId = form.client_id;
  let secret = form.client_secret;
  const basic = c.req.header("Authorization");
  if (basic?.startsWith("Basic ")) {
    const [id, pw] = Buffer.from(basic.slice(6), "base64").toString().split(":");
    clientId = decodeURIComponent(id ?? "");
    secret = decodeURIComponent(pw ?? "");
  }
  if (!clientId) return null;
  const [client] = await sql`select id, secret_hash from mcp_oauth_clients where id = ${clientId}`;
  if (!client) return null;
  if (client.secret_hash && !(secret && safeEqual(hashToken(secret), client.secret_hash))) return null;
  return client.id as string;
}

async function readForm(c: Context): Promise<Record<string, string>> {
  const type = c.req.header("Content-Type") ?? "";
  if (type.includes("application/json")) {
    const body = await c.req.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(body ?? {}).map(([k, v]) => [k, String(v)]));
  }
  return Object.fromEntries(new URLSearchParams(await c.req.text()));
}

const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

// POST /oauth/token  grant_type=authorization_code | refresh_token
oauth.post("/token", async (c) => {
  const form = await readForm(c);
  const clientId = await authenticateClient(c, form);
  if (!clientId) return tokenError(c, "invalid_client", "Unknown client or bad client credentials", 401);

  if (form.grant_type === "authorization_code") {
    if (!form.code || !form.code_verifier) return tokenError(c, "invalid_request", "code and code_verifier are required");
    const [req] = await sql`
      delete from mcp_oauth_requests
      where code_hash = ${hashToken(form.code)} and client_id = ${clientId}
      returning *, expires_at > now() as live`;
    if (!req?.live || !req.app_id || !req.user_id) return tokenError(c, "invalid_grant", "The code is invalid, used or expired");
    if (form.redirect_uri && form.redirect_uri !== req.redirect_uri) return tokenError(c, "invalid_grant", "redirect_uri doesn't match");
    if (!safeEqual(pkceChallenge(form.code_verifier), req.code_challenge)) return tokenError(c, "invalid_grant", "PKCE verification failed");
    if (form.resource && req.resource && form.resource.replace(/\/$/, "") !== req.resource.replace(/\/$/, "")) {
      return tokenError(c, "invalid_target", "resource doesn't match the authorization request");
    }

    const [client] = await sql`select name from mcp_oauth_clients where id = ${clientId}`;
    const [conn] = await sql`
      insert into mcp_connections (id, app_id, auth, client_id, client_name, user_id, user_name, user_email, access_level)
      values (${prefixedId("mcpc", 16)}, ${req.app_id}, 'oauth', ${clientId}, ${client.name}, ${req.user_id}, ${req.user_name},
              ${req.user_email}, ${req.access_level})
      on conflict (app_id, client_id, user_id) where auth = 'oauth' do update set
        access_level = excluded.access_level, user_name = excluded.user_name, user_email = excluded.user_email
      returning id, access_level`;
    const tokens = await mintTokens(conn.id);
    c.header("Cache-Control", "no-store");
    return c.json({ token_type: "Bearer", ...tokens, scope: `mcp:${conn.access_level}` });
  }

  if (form.grant_type === "refresh_token") {
    if (!form.refresh_token) return tokenError(c, "invalid_request", "refresh_token is required");
    const [conn] = await sql`
      select id, access_level from mcp_connections
      where refresh_token_hash = ${hashToken(form.refresh_token)} and client_id = ${clientId} and refresh_expires_at > now()`;
    if (!conn) return tokenError(c, "invalid_grant", "The refresh token is invalid, revoked or expired");
    const tokens = await mintTokens(conn.id);
    c.header("Cache-Control", "no-store");
    return c.json({ token_type: "Bearer", ...tokens, scope: `mcp:${conn.access_level}` });
  }

  return tokenError(c, "unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
});

// POST /oauth/revoke  token=…  (RFC 7009) Revoking either token ends the connection.
oauth.post("/revoke", async (c) => {
  const form = await readForm(c);
  const clientId = await authenticateClient(c, form);
  if (!clientId) return tokenError(c, "invalid_client", "Unknown client or bad client credentials", 401);
  if (form.token) {
    const hash = hashToken(form.token);
    await sql`
      delete from mcp_connections
      where client_id = ${clientId} and (access_token_hash = ${hash} or refresh_token_hash = ${hash})`;
  }
  return c.body(null, 200);
});

// --- Consent (dashboard only, admin key) -----------------------------------

const requestedLevel = (scope: string | null): AccessLevel | null => {
  const levels = (scope ?? "").split(/\s+/).flatMap((s) => (SCOPES.includes(s) ? [s.slice(4) as AccessLevel] : []));
  return levels.length === 1 ? levels[0] : null;
};

async function liveRequest(id: string) {
  const [req] = await sql`
    select r.*, cl.name as client_name, cl.client_uri, cl.logo_uri, a.data->>'name' as app_name
    from mcp_oauth_requests r
    join mcp_oauth_clients cl on cl.id = r.client_id
    left join apps a on a.id = r.app_id
    where r.id = ${id} and r.expires_at > now() and r.code_hash is null`;
  return req;
}

// GET /oauth/requests/:requestId
// What the consent page shows. 404 once it's approved, denied or expired.
oauth.get("/requests/:requestId", async (c) => {
  const req = await liveRequest(c.req.param("requestId"));
  if (!req) return c.json({ error: "This sign-in request has expired. Start again from your MCP client." }, 404);
  const settings = req.app_id ? await getSettings(req.app_id) : null;
  return c.json({
    id: req.id,
    client: { id: req.client_id, name: req.client_name, client_uri: req.client_uri, logo_uri: req.logo_uri },
    redirect_uri: req.redirect_uri,
    app_id: req.app_id,
    app_name: req.app_name,
    requested_level: requestedLevel(req.scope),
    server: settings ? { enabled: settings.enabled, access_level: settings.access_level } : null,
    expires_at: req.expires_at,
  });
});

// POST /oauth/requests/:requestId/approve  body: { user: { id, name?, email? }, access_level, app_id? }
// The dashboard calls this after checking the person belongs to the app's workspace.
// app_id is required when the client didn't send `resource`.
oauth.post("/requests/:requestId/approve", async (c) => {
  const req = await liveRequest(c.req.param("requestId"));
  if (!req) return c.json({ error: "This sign-in request has expired. Start again from your MCP client." }, 404);
  const body = await readObject(c);
  const user = body.user;
  if (!user || typeof user.id !== "string" || !user.id) return c.json({ error: "user.id is required" }, 400);
  if (!ACCESS_LEVELS.includes(body.access_level)) return c.json({ error: "access_level must be read, write or full" }, 400);
  const appId: string | null = req.app_id ?? (typeof body.app_id === "string" ? body.app_id : null);
  if (!appId) return c.json({ error: "app_id is required" }, 400);
  if (req.app_id && body.app_id && body.app_id !== req.app_id) return c.json({ error: "This request is for another app" }, 400);
  const [app] = await sql`select 1 from apps where id = ${appId}`;
  if (!app) return c.json({ error: "App not found" }, 404);
  if (!(await getSettings(appId)).enabled) return c.json({ error: "This app's MCP server is turned off" }, 409);

  const code = randomToken("mcp_code_");
  await sql`
    update mcp_oauth_requests set
      app_id = ${appId}, user_id = ${user.id}, user_name = ${typeof user.name === "string" ? user.name : null},
      user_email = ${typeof user.email === "string" ? user.email : null}, access_level = ${body.access_level},
      code_hash = ${hashToken(code)}, expires_at = now() + make_interval(secs => ${CODE_TTL})
    where id = ${req.id}`;
  return c.json({ redirect_url: redirectWith(req.redirect_uri, { code, state: req.state }) });
});

// POST /oauth/requests/:requestId/deny
oauth.post("/requests/:requestId/deny", async (c) => {
  const req = await liveRequest(c.req.param("requestId"));
  if (!req) return c.json({ error: "This sign-in request has expired. Start again from your MCP client." }, 404);
  await sql`delete from mcp_oauth_requests where id = ${req.id}`;
  return c.json({
    redirect_url: redirectWith(req.redirect_uri, { error: "access_denied", error_description: "The request was denied", state: req.state }),
  });
});
