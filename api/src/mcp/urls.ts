import type { Context } from "hono";

// The API's public origin, as MCP clients see it. OAuth metadata and the resource URL
// must match the URL the client connected to, so behind a proxy set PUBLIC_API_URL.
export function publicOrigin(c: Context) {
  const configured = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(c.req.url);
  const proto = c.req.header("X-Forwarded-Proto")?.split(",")[0]?.trim();
  const host = c.req.header("X-Forwarded-Host")?.split(",")[0]?.trim() ?? c.req.header("Host");
  return `${proto || url.protocol.replace(":", "")}://${host || url.host}`;
}

export const mcpResourceUrl = (origin: string, appId: string) => `${origin}/apps/${encodeURIComponent(appId)}/mcp`;

export const resourceMetadataUrl = (origin: string, appId: string) =>
  `${origin}/.well-known/oauth-protected-resource/apps/${encodeURIComponent(appId)}/mcp`;

/** The app id in an MCP resource URL of this API, or null. */
export function appIdFromResource(origin: string, resource: string): string | null {
  const prefix = `${origin}/apps/`;
  if (!resource.startsWith(prefix)) return null;
  const match = resource.slice(prefix.length).replace(/\/$/, "").match(/^([^/]+)\/mcp$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The dashboard, where people sign in and approve connections. */
export const dashboardUrl = () => (process.env.APP_URL ?? "http://localhost:6768").replace(/\/$/, "");
