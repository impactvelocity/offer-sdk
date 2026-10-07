import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "AI features",
  description:
    "How Offer SDK uses Claude: dynamic save offers in cancel flows, with guardrails the API enforces, and the dashboard agent that edits the catalog with your approval.",
};

export default function AiFeaturesPage() {
  return (
    <>
      <DocsHeader
        title="AI features"
        lead="Claude picks save offers when a customer cancels, and runs the dashboard agent. Both are optional and switch on with an Anthropic API key."
      />

      <H2>Where Claude runs</H2>
      <Table
        head={["Model", "Used for", "Where"]}
        rows={[
          [
            "claude-opus-5-5",
            <>
              Dynamic save offers. <code>DECIDE_MODEL</code> overrides it.
            </>,
            <>
              The API, <code>api/src/lib/decide.ts</code>
            </>,
          ],
          [
            "claude-sonnet-5-5",
            "The Agent page: answering questions and proposing catalog changes.",
            <>
              The dashboard, <code>offer-app/src/app/api/agent/route.ts</code>
            </>,
          ],
          [
            "claude-haiku-4-5-20251001",
            "A short title for each new agent chat.",
            "The dashboard, same route.",
          ],
        ]}
      />
      <p>
        The two features read their key on different services, so you can turn on one without the other:
      </p>
      <Table
        head={["Variable", "Service", "Without it"]}
        rows={[
          [
            "ANTHROPIC_API_KEY",
            <>
              API (<code>offersdk-api</code>)
            </>,
            "Cancel flows show their static offer. If a flow has dynamic offers on, the editor says the key is missing.",
          ],
          [
            "ANTHROPIC_API_KEY",
            <>
              Dashboard (<code>offer-app</code>)
            </>,
            <>
              The Agent page explains how to enable it, and <code>POST /api/agent</code> returns <code>503</code>.
            </>,
          ],
        ]}
      />
      <p>
        Both are <code>sync: false</code> in <code>render.yaml</code>, so Render asks for them on the first deploy and
        you can leave them empty. Locally, put them in <code>api/.env</code> and <code>offer-app/.env.local</code>.
      </p>

      <H2>Dynamic save offers</H2>
      <p>
        A cancel flow&apos;s offer step can have <strong>Dynamic offers</strong> turned on. When a customer reaches that
        step, the API sends Claude what it knows about the account and why they&apos;re leaving, and Claude picks one
        offer and writes its copy.
      </p>
      <TermList
        items={[
          {
            term: "What Claude sees",
            children:
              "The app's name. The customer's plan, price, number of payments, months as a customer, the offer they bought through, and usage against each limit. Their answers to the flow's questions. The offer kinds and limits that apply, and the team's instructions.",
          },
          {
            term: "What Claude returns",
            children:
              "JSON that matches a schema built for this request: a short reasoning for the team, the offer kind (or none), its numbers, a plan or incentive id, and a headline, body and button label.",
          },
          {
            term: "How it's called",
            children: (
              <>
                The Messages API with structured output (<code>output_config.format</code> set to a JSON schema), low
                effort, up to 4,000 output tokens, one retry, and a 20 second timeout (<code>DECIDE_TIMEOUT_MS</code>).
                Plan and incentive ids are enums in the schema, so the model can only name ones that exist.
              </>
            ),
          },
        ]}
      />
      <p>
        The system prompt tells Claude to match the offer to the reason (price, low use, a missing feature) and to
        respect a decision no offer can fix, such as switching to a competitor or closing the business. It asks for the
        smallest offer likely to work, plain copy with no pressure or fake urgency, and no prices in the text.
      </p>

      <H3>Guardrails the API enforces</H3>
      <p>
        The team sets limits in the cancel flow editor. The API uses them twice: to tell Claude what&apos;s allowed, and
        to check the answer. Claude&apos;s output is never trusted as is.
      </p>
      <Table
        head={["Guardrail", "Range", "Default"]}
        rows={[
          ["kinds", "discount, pause, downgrade, incentive", "All four"],
          ["max_discount_percent", "1 to 90", "50"],
          ["max_discount_cycles", "1 to 24", "3"],
          ["max_pause_months", "1 to 12", "3"],
          ["max_incentive_months", "1 to 24", "3"],
          ["incentives", "Incentive ids Claude may offer", "None"],
          ["downgrade_plans", "Plans Claude may move the account to", "Any cheaper plan"],
          ["instructions", "Up to 2,000 characters", "Empty"],
        ]}
      />
      <ul>
        <li>
          Kinds are narrowed to what can apply to this account. Discounts and pauses need an active PayPal subscription,
          a downgrade needs a cheaper allowed plan, and an incentive needs at least one allowed incentive.
        </li>
        <li>
          Numbers are rounded and clamped: discounts to between 5% and the maximum, discount cycles, pause months and
          incentive months to between 1 and their maximum.
        </li>
        <li>
          A plan or incentive that isn&apos;t in the allowed list is dropped. Copy is cut to 120 characters for the
          headline, 500 for the body and 60 for the button.
        </li>
        <li>
          The reasoning is stored on the session for the dashboard and the <code>cancel_flow.saved</code> webhook. The
          customer never sees it.
        </li>
      </ul>

      <H3>When Claude isn&apos;t used</H3>
      <p>
        The flow falls back to its static offer (the offer set for the customer&apos;s answer, else the step&apos;s
        default) when there&apos;s no <code>ANTHROPIC_API_KEY</code>, the call fails or times out, the model refuses or
        runs out of tokens, the JSON doesn&apos;t parse, Claude picks <code>none</code>, or it picks something that
        doesn&apos;t apply. If no static offer applies either, the step is skipped. The session records which happened
        in <code>decide</code>:
      </p>
      <Code
        title="Session field"
        lang="json"
        code={`
{ "decide": { "used": false, "skipped": "ANTHROPIC_API_KEY is not set" } }`}
      />
      <p>
        Accepting the offer works the same for static and dynamic offers. Discounts and downgrades go to PayPal for
        approval (see <Link href="/docs/sponsors/paypal">PayPal</Link>), pauses run on Render Workflows when configured
        (see <Link href="/docs/sponsors/render">Render</Link>), and incentives apply at once.{" "}
        <Link href="/docs/sdk/cancel-flows">Cancel flows</Link> covers the SDK side.
      </p>

      <H2>The dashboard agent</H2>
      <p>
        The <strong>Agent</strong> page in each app is a chat with Claude about that app&apos;s catalog. It runs in the
        dashboard&apos;s own server at <code>POST /api/agent</code>, built on the Vercel AI SDK with its Anthropic
        provider. Each request uses adaptive thinking with a summary shown in the chat, medium effort, and at most 10
        steps.
      </p>
      <p>
        Only a signed-in user whose active workspace owns the app can use it. Each chat is saved as a thread through the
        API and is private to the user who started it.
      </p>

      <H3>Read tools</H3>
      <p>These run as soon as Claude calls them:</p>
      <Code
        lang="text"
        code={`
getAppOverview  getCatalog  showCatalog  searchAccounts
getAccount  findAccountsNearLimits  getUsage  getTopAccounts`}
      />
      <H3>Write tools</H3>
      <p>
        These change plans, entitlements, add-ons and incentives. Each one stops and shows the user a card with the
        change. Nothing runs until the user approves it. If the user declines, Claude is told to ask what they want
        instead of trying again.
      </p>
      <Code
        lang="text"
        code={`
createPlan  updatePlan  deletePlan
createEntitlement  updateEntitlement  deleteEntitlement
createAddon  updateAddon  deleteAddon
createIncentive  updateIncentive  deleteIncentive`}
      />
      <p>
        Every tool goes through the same gateway as the rest of the dashboard, so the agent sees and changes
        what the dashboard shows. The agent can&apos;t change accounts.
      </p>

      <H3>Signed approvals</H3>
      <p>
        Approvals come back to the server inside the chat history the browser sends, so a client could try to forge
        one. The server signs each approval with an HMAC when it issues it and checks the signature before a write
        runs. The key comes from <code>AGENT_APPROVAL_SECRET</code>, then <code>BETTER_AUTH_SECRET</code>, then{" "}
        <code>OFFER_API_ADMIN_KEY</code>.
      </p>
      <Callout tone="warning" title="Running more than one dashboard instance?">
        Set the same <code>AGENT_APPROVAL_SECRET</code> on all of them, or an approval issued by one instance can fail
        on another.
      </Callout>
      <p>
        <Link href="/docs/admin/agent">Agent and MCP</Link> shows what using the agent looks like in the dashboard.
      </p>

      <H2>Claude as an MCP client</H2>
      <p>
        You can also bring your own Claude. Each app has an <Link href="/docs/api/mcp">MCP server</Link> in the API,
        and Claude, Claude Code and other MCP clients connect to it with OAuth or the secret key. That needs no
        Anthropic API key on your side: the model runs in the client, and the server only serves tools, resources and
        prompts.
      </p>
    </>
  );
}
