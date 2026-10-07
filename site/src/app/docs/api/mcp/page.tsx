import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Callout, Code, DocsHeader, EndpointList, H2, H3, Step, Steps, Table, TermList } from "@/components/docs/prose";
import { MCP_ADMIN_ENDPOINTS, MCP_ENDPOINTS } from "../reference/endpoints";
import { MCP_TOOL_COUNT, MCP_TOOL_GROUPS, type ToolKind } from "./tools";

export const metadata: Metadata = {
  title: "MCP server",
  description:
    "Connect AI assistants and coding agents to an app over MCP: the server URL, OAuth and secret-key auth, access levels, every tool, resource and prompt, and the dashboard controls.",
};

const SERVER_URL = "https://api.example.com/apps/app_AbCdEf/mcp";

const cursorJson = `{
  "mcpServers": {
    "offer": {
      "url": "${SERVER_URL}",
      "headers": { "Authorization": "Bearer \${env:OFFER_SECRET_KEY}" }
    }
  }
}`;

const vscodeJson = `{
  "inputs": [
    { "type": "promptString", "id": "offer-key", "description": "Offer secret key", "password": true }
  ],
  "servers": {
    "offer": {
      "type": "http",
      "url": "${SERVER_URL}",
      "headers": { "Authorization": "Bearer \${input:offer-key}" }
    }
  }
}`;

const mcpRemoteJson = `{
  "mcpServers": {
    "offer": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${SERVER_URL}"]
    }
  }
}`;

const curlCall = `curl -X POST http://localhost:6767/apps/$APP_ID/mcp \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "get_account_access", "arguments": { "namespaceId": "user_42" } }
  }'`;

const curlResponse = `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "{\\"id\\":\\"pro\\",\\"name\\":\\"Pro\\",\\"entitlements\\":[…]}" }],
    "isError": false
  }
}`;

const unauthorized = `HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/apps/app_AbCdEf/mcp"`;

const LEVEL: Record<ToolKind, string> = { read: "Read only", write: "Read & write", destructive: "Full access" };

