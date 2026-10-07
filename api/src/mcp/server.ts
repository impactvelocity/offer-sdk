import { type Caller, logCall, type McpSettings, toolDenial, touchConnection } from "./connections.ts";
import { MCP_PROMPTS, MCP_RESOURCES } from "./prompts.ts";
import { redactKeys, TOOLS, TOOLS_BY_NAME, ToolInputError, toolRequest, toolResult, type ToolRequest } from "./tools.ts";

// The MCP protocol over Streamable HTTP, stateless: every POST carries one JSON-RPC
// message (or a batch, for older clients) and gets a plain JSON response. No SSE
// streams, no server-initiated requests.

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "offer", title: "Offer", version: "1.0.0" };

const INSTRUCTIONS = `Offer manages what each of this app's customers can do: plans (bundles of entitlements with limits), entitlements (usage limits or feature flags), add-ons, and incentives (offers layered on a plan that override limits). Customers are called accounts here and namespaces in the API.
Start by reading the offer://catalog resource (or the list_* tools) so you use real IDs. Changes apply to live customers immediately: confirm with the user before creating, changing or deleting anything.`;

type Id = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: Id;
  method: string;
  params?: Record<string, any>;
}

export interface McpContext {
  appId: string;
  appName: string;
  settings: McpSettings;
  caller: Caller;
  /** Runs a request against this API as the app (its secret key). */
  api: (req: ToolRequest) => Promise<{ status: number; json: unknown }>;
}

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export const rpcError = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

/** Handles one JSON-RPC message. Notifications (no id) return null: the HTTP response is 202. */
export async function handleMessage(ctx: McpContext, msg: unknown): Promise<object | null> {
  if (!msg || typeof msg !== "object" || (msg as JsonRpcRequest).jsonrpc !== "2.0" || typeof (msg as JsonRpcRequest).method !== "string") {
    // Responses to server requests (we never send any) are accepted and ignored.
    if (msg && typeof msg === "object" && "jsonrpc" in msg && ("result" in msg || "error" in msg)) return null;
    return rpcError((msg as JsonRpcRequest)?.id ?? null, INVALID_REQUEST, "Invalid JSON-RPC request");
  }
  const req = msg as JsonRpcRequest;
  if (req.id === undefined) return null;
  try {
    return { jsonrpc: "2.0", id: req.id, result: await dispatch(ctx, req.method, req.params ?? {}) };
  } catch (e) {
    if (e instanceof RpcError) return rpcError(req.id, e.code, e.message);
    console.error("[mcp]", e);
    return rpcError(req.id, INTERNAL_ERROR, "Internal error");
  }
}

async function dispatch(ctx: McpContext, method: string, params: Record<string, any>): Promise<unknown> {
  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { ...SERVER_INFO, title: `Offer · ${ctx.appName}` },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "logging/setLevel":
      return {};
    case "tools/list":
      return { tools: listTools(ctx) };
    case "tools/call":
      return callTool(ctx, params);
    case "resources/list":
      return {
        resources: MCP_RESOURCES.filter((r) => !r.template).map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: "application/json",
        })),
      };
    case "resources/templates/list":
      return {
        resourceTemplates: MCP_RESOURCES.filter((r) => r.template).map((r) => ({
          uriTemplate: r.uri,
          name: r.name,
          description: r.description,
          mimeType: "application/json",
        })),
      };
    case "resources/read":
      return readResource(ctx, String(params.uri ?? ""));
    case "prompts/list":
      return {
        prompts: MCP_PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments })),
      };
    case "prompts/get": {
      const prompt = MCP_PROMPTS.find((p) => p.name === params.name);
      if (!prompt) throw new RpcError(INVALID_PARAMS, `Unknown prompt: ${params.name}`);
      const args = (params.arguments ?? {}) as Record<string, string | undefined>;
      for (const a of prompt.arguments) {
        if (a.required && !args[a.name]) throw new RpcError(INVALID_PARAMS, `Missing argument: ${a.name}`);
      }
      return {
        description: prompt.description,
        messages: [{ role: "user", content: { type: "text", text: prompt.text(args) } }],
      };
    }
    default:
      throw new RpcError(METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/** Tools this caller can use. OAuth connections only see what their access level and the app's switches allow. */
function listTools(ctx: McpContext) {
  return TOOLS.filter((t) => !toolDenial(ctx.settings, ctx.caller, t)).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { title: t.title, ...t.annotations },
  }));
}

const text = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

async function callTool(ctx: McpContext, params: Record<string, any>) {
  const name = String(params.name ?? "");
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw new RpcError(INVALID_PARAMS, `Unknown tool: ${name}`);
  const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};

  const started = Date.now();
  let status: number;
  let result: unknown;
  const denial = toolDenial(ctx.settings, ctx.caller, tool);
  if (denial) {
    status = 403;
    result = { error: denial };
  } else {
    try {
      const res = await ctx.api(toolRequest(tool, ctx.appId, args));
      status = res.status;
      result = res.status < 400 ? toolResult(tool, res.json) : res.json;
    } catch (e) {
      if (!(e instanceof ToolInputError)) throw e;
      status = 400;
      result = { error: e.message };
    }
  }

  await logCall({ appId: ctx.appId, connectionId: ctx.caller.connectionId, tool: name, args, status, durationMs: Date.now() - started, result });
  if (ctx.caller.connectionId) await touchConnection(ctx.caller.connectionId);

  const isError = status >= 400;
  return {
    content: [{ type: "text", text: isError ? `Error ${status}: ${text((result as any)?.error ?? result)}` : text(result) }],
    isError,
  };
}

async function readResource(ctx: McpContext, uri: string) {
  let def = MCP_RESOURCES.find((r) => !r.template && r.uri === uri);
  let vars: Record<string, string> = {};
  if (!def) {
    for (const r of MCP_RESOURCES.filter((r) => r.template)) {
      const pattern = new RegExp(`^${r.uri.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}/g, "(?<$1>[^/]+)")}$`);
      const match = uri.match(pattern);
      if (match?.groups) {
        def = r;
        vars = Object.fromEntries(Object.entries(match.groups).map(([k, v]) => [k, decodeURIComponent(v)]));
        break;
      }
    }
  }
  if (!def) throw new RpcError(INVALID_PARAMS, `Unknown resource: ${uri}`);
  // Resources follow the same rules as the tools that read the same data.
  for (const name of def.tools) {
    const tool = TOOLS_BY_NAME.get(name);
    const denial = tool ? toolDenial(ctx.settings, ctx.caller, tool) : `${name} doesn't exist`;
    if (denial) throw new RpcError(INVALID_PARAMS, `${uri} isn't available: ${denial}`);
  }

  const doc: Record<string, unknown> = {};
  for (const [field, route] of Object.entries(def.routes)) {
    const path = `/apps/${encodeURIComponent(ctx.appId)}${route.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(vars[k] ?? ""))}`;
    const res = await ctx.api({ method: "GET", path });
    if (res.status >= 400) throw new RpcError(INVALID_PARAMS, `${uri}: ${text((res.json as any)?.error ?? res.status)}`);
    doc[field] = field === "app" && res.json && typeof res.json === "object" ? redactKeys(res.json as Record<string, unknown>) : res.json;
  }
  const value = Object.keys(doc).length === 1 ? Object.values(doc)[0] : doc;
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] };
}
