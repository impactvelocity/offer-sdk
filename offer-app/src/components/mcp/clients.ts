import { ENV } from "@/components/developers/snippets";

// Setup instructions for each MCP client. Snippets never contain real keys: API-key setups
// read OFFER_SECRET_KEY from the environment.

export type ClientId = "claude" | "claude-code" | "cursor" | "vscode" | "chatgpt" | "other";
export type McpAuth = "oauth" | "key";

export interface ClientInfo {
  id: ClientId;
  name: string;
  tagline: string;
  /** Clients that only support OAuth for remote servers. */
  oauthOnly?: boolean;
}

export const CLIENTS: ClientInfo[] = [
  { id: "claude", name: "Claude", tagline: "claude.ai and the desktop app", oauthOnly: true },
  { id: "claude-code", name: "Claude Code", tagline: "Terminal, IDE and desktop" },
  { id: "cursor", name: "Cursor", tagline: "Agent and chat" },
  { id: "vscode", name: "VS Code", tagline: "Copilot agent mode" },
  { id: "chatgpt", name: "ChatGPT", tagline: "Developer mode connectors", oauthOnly: true },
  { id: "other", name: "Other clients", tagline: "Any MCP client" },
];

export interface ClientSetup {
  /** Steps; `backticks` render as code. */
  steps: string[];
  snippets: { label: string; code: string; lang: "bash" | "json" | "text" }[];
  /** One-click install link, when the client has one. */
  installUrl?: string;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);
const bearer = (ref: string) => ({ Authorization: `Bearer ${ref}` });

export function clientSetup(client: ClientId, url: string, auth: McpAuth): ClientSetup {
  const key = auth === "key";
  switch (client) {
    case "claude":
      return {
        steps: [
          "Open Settings → Connectors and choose “Add custom connector”.",
          "Name it `Offer`, paste the server URL and click Add.",
          "Click Connect, sign in to Offer and pick this app and an access level.",
          "In a chat, turn Offer on from the tools menu and ask away.",
        ],
        snippets: [{ label: "Server URL", code: url, lang: "text" }],
      };
    case "claude-code":
      return {
        steps: key
          ? [
              `Export \`${ENV.secret}\` in your shell, then add the server.`,
              "Add `--scope project` to write it to `.mcp.json` and share it with your team.",
              "Run `/mcp` to check the connection.",
            ]
          : [
              "Add the server.",
              "Run `/mcp` in Claude Code, select `offer` and choose Authenticate.",
              "Sign in to Offer in the browser window that opens.",
            ],
        snippets: [
          {
            label: "Terminal",
            code: `claude mcp add --transport http offer ${url}${key ? ` \\\n  --header "Authorization: Bearer $${ENV.secret}"` : ""}`,
            lang: "bash",
          },
          {
            label: ".mcp.json",
            code: json({ mcpServers: { offer: { type: "http", url, ...(key ? { headers: bearer(`\${${ENV.secret}}`) } : {}) } } }),
            lang: "json",
          },
        ],
      };
    case "cursor": {
      const config = { url, ...(key ? { headers: bearer(`\${env:${ENV.secret}}`) } : {}) };
      return {
        steps: [
          "Click “Add to Cursor”, or paste the config into `.cursor/mcp.json` (this project) or `~/.cursor/mcp.json` (everywhere).",
          key ? `Make sure \`${ENV.secret}\` is set in the environment Cursor starts from.` : "Cursor opens Offer's sign-in page the first time a tool runs.",
          "Check Settings → MCP: Offer should show a green dot and its tools.",
        ],
        snippets: [{ label: "mcp.json", code: json({ mcpServers: { offer: config } }), lang: "json" }],
        installUrl: `cursor://anysphere.cursor-deeplink/mcp/install?name=offer&config=${encodeBase64(JSON.stringify(config))}`,
      };
    }
    case "vscode": {
      const server = { type: "http", url, ...(key ? { headers: bearer("${input:offer-key}") } : {}) };
      return {
        steps: [
          "Add the config to `.vscode/mcp.json`, or run the command to add it to your user settings.",
          key ? "VS Code asks for the key the first time and stores it securely." : "Click Start above the server entry and sign in to Offer.",
          "In Copilot Chat, switch to Agent mode and pick Offer's tools.",
        ],
        snippets: [
          {
            label: ".vscode/mcp.json",
            code: json({
              ...(key ? { inputs: [{ type: "promptString", id: "offer-key", description: "Offer secret key", password: true }] } : {}),
              servers: { offer: server },
            }),
            lang: "json",
          },
          { label: "Command line", code: `code --add-mcp '${JSON.stringify({ name: "offer", ...server })}'`, lang: "bash" },
        ],
      };
    }
    case "chatgpt":
      return {
        steps: [
          "Open Settings → Apps & Connectors → Advanced and turn on Developer mode.",
          "Click Create, name it `Offer`, paste the server URL and choose OAuth.",
          "Sign in to Offer, then enable the connector from a chat's tools menu.",
        ],
        snippets: [{ label: "Server URL", code: url, lang: "text" }],
      };
    case "other":
      return {
        steps: [
          "Point any client that supports Streamable HTTP at the server URL.",
          key
            ? "Send the secret key as a bearer token on every request."
            : "OAuth 2.1 with dynamic client registration: clients discover it from `/.well-known/oauth-protected-resource`.",
          "Clients that only speak stdio can bridge with `mcp-remote`.",
        ],
        snippets: [
          {
            label: "Streamable HTTP",
            code: json({ mcpServers: { offer: { url, ...(key ? { headers: bearer(`<${ENV.secret}>`) } : {}) } } }),
            lang: "json",
          },
          {
            label: "stdio bridge",
            code: json({
              mcpServers: {
                offer: {
                  command: "npx",
                  args: ["-y", "mcp-remote", url, ...(key ? ["--header", `Authorization: Bearer \${${ENV.secret}}`] : [])],
                  ...(key ? { env: { [ENV.secret]: "<your secret key>" } } : {}),
                },
              },
            }),
            lang: "json",
          },
        ],
      };
  }
}

function encodeBase64(value: string) {
  return typeof btoa === "function" ? btoa(value) : Buffer.from(value).toString("base64");
}