export default function McpDocsPage() {
  return (
    <>
      <DocsHeader
        title="MCP server"
        lead="Every app has an MCP server that gives AI assistants the same tools as the API. Connect any MCP client, sign in with OAuth or use the secret key, and choose how much each connection can change."
      />

      <p>
        The server runs in the Offer API, next to the routes it wraps. Each tool is one API endpoint, called with the
        app&apos;s own secret key, so a tool returns exactly what the endpoint returns. There is nothing extra to
        deploy and no new environment variable.
      </p>

      <H2>Server URL</H2>
      <p>
        Each app has its own server, scoped to that app, at <code>/apps/:appId/mcp</code> on the API&apos;s public URL:
      </p>
      <Code lang="text" code={SERVER_URL} />
      <p>
        Locally that&apos;s <code>{"http://localhost:6767/apps/<appId>/mcp"}</code>. The dashboard shows the full URL
        with a copy button under <strong>Developers → MCP server</strong>. Tools never take an <code>appId</code>{" "}
        argument: the app comes from the URL.
      </p>
      <TermList
        items={[
          {
            term: "Transport",
            children: (
              <>
                Streamable HTTP, stateless. Every <code>POST</code> carries one JSON-RPC message, or a batch for older
                clients, and gets a plain JSON response. There are no server-sent event streams, so <code>GET</code> and{" "}
                <code>DELETE</code> return <code>405</code>. Notifications get an empty <code>202</code>.
              </>
            ),
          },
          {
            term: "Protocol versions",
            children: (
              <>
                <code>2025-11-25</code>, <code>2025-06-18</code>, <code>2025-03-26</code> and <code>2024-11-05</code>.
                The server answers <code>initialize</code> with the version the client asked for, or the newest one.
              </>
            ),
          },
          {
            term: "Capabilities",
            children: "Tools, resources (with one template) and prompts. The lists don't change during a session.",
          },
        ]}
      />
      <Callout title="Web chat apps connect from their own servers.">
        Their connectors, such as ChatGPT&apos;s, need the API on a public HTTPS URL. A local API at <code>localhost:6767</code> works with
        clients that run on your machine, such as Cursor, VS Code and terminal coding agents.
      </Callout>

      <H2>Connect a client</H2>
      <p>
        The <strong>Connect</strong> tab on the dashboard&apos;s MCP page has these steps for each client, filled in
        with the app&apos;s server URL. Snippets that use a key read it from <code>OFFER_SECRET_KEY</code> rather than
        holding it.
      </p>

      <H3>Cursor</H3>
      <p>
        Paste the config into <code>.cursor/mcp.json</code> for one project or <code>~/.cursor/mcp.json</code> for
        all of them, or use <strong>Add to Cursor</strong> on the Connect tab. Without the <code>headers</code> entry,
        Cursor opens the dashboard&apos;s sign-in page the first time a tool runs. Check{" "}
        <strong>Settings → MCP</strong>: Offer should show a green dot and its tools.
      </p>
      <Code lang="json" title="mcp.json" code={cursorJson} />

      <H3>VS Code</H3>
      <p>
        Add the config to <code>.vscode/mcp.json</code>. VS Code asks for the key the first time and stores it
        securely. For OAuth, drop <code>inputs</code> and <code>headers</code>, then click <strong>Start</strong> above
        the server entry and sign in. In Copilot Chat, switch to Agent mode and pick Offer&apos;s tools.
      </p>
      <Code lang="json" title=".vscode/mcp.json" code={vscodeJson} />

      <H3>ChatGPT</H3>
      <ol>
        <li>
          Open <strong>Settings → Apps &amp; Connectors → Advanced</strong> and turn on Developer mode.
        </li>
        <li>
          Click <strong>Create</strong>, name it <code>Offer</code>, paste the server URL and choose OAuth.
        </li>
        <li>Sign in to the dashboard, then enable the connector from a chat&apos;s tools menu.</li>
      </ol>

      <H3>Other clients</H3>
      <p>
        Any client that speaks Streamable HTTP can use the server URL, with the secret key as a bearer token or with
        OAuth, which clients discover from the <code>401</code>. Clients that only speak stdio can bridge with{" "}
        <code>mcp-remote</code>, which also handles the OAuth sign-in. Add{" "}
        <code>{'"--header", "Authorization: Bearer ${OFFER_SECRET_KEY}"'}</code> to its args to
        use the key.
      </p>
      <Code lang="json" code={mcpRemoteJson} />

      <H2>Authentication</H2>
      <p>The server takes two kinds of credential. Anything else, including the publishable key and account tokens, gets a <code>401</code>.</p>
      <Table
        mono={false}
        head={["Credential", "Who uses it", "What it can call"]}
        rows={[
          [
            "OAuth access token",
            "ChatGPT, Cursor, VS Code and any client that signs in. One connection per person and client.",
            "The tools its access level covers, among those switched on for the app.",
          ],
          [
            "Secret key",
            "Your own tools and scripts. The admin key works too.",
            "Every tool, like the REST API. The access level and tool switches don't apply.",
          ],
        ]}
      />
      <p>
        Both stop working when the server is turned off: every call then gets a <code>403</code>.
      </p>

      <H3>Signing in with OAuth</H3>
      <p>
        The API is both the MCP server and its OAuth 2.1 authorization server. People approve connections on the
        dashboard, signed in with their usual account. Clients find everything on their own:
      </p>
      <Steps>
        <Step title="The client calls without a token">
          <p>
            The server answers <code>401</code> and points to its metadata:
          </p>
          <Code lang="http" code={unauthorized} />
          <p>
            The protected resource metadata names the API as the authorization server, and{" "}
            <code>/.well-known/oauth-authorization-server</code> lists its endpoints.
          </p>
        </Step>
        <Step title="The client registers">
          <p>
            Dynamic client registration at <code>POST /oauth/register</code>. Redirect URIs must be HTTPS, HTTP on a
            loopback host (any port), or an app scheme such as <code>cursor://</code>.
          </p>
        </Step>
        <Step title="The person approves on the dashboard">
          <p>
            The client opens <code>/oauth/authorize</code> with a PKCE challenge (S256 only). The API saves the request
            and sends the browser to the dashboard&apos;s consent page, <code>/oauth/consent</code>. After signing in,
            the person picks an access level, and an app if the client didn&apos;t name the server&apos;s URL in{" "}
            <code>resource</code>. Only apps in their own workspaces are offered. A request expires after 15 minutes.
          </p>
        </Step>
        <Step title="The client gets tokens">
          <p>
            The browser returns to the client with a code, valid once for 5 minutes. The client exchanges it at{" "}
            <code>POST /oauth/token</code> for an access token (<code>mcp_at_…</code>, 1 hour) and a refresh token (
            <code>mcp_rt_…</code>, 30 days). Each refresh replaces both tokens, and the old pair stops working.
          </p>
        </Step>
      </Steps>
      <p>
        A token only works on the app it was approved for. The API stores tokens as SHA-256 hashes. When the same
        person approves the same registered client again, its existing connection takes the new access level. The scopes are <code>mcp:read</code>,{" "}
        <code>mcp:write</code> and <code>mcp:full</code>. A client that asks for one has it preselected on the consent
        page, and the person can still choose another.
      </p>

      <H3>Using the secret key</H3>
      <p>
        Send <code>Authorization: Bearer key_…</code> on every request. At <code>initialize</code>, the server records
        a connection named after the client (<code>clientInfo.name</code>) and returns an <code>Mcp-Session-Id</code>{" "}
        header. Clients send it back, and later calls are logged under that connection.
      </p>
      <Code lang="bash" title="A tool call with curl" code={curlCall} />
      <Code lang="json" title="Response" code={curlResponse} />
      <p>
        The result is the endpoint&apos;s JSON as text. When the endpoint returns an error, the result has{" "}
        <code>isError: true</code> and text such as <code>Error 404: Namespace not found</code>, so the model can read it
        and recover.
      </p>
      <Callout tone="warning" title="Removing a key connection doesn't cut it off.">
        It only leaves the list, because the key itself still works. To stop a client that uses the secret key,
        regenerate the key under <strong>Developers → API keys</strong>, which also breaks every server using it.
        Prefer OAuth for assistants that people connect themselves.
      </Callout>

      <H2>Access levels</H2>
      <p>Every tool is one of three kinds, and each access level covers more of them:</p>
      <Table
        mono={false}
        head={["Level", "Scope", "Tools it covers"]}
        rows={[
          ["Read only", <code key="s">mcp:read</code>, "Look up accounts, the catalog, usage, analytics and webhooks. Nothing changes."],
          ["Read & write", <code key="s">mcp:write</code>, "Also create and update accounts, plans, entitlements, add-ons, incentives and webhooks, attach entitlements and add-ons, record usage, rename the app, send test events and retry deliveries. No deletes."],
          ["Full access", <code key="s">mcp:full</code>, "Everything, including deletes, detaching entitlements and add-ons, and removing an account's incentive."],
        ]}
      />
      <p>An OAuth connection can call a tool when both of these hold:</p>
      <ul>
        <li>
          <strong>The tool is switched on for the app.</strong> The app&apos;s access level decides which tools are on
          by default (Read &amp; write for a new app), and per-tool switches override it. This applies to every OAuth
          connection to the app.
        </li>
        <li>
          <strong>The connection&apos;s own level covers the tool.</strong> That&apos;s the level the person picked
          when they approved it.
        </li>
      </ul>
      <p>
        <code>tools/list</code> only returns the tools a connection can call. Calling another one returns{" "}
        <code>isError</code> with the reason, for example that the connection has Read only access and the tool needs
        Read &amp; write. Denied calls show up in Activity with status <code>403</code>.
      </p>
      <Callout title="Clients confirm before destructive tools.">
        Tools carry MCP annotations: reads are <code>readOnlyHint</code>, deletes are <code>destructiveHint</code>, and
        the two that call your webhook URLs are <code>openWorldHint</code>. Most clients ask before
        running a destructive tool.
      </Callout>

      <H2>Tools</H2>
      <p>
        {MCP_TOOL_COUNT} tools, each wrapping one endpoint. Arguments are the endpoint&apos;s path parameters, query
        parameters and body fields, with the same names. A few filters are left out, such as <code>offer</code> on{" "}
        <code>list_accounts</code>. Routes below are relative to <code>/apps/:appId</code>, and the last column is the
        lowest access level that can call each tool.
      </p>
      <p>
        Tools take the account id as <code>namespaceId</code>, so routes show it as <code>:namespaceId</code>. The{" "}
        <Link href="/docs/api/reference">Endpoint reference</Link> writes the same parameter as <code>:accountId</code>.
      </p>
      {MCP_TOOL_GROUPS.map((group) => (
        <Fragment key={group.title}>
          <H3>{group.title}</H3>
          <Table
            head={["Tool", "Endpoint", "Needs"]}
            rows={group.tools.map((t) => [t.name, <code key="r">{t.route}</code>, LEVEL[t.kind]])}
          />
        </Fragment>
      ))}
      <p>A few tools differ from the endpoint they wrap:</p>
      <ul>
        <li>
          <code>get_app</code> and <code>update_app</code> return <code>api_key</code> and <code>public_key</code> as{" "}
          <code>[redacted]</code>, the webhook tools redact signing secrets, and <code>update_app</code> only changes{" "}
          <code>name</code>.
        </li>
        <li>
          <code>merge_plan_meta</code> takes the keys to merge under a <code>meta</code> argument instead of as the raw
          body.
        </li>
      </ul>

      <H3>Not available over MCP</H3>
      <p>These endpoints have no tool, because a mistake would lock you out:</p>
      <Table
        head={["Endpoint", "Why"]}
        rows={[
          ["DELETE /", "Deleting the app removes every record. Do it from App settings."],
          ["POST /keys/regenerate", "Rotating the secret key would cut off your servers. Rotate it from API keys."],
          ["POST /public-key/regenerate", "Rotating the publishable key would cut off your clients. Rotate it from API keys."],
          [
            "POST /webhooks/:webhookId/secret/regenerate",
            "Verification breaks until your server has the new secret. Rotate it from the webhook's page.",
          ],
        ]}
      />
      <p>
        Tools cover accounts, usage, the catalog, analytics, webhooks and the app. Offers, checkouts, subscriptions,
        PayPal, cancel flows and cancel sessions, saved reports, account tokens, account add-ons and history import
        aren&apos;t exposed over MCP. Use the <Link href="/docs/api/reference">REST API</Link> for those.
      </p>

      <H2>Resources</H2>
      <p>Read-only JSON documents a client can load as context. Keys are always redacted.</p>
      <Table
        head={["URI", "What it holds"]}
        rows={[
          ["offer://app", "The app's name and id."],
          ["offer://catalog", "Every plan, entitlement, add-on and incentive in one document. Clients usually load this first."],
          ["offer://pricing", "The pricing cards your pricing page renders."],
          ["offer://accounts/{namespaceId}", "A template: one account's resolved plan, incentive, add-ons and live usage."],
          ["offer://events", "Events from the last 30 days, newest first."],
        ]}
      />
      <p>
        Resources follow the tools that read the same data. An OAuth connection can only read{" "}
        <code>offer://catalog</code> while <code>list_plans</code>, <code>list_entitlements</code>,{" "}
        <code>list_addons</code> and <code>list_incentives</code> are all on, and likewise for the others. The secret key
        can read all of them.
      </p>

      <H2>Prompts</H2>
      <p>Prompts are starting points the client offers as commands. Each expands to one message that names the tools to use.</p>
      <Table
        head={["Prompt", "Arguments", "What it does"]}
        rows={[
          ["review_catalog", "None", "Audits plans, entitlements and incentives for unused records, dangling references and inconsistent limits, and suggests fixes without applying them."],
          ["investigate_account", <code key="a">namespaceId</code>, "Explains what an account can do right now and why: plan, incentive overrides, add-ons and usage against each limit."],
          [
            "launch_incentive",
            <>
              <code>goal</code>, <code>plan</code> (optional)
            </>,
            "Drafts an incentive, creates it after you approve, and lists the accounts it should go to before assigning it.",
          ],
          ["debug_webhooks", <><code>webhookId</code> (optional)</>, "Groups failed deliveries by cause and suggests a fix for each. Asks before retrying or sending a test."],
        ]}
      />
      <p>
        The server&apos;s instructions also tell clients to read the catalog before acting and to confirm with you
        before creating, changing or deleting anything.
      </p>

      <H2>Dashboard controls</H2>
      <p>
        <strong>Developers → MCP server</strong> (<code>/apps/[appId]/developers/mcp</code>) shows the server URL and
        an <strong>Enabled</strong> switch, with four tabs:
      </p>
      <TermList
        items={[
          {
            term: "Enabled",
            children:
              "On by default. Turning it off answers every call with 403, for OAuth connections and the secret key alike, and stops new sign-ins. Connections are kept, so turning it back on restores them.",
          },
          { term: "Connect", children: "Setup steps and snippets for each client, with this app's URL filled in." },
          {
            term: "Tools",
            children:
              "The app's access level and a switch per tool. A switch you change by hand overrides the level until you reset it. These limit OAuth connections only.",
          },
          {
            term: "Connections",
            children:
              "Every client connected to the app: OAuth connections with the person who approved them and their access level, and secret-key connections by client name. Removing an OAuth connection cuts it off on its next call, and its refresh token stops working.",
          },
          {
            term: "Activity",
            children:
              "Every tool call with its arguments, status, duration and the result the client got. Results over 20,000 characters are truncated. Calls are kept for 30 days.",
          },
        ]}
      />

      <H2>Endpoints</H2>
      <p>
        The server and the OAuth routes clients call. Paths are relative to the API&apos;s base URL. Every route is
        also in the <Link href="/docs/api/reference">Endpoint reference</Link> and the{" "}
        <Link href="/docs/sponsors/postman">Postman collection</Link>, whose MCP OAuth folder runs the whole sign-in
        flow.
      </p>
      <EndpointList endpoints={MCP_ENDPOINTS} />
      <p>The dashboard uses these admin-only routes for the MCP page and the consent page:</p>
      <EndpointList endpoints={MCP_ADMIN_ENDPOINTS} />

      <H2>Self-hosting</H2>
      <p>
        The server needs no setup beyond the API itself. Its tables come from <code>migrations/009_mcp.sql</code>, which
        runs on boot, and it keeps no state in memory, so it works across several API instances. Two existing
        variables matter for OAuth:
      </p>
      <Table
        head={["Variable", "Service", "Role in MCP"]}
        rows={[
          [
            "PUBLIC_API_URL",
            "API",
            <>
              The origin used in the OAuth metadata and the server&apos;s resource URL. Falls back to{" "}
              <code>RENDER_EXTERNAL_URL</code>, then to the request&apos;s <code>X-Forwarded-Host</code> or{" "}
              <code>Host</code>.
            </>,
          ],
          ["APP_URL", "API", <>The dashboard, where the consent page lives (<code>/oauth/consent</code>).</>],
        ]}
      />
      <Callout tone="warning" title="Behind a custom domain, set PUBLIC_API_URL.">
        OAuth clients check that the metadata matches the URL they connected to. On Render the origin defaults to the
        service&apos;s <code>onrender.com</code> address, so a server URL on your own domain fails to sign in until{" "}
        <code>PUBLIC_API_URL</code> is set to that domain. Give clients URLs on the same origin.
      </Callout>
      <p>
        The code is in <code>api/src/mcp</code> (protocol, tools, connections, resources and prompts),{" "}
        <code>api/src/routes/mcp.ts</code> and <code>api/src/routes/oauth.ts</code>. The tool list,{" "}
        <code>api/src/mcp/tools.json</code>, is generated from the dashboard&apos;s API reference with{" "}
        <code>pnpm mcp:tools</code> in <code>offer-app</code>, and a dashboard test fails when it&apos;s stale.{" "}
        <code>bun test test/mcp.test.ts</code> in <code>api/</code> runs the protocol, the settings and the full OAuth
        flow end to end. All variables are listed in <Link href="/docs/deploy/environment">Environment variables</Link>.
      </p>
    </>
  );
}
