import manifest from "./tools.json";

// The MCP server's tools. Each one is an API endpoint, run against this API with the
// app's own secret key, so tools behave exactly like the routes they wrap. tools.json is
// generated from the dashboard's API reference (offer-app: `pnpm mcp:tools`).

export type ToolKind = "read" | "write" | "destructive";
export type AccessLevel = "read" | "write" | "full";

export const ACCESS_LEVELS: AccessLevel[] = ["read", "write", "full"];

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query: string[];
  body: "fields" | "meta" | null;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  annotations: Record<string, boolean>;
}

export const TOOLS = manifest as ToolDef[];
export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

const LEVEL_LABEL: Record<AccessLevel, string> = { read: "Read only", write: "Read & write", full: "Full access" };

export function levelAllows(level: AccessLevel, kind: ToolKind) {
  if (kind === "read") return true;
  if (kind === "write") return level !== "read";
  return level === "full";
}

/** The lowest access level that can call a tool. */
export function levelNeeded(kind: ToolKind): AccessLevel {
  return kind === "read" ? "read" : kind === "write" ? "write" : "full";
}

export const levelLabel = (level: AccessLevel) => LEVEL_LABEL[level];

export interface ToolRequest {
  method: string;
  path: string;
  body?: unknown;
}

/** Turns tool arguments into the API request the tool stands for. Throws on missing path params. */
export function toolRequest(tool: ToolDef, appId: string, args: Record<string, unknown>): ToolRequest {
  const rest: Record<string, unknown> = { ...args };
  let path = tool.path.replace(/:(\w+)/g, (_, name: string) => {
    if (name === "appId") return encodeURIComponent(appId);
    const value = rest[name];
    delete rest[name];
    if (value === undefined || value === null || value === "") throw new ToolInputError(`${name} is required`);
    return encodeURIComponent(String(value));
  });

  const query = new URLSearchParams();
  for (const name of tool.query) {
    const value = rest[name];
    delete rest[name];
    if (value !== undefined && value !== null && value !== "") query.set(name, String(value));
  }
  if (query.size) path += `?${query}`;

  if (tool.body === "meta") return { method: tool.method, path, body: rest.meta ?? {} };
  if (tool.body === "fields") {
    // update_app: only the name can change over MCP.
    const body = tool.name === "update_app" ? { name: rest.name } : rest;
    return { method: tool.method, path, body };
  }
  return { method: tool.method, path };
}

const WEBHOOK_TOOLS = new Set(["list_webhooks", "get_webhook", "create_webhook", "update_webhook"]);

/** Post-processing a tool's JSON before the client sees it: keys and signing secrets never reach the model. */
export function toolResult(tool: ToolDef, json: unknown): unknown {
  if ((tool.name === "get_app" || tool.name === "update_app") && json && typeof json === "object") {
    return redactKeys(json as Record<string, unknown>);
  }
  if (WEBHOOK_TOOLS.has(tool.name)) return redactSecrets(json);
  return json;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, k === "secret" && typeof v === "string" ? "[redacted]" : redactSecrets(v)]),
  );
}

export function redactKeys(app: Record<string, unknown>) {
  const { api_key: _a, public_key: _p, ...rest } = app;
  return { ...rest, api_key: "[redacted]", public_key: "[redacted]" };
}

export class ToolInputError extends Error {}
