import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Agent and MCP",
  description: "Chat with Claude about an app's catalog and accounts, approve every change it proposes, and what the MCP server page does and doesn't do yet.",
};

export default function AgentDocsPage() {
  return (
    <>
      <DocsHeader
        title="Agent and MCP"
        lead="The Agent page is a chat with Claude that can look up your catalog, accounts and usage, and change plans, entitlements, add-ons and incentives. Every change waits for your approval. The MCP server page is a preview of a server that doesn't exist yet."
      />

      <H2>Turn on the agent</H2>
      <p>
        The agent runs in the dashboard, so the key goes on the dashboard (offer-app), not the API:
      </p>
      <Code
        lang="bash"
        title="offer-app/.env.local"
        code={`ANTHROPIC_API_KEY=sk-ant-...
# optional, see "Signed approvals" below
AGENT_APPROVAL_SECRET=...`}
      />
      <p>
        Restart the dev server after adding it. Without the key, <strong>Agent</strong> (<code>/apps/[appId]/agent</code>)
        shows <strong>The agent needs an Anthropic API key</strong>, and the chat endpoint <code>POST /api/agent</code>{" "}
        answers 503. On Render, set it on the dashboard service. See{" "}
        <Link href="/docs/deploy/environment">Environment variables</Link>.
      </p>
      <p>
        The agent works the same against the hosted API and the mock. Its tools go through the same gateway as the rest
        of the dashboard, so its answers match what the pages show. You need the same access as for the app itself:
        signed in, with the app in your active workspace.
      </p>

      <H2>Chats</H2>
      <p>
        <strong>New chat</strong> starts a conversation. An empty chat suggests a few prompts, such as “Which accounts
        are closest to their limits?” and “Raise the Pro plan&apos;s AI credits by 50%”. Past chats are listed on the
        left (behind <strong>Chats</strong> on narrow screens), where you can rename or delete them. The open chat is
        in the URL as <code>?thread=</code>.
      </p>
      <p>
        Chats are stored by the Offer API under <code>/apps/:appId/agent/threads</code>, a route only the admin key can
        call. Each chat belongs to the person who started it, and nobody else in the workspace can open it. A new
        chat gets a short title generated from its first message.
      </p>
      <TermList
        items={[
          {
            term: "Model",
            children: (
              <>
                <code>claude-sonnet-5-5</code> with summarized thinking shown in the chat, up to 10 tool steps per
                reply. Titles use <code>claude-haiku-4-5-20251001</code>.
              </>
            ),
          },
          {
            term: "Source",
            children: (
              <>
                <code>offer-app/src/app/api/agent/route.ts</code> (the endpoint and instructions),{" "}
                <code>src/server/agent/tools.ts</code> (the tools) and <code>src/components/agent</code> (the UI).
              </>
            ),
          },
        ]}
      />

      <H2>What it can look up</H2>
      <p>Read tools run straight away, and the chat shows each one as a collapsed step.</p>
      <Table
        head={["Tool", "What it returns"]}
        rows={[
          ["getAppOverview", "The app's name and how many plans, entitlements, add-ons, incentives and accounts it has."],
          ["getCatalog", "All plans, entitlements, add-ons or incentives, with limits and pricing."],
          ["showCatalog", "The same records, shown to you as cards in the chat. The agent uses it whenever you ask to see or compare records."],
          ["searchAccounts", "Accounts by name or ID, optionally filtered by plan or incentive, 20 per page."],
          ["getAccount", "One account plus its resolved access: every entitlement, its limit after add-ons and incentives, and current usage."],
          ["findAccountsNearLimits", "Accounts at or above a share of their limits (70% by default), highest first. It scans up to 500 accounts per call."],
          ["getUsage", "Usage totals per entitlement for the app, or for one account, over a period."],
          ["getTopAccounts", "Accounts ranked by usage, optionally for one entitlement."],
        ]}
      />

      <H2>What it can change</H2>
      <p>Twelve write tools cover the catalog:</p>
      <TermList
        items={[
          {
            term: "Plans",
            children: (
              <>
                <code>createPlan</code>, <code>updatePlan</code> and <code>deletePlan</code>. A plan can only be deleted
                when no accounts are on it.
              </>
            ),
          },
          {
            term: "Entitlements",
            children: (
              <>
                <code>createEntitlement</code>, <code>updateEntitlement</code> (name and description) and{" "}
                <code>deleteEntitlement</code>, which removes it from every plan and incentive first.
              </>
            ),
          },
          {
            term: "Add-ons",
            children: (
              <>
                <code>createAddon</code>, <code>updateAddon</code> and <code>deleteAddon</code>, which removes it from
                every plan and incentive first.
              </>
            ),
          },
          {
            term: "Incentives",
            children: (
              <>
                <code>createIncentive</code>, <code>updateIncentive</code> and <code>deleteIncentive</code>, which
                removes it from every account that has it first.
              </>
            ),
          },
        ]}
      />
      <p>
        The agent can&apos;t change accounts, offers, cancel flows, keys or webhooks. For account changes it points you
        to the <strong>Accounts</strong> page.
      </p>

      <H2>Approving changes</H2>
      <p>
        A write tool never runs on its own. When the agent calls one, the chat shows a change card with what will
        change, previewed against the live catalog, and two buttons: <strong>Decline</strong> and{" "}
        <strong>Approve</strong>. For a delete, the card also lists what else is affected, such as accounts on a plan.
        The card&apos;s badge reads <strong>Needs approval</strong> while it waits, then <strong>Applying</strong>,
        then <strong>Applied</strong>, <strong>Declined</strong> or <strong>Failed</strong>. Once applied, the card
        shows what actually changed.
      </p>
      <ul>
        <li>
          Only the latest message&apos;s cards can still be answered. Older unanswered ones show{" "}
          <strong>Not applied</strong>.
        </li>
        <li>If you decline, the agent doesn&apos;t retry the same change. It asks what you want instead.</li>
        <li>The approval card is the confirmation, so the agent doesn&apos;t ask “shall I go ahead?” in text first.</li>
      </ul>

      <H3>Signed approvals</H3>
      <p>
        The browser sends the whole conversation back with each message, including your approvals. To stop a client
        from forging one, the server signs every approval request with an HMAC key when it issues it, and checks the
        signature before a write runs.
      </p>
      <p>
        The key comes from <code>AGENT_APPROVAL_SECRET</code>. When that isn&apos;t set, it is derived from{" "}
        <code>BETTER_AUTH_SECRET</code>, then <code>OFFER_API_ADMIN_KEY</code>, then the mock&apos;s admin key.
      </p>
      <Callout title="Running more than one dashboard instance?">
        Set the same <code>AGENT_APPROVAL_SECRET</code> on every instance, so an approval signed by one instance
        verifies on another.
      </Callout>

      <H2>The MCP server page</H2>
      <p>
        <strong>Developers → MCP server</strong> (<code>/apps/[appId]/developers/mcp</code>) carries a{" "}
        <strong>Preview</strong> badge, and that is accurate: it is a design for an MCP server, built as a UI, with no
        server behind it.
      </p>
      <Callout tone="warning" title="No MCP server runs yet.">
        Neither the API nor the dashboard has an MCP endpoint. The <strong>Server URL</strong> the page shows (
        <code>{"<API URL>/apps/<appId>/mcp"}</code>) doesn&apos;t answer, so clients like Claude or Cursor can&apos;t
        connect to it.
      </Callout>
      <p>What the page does today:</p>
      <ul>
        <li>
          The <strong>Enabled</strong> switch, the access level and the per-tool toggles only change state in your
          browser tab. They reset when you reload.
        </li>
        <li>
          The <strong>Connections</strong> and <strong>Activity</strong> tabs show sample data built from your
          app&apos;s real IDs.
        </li>
        <li>
          The server card and the <strong>Connect</strong> and <strong>Tools</strong> tabs describe the proposed
          server: Streamable HTTP transport, one tool per API endpoint scoped to the app in the URL, access levels (<strong>Read only</strong>,{" "}
          <strong>Read &amp; write</strong>, <strong>Full access</strong>), and a set of resources and prompts.
        </li>
      </ul>
      <p>
        To work with an app from an AI assistant today, use the Agent page, or give the assistant the{" "}
        <strong>AI assistant context</strong> block from <strong>Developers → Integration</strong> and let it call the{" "}
        <Link href="/docs/api">API</Link> directly. How Claude is used across the product is in{" "}
        <Link href="/docs/ai">AI features</Link>.
      </p>
    </>
  );
}
