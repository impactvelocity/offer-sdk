import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Authentication",
  description: "The Offer API's base URL, its four kinds of credential, what each one can call, and the errors it returns.",
};

const createApp = `curl -X POST http://localhost:6767/apps \\
  -H "Authorization: Bearer $ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "My blog" }'`;

const createAppResponse = `{
  "id": "app_AbCdEf",
  "name": "My blog",
  "api_key": "key_…",
  "public_key": "pub_…",
  "created_at": "2026-10-01T12:00:00.000Z"
}`;

const authedCall = `curl http://localhost:6767/apps/$APP_ID/namespaces/user_42/plan \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY"`;

const errorBody = `{ "error": "Plan \\"enterprise\\" not found" }`;

const limitBody = `{
  "error": "limit_reached",
  "message": "You've used 3 of 3 Posts on the Free plan. Pro includes 75 Posts for $4.50/month for 3 months, then $9/month. Upgrade here: …",
  "entitlement": { "id": "posts", "name": "Posts", "usage": 3, "max": 3 },
  "offer": { "id": "launch_50", "plan": { "id": "pro", "name": "Pro" }, "interval": "month", "price": 4.5, "checkout_url": "…" },
  "retry_after_purchase": true
}`;

const health = `curl http://localhost:6767/health
# {"ok":true}`;

export default function ApiAuthenticationPage() {
  return (
    <>
      <DocsHeader
        title="Authentication"
        lead="Every request to the Offer API carries one bearer credential. Which one you send decides what the request can do."
      />

      <H2>Base URL</H2>
      <p>
        Locally the API runs on <code>http://localhost:6767</code>, started by <code>pnpm dev:api</code> at the repo
        root. In production it is the URL of your API service, for example the <code>onrender.com</code> address
        Render gives it (see <Link href="/docs/deploy">Deploy on Render</Link>). All paths on these pages are relative
        to that URL, with no version prefix.
      </p>
      <p>
        Requests and responses are JSON. Send <code>Content-Type: application/json</code> with a body. A body that
        isn&apos;t valid JSON returns <code>400</code>.
      </p>
      <Callout title="Trying the API by hand?">
        The <Link href="/docs/sponsors/postman">Postman collection</Link> has every route with the right credential
        already set, and a Quickstart folder that creates an app and saves its keys for you.
      </Callout>

      <H2>Sending a credential</H2>
      <p>
        Put the credential in the <code>Authorization</code> header as a bearer token. A missing or wrong credential,
        or one that isn&apos;t allowed on the route, returns <code>401</code> with{" "}
        <code>{"{ \"error\": \"Unauthorized\" }"}</code>.
      </p>
      <Code lang="bash" code={authedCall} />

      <H2>Credentials</H2>
      <Table
        head={["Credential", "Looks like", "Where it comes from", "Scope"]}
        rows={[
          [
            "Admin key",
            "any string",
            <>
              The API&apos;s <code>ADMIN_API_KEY</code> variable. <code>dev-admin-key</code> in local development.
            </>,
            "Every route, for every app, plus the admin-only routes.",
          ],
          [
            "Secret key",
            <code key="k">key_…</code>,
            <>
              <code>api_key</code> in the response to <code>POST /apps</code>, or the dashboard&apos;s API keys page.
            </>,
            "Every route under its own /apps/:appId, except the admin-only ones.",
          ],
          [
            "Publishable key",
            <code key="k">pub_…</code>,
            <>
              <code>public_key</code> in the same response.
            </>,
            "A short list of read, usage and checkout routes for its app.",
          ],
          [
            "Account token",
            <code key="k">act_…</code>,
            <>
              Minted by your server with <code>POST /apps/:appId/namespaces/:accountId/token</code>.
            </>,
            "Cancel sessions and a few reads, for one account only. Expires.",
          ],
        ]}
      />
      <p>
        The MCP server at <code>/apps/:appId/mcp</code> also takes OAuth access tokens (<code>mcp_at_…</code>), which
        work on that route only. See <Link href="/docs/api/mcp">MCP server</Link>.
      </p>
      <Callout tone="warning" title="Keep the admin and secret keys on servers.">
        The admin key is shared by the API and the dashboard and reaches every app. The secret key can change or
        delete anything in its app. Browsers get the publishable key or an account token.
      </Callout>

      <H3>Publishable key</H3>
      <p>The publishable key works on these routes of its own app and nowhere else:</p>
      <ul>
        <li>
          <code>GET …/namespaces/:accountId/plan</code>
        </li>
        <li>
          <code>GET</code> on the routes under <code>…/namespaces/:accountId/usage</code>, plus <code>POST …/add</code>{" "}
          and <code>POST …/amount</code> with an amount of zero or more
        </li>
        <li>
          <code>GET /apps/:appId/plans/pricing</code> and <code>GET /apps/:appId/plans/:planId/pricing</code>
        </li>
        <li>
          <code>GET /apps/:appId/offers/:offerId/public</code> and <code>POST /apps/:appId/offers/:offerId/checkout</code>
        </li>
        <li>
          <code>POST /apps/:appId/plans/:planId/checkout</code>
        </li>
        <li>
          <code>GET /apps/:appId/checkouts/:checkoutId</code> and{" "}
          <code>POST /apps/:appId/checkouts/:checkoutId/complete</code>
        </li>
      </ul>
      <p>
        It isn&apos;t tied to one account: anyone who has it can read any account&apos;s plan by id and add usage for
        it. It can&apos;t read private meta (<code>/full-plan</code> returns <code>401</code>) or lower a counter (
        <code>/remove</code> returns <code>401</code>, a negative <code>/amount</code> returns <code>403</code>).
      </p>

      <H3>Account tokens</H3>
      <p>
        An account token lets a customer&apos;s browser act for one account. Your server mints it with the secret key
        (body <code>{"{ \"ttl_seconds\": 3600 }"}</code>, from 60 to 86,400, default 3,600). It is signed with the
        app&apos;s secret key, so regenerating that key revokes every token. A token can call:
      </p>
      <ul>
        <li>
          Every route under <code>/apps/:appId/cancel-sessions</code>, for sessions of its own account, except the
          session list
        </li>
        <li>
          <code>GET</code> on its own account&apos;s <code>/plan</code>, <code>/full-plan</code> and{" "}
          <code>/subscription</code>
        </li>
      </ul>
      <p>
        <Link href="/docs/sdk/cancel-flows">Cancel flows</Link> shows the token in use.
      </p>

      <H3>Admin key</H3>
      <p>
        The dashboard calls the API with the admin key on behalf of signed-in users. These routes accept nothing
        else:
      </p>
      <ul>
        <li>
          <code>POST /apps</code>: creating an app
        </li>
        <li>
          <code>/orgs</code>: the workspaces the dashboard shows, and which apps each one holds
        </li>
        <li>
          <code>/pauses/*</code>: used by the Render Workflow that applies and resumes pauses
        </li>
        <li>
          <code>POST /apps/:appId/import</code>: backdated history import
        </li>
        <li>
          <code>/apps/:appId/agent/threads</code>: the dashboard agent&apos;s chat threads
        </li>
        <li>
          <code>/apps/:appId/mcp/settings</code>, <code>/connections</code> and <code>/calls</code>: the MCP server
          page
        </li>
        <li>
          <code>/oauth/requests/*</code>: the consent page that approves MCP connections
        </li>
        <li>
          <code>/api/auth/*</code>: dashboard sign-in, which the dashboard proxies
        </li>
      </ul>

      <H3>No credential</H3>
      <p>
        <code>GET /</code>, <code>GET /health</code>, <code>GET /openapi.json</code>, <code>GET /docs</code> and{" "}
        <code>GET /event-types</code> are open. PayPal
        calls <code>POST /paypal/webhooks/:appId</code> without a key, and the API verifies each call with PayPal.
        MCP clients use <code>/.well-known/*</code>, <code>/oauth/register</code>, <code>/oauth/authorize</code>,{" "}
        <code>/oauth/token</code> and <code>/oauth/revoke</code> to sign in.
      </p>

      <H2>Getting and rotating keys</H2>
      <p>
        Create an app to get its keys. The dashboard does this when you add an app, and shows the keys under{" "}
        <strong>Developers → API keys</strong>. Creating one through the API takes the admin key.
      </p>
      <Code lang="bash" code={createApp} />
      <Code title="201 Created" lang="json" code={createAppResponse} />
      <p>
        <code>POST /apps/:appId/keys/regenerate</code> replaces the secret key and returns{" "}
        <code>{"{ \"api_key\": \"key_…\" }"}</code>. <code>POST /apps/:appId/public-key/regenerate</code> replaces
        the publishable key. The old key stops working at once. <code>PATCH /apps/:appId</code> ignores key fields.
      </p>

      <H2>Errors</H2>
      <p>
        REST routes return errors as JSON with an <code>error</code> message. A few add fields, noted below. The
        OAuth routes MCP clients use follow the OAuth format instead (<code>error</code> and{" "}
        <code>error_description</code>), and <code>/oauth/authorize</code> shows an HTML error page.
      </p>
      <Code lang="json" code={errorBody} />
      <Table
        head={["Status", "When"]}
        rows={[
          ["400", "Invalid JSON, a missing or invalid field, or an unknown event type."],
          ["401", "No credential, a wrong one, or one that isn't allowed on this route."],
          ["402", "A usage call would go past a limit set to block. The body explains the limit and offers an upgrade."],
          ["403", "A write with the secret key of a demo workspace app, a negative /amount with the publishable key, a cancel session started with an account token that named a different account, or a call to an app's MCP server while it is turned off."],
          ["404", "The app, account, plan or other record doesn't exist, or an account token asked for another account's session."],
          ["405", "GET or DELETE on /apps/:appId/mcp. The MCP server only takes POST."],
          ["409", "The request conflicts with current state. For example: a record with that id exists, the offer can't be bought (the body adds reason), PayPal isn't connected, or a cancel session isn't at that step."],
          ["500", "An unexpected error. The body is { \"error\": \"Internal server error\" }."],
          ["502", "PayPal returned an error. The message starts with “PayPal:”."],
        ]}
      />

      <H3>402 Payment Required</H3>
      <p>
        Entitlements with <code>overage.mode</code> set to <code>block</code> refuse usage past the limit. The body
        has a plain-language <code>message</code> and an upgrade offer with a checkout link, so a person or an AI agent
        can act on it directly. <Link href="/docs/sdk">Access and entitlements</Link> shows the full body and how to
        handle it.
      </p>
      <Code title="POST …/usage/posts/add" lang="json" code={limitBody} />

      <H2>CORS</H2>
      <p>
        The API answers CORS preflight requests for any origin, so browser code on any domain can call it with the
        publishable key or an account token.
      </p>

      <H2>Lists and pagination</H2>
      <p>
        Account search (<code>GET /apps/:appId/namespaces</code>),{" "}
        <code>GET /apps/:appId/namespaces/with-incentive</code> and{" "}
        <code>GET /apps/:appId/plans/:planId/namespaces</code> take <code>page</code> and <code>per_page</code>{" "}
        (default 20, at most 100) and return <code>{"{ data, total, page, per_page }"}</code>. Logs such as events,
        deliveries, checkouts and cancel sessions take <code>limit</code> and return newest first. Most cap it at
        100; <code>GET /apps/:appId/analytics/events</code> defaults to 50 and allows up to 200, and{" "}
        <code>GET /apps/:appId/analytics/top-namespaces</code> returns <code>400</code> outside 1 to 100. Catalog lists return everything in the
        order it was created.
      </p>

      <H2>Health check</H2>
      <p>
        <code>GET /health</code> runs a query against Postgres and returns <code>{"{ \"ok\": true }"}</code>. Render
        uses it as the service&apos;s health check.
      </p>
      <Code lang="bash" code={health} />

      <H2>OpenAPI spec</H2>
      <p>
        The API serves an OpenAPI 3.1 document at <code>GET /openapi.json</code> and an interactive reference built
        from it at <code>GET /docs</code> (<code>http://localhost:6767/docs</code> locally). The spec is written by
        hand and covers the core routes: apps, plans, entitlements, add-ons, incentives, accounts, usage, the main
        analytics routes, webhooks and orgs. Offers, checkouts, subscriptions, PayPal, cancel flows, account tokens,
        account add-ons, history import, the agent&apos;s threads and MCP aren&apos;t in it.{" "}
        <Link href="/docs/api/reference">Endpoint reference</Link> lists every route.
      </p>
    </>
  );
}
