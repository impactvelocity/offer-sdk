import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, Step, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Quickstart",
  description: "Run the Offer API, dashboard and demo workspace locally, then check an account's access from your code.",
};

const fullPlan = `{
  "plan": { "id": "pro", "name": "Pro", "description": null, "isFree": false, "meta": {}, "privateMetaKeys": [] },
  "incentive": null,
  "offer": null,
  "addons": [],
  "entitlements": [
    { "id": "posts", "feature": "posts", "name": "Posts", "type": "usage", "usage": 2, "max": 100, "left": 98, "can": true },
    { "id": "pin_posts", "feature": "pin_posts", "name": "Pin posts", "type": "boolean", "usage": 0, "max": null, "left": null, "can": true }
  ]
}`;

export default function QuickstartPage() {
  return (
    <>
      <DocsHeader
        title="Quickstart"
        lead="Run the whole stack on your machine in a few minutes, sign in to the demo workspace, and read an account's access from the API."
      />

      <H2>Before you start</H2>
      <ul>
        <li>
          <strong>Node 22</strong> or newer. The Workflows service in <code>workflows/</code> needs Node 24, but you
          don&apos;t need it to run the rest locally.
        </li>
        <li>
          <strong>pnpm 9</strong>. Running <code>corepack enable</code> picks up the version pinned in{" "}
          <code>package.json</code>.
        </li>
        <li>
          <strong>Docker</strong>, for Postgres and the API. You don&apos;t need Bun or Postgres installed.
        </li>
      </ul>

      <H2>Run it locally</H2>
      <Steps>
        <Step title="Clone and install">
          <Code
            lang="bash"
            code={`
git clone https://github.com/impactvelocity/offer-sdk
cd offer-sdk
pnpm install`}
          />
        </Step>
        <Step title="Start Postgres and the API">
          <p>
            This runs Postgres 17 and the API in watch mode on <code>http://localhost:6767</code>. Migrations run on
            boot. The API&apos;s interactive reference is at <code>http://localhost:6767/docs</code>.
          </p>
          <Code lang="bash" code="pnpm dev:api" />
        </Step>
        <Step title="Start the dashboard">
          <p>
            In a second terminal. <code>pnpm dev</code> starts every app in the workspace; <code>pnpm dev:app</code>{" "}
            starts only the dashboard.
          </p>
          <Code lang="bash" code="pnpm dev:app" />
          <p>
            Open <code>http://localhost:6768</code>. In development the dashboard already points at the local API with
            its development admin key, so neither side needs a <code>.env</code> file.
          </p>
        </Step>
        <Step title="Open the demo workspace">
          <p>
            Press <strong>Explore the demo workspace</strong> on the sign-in page. The first time, the dashboard builds
            two sample apps with six months of usage, which takes a few seconds. After that you can also sign in with{" "}
            <code>demo@offersdk.dev</code> and <code>demo-password</code>. Run <code>pnpm seed:demo --reset</code> to
            start the demo over.
          </p>
        </Step>
      </Steps>

      <Table
        head={["Service", "URL", "Started by"]}
        rows={[
          ["API", "http://localhost:6767", <code key="c">pnpm dev:api</code>],
          ["Dashboard", "http://localhost:6768", <code key="c">pnpm dev:app</code>],
          ["Marketing site", "http://localhost:6769", <code key="c">pnpm dev:site</code>],
          ["Blog test bed", "http://localhost:6770", <code key="c">pnpm dev:demo</code>],
        ]}
      />

      <H2>Check an account&apos;s access</H2>
      <p>
        Create your own app in the dashboard, add an entitlement and a plan, then copy the app id and its secret key
        from <strong>Developers → API keys</strong>. Every account your app has is a record in the API, keyed by an id
        you choose (usually your user or team id).
      </p>
      <Code
        title="Create an account on a plan"
        lang="bash"
        code={`
curl -X POST http://localhost:6767/apps/$APP_ID/namespaces \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "id": "user_42", "name": "Ada", "plan": "pro" }'`}
      />
      <p>
        Then ask what that account can do. <code>full-plan</code> returns the plan with every entitlement already
        resolved, including current usage and whether the account can use it right now.
      </p>
      <Code
        lang="bash"
        code={`
curl http://localhost:6767/apps/$APP_ID/namespaces/user_42/full-plan \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY"`}
      />
      <Code title="Response" lang="json" code={fullPlan} />
      <p>
        When the account uses a metered feature, record it. The API answers with the new count, or with{" "}
        <code>402</code> and an upgrade offer if the entitlement blocks usage past its limit.
      </p>
      <Code
        lang="bash"
        code={`
curl -X POST http://localhost:6767/apps/$APP_ID/namespaces/user_42/usage/posts/add \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY"`}
      />
      <Callout tone="warning" title="Keep the secret key on your server.">
        It can change any record in the app. The browser gets the publishable key (<code>pub_…</code>), which can only
        read plans and pricing, track usage and run checkouts. <Link href="/docs/api">Authentication</Link> lists what
        each key can do.
      </Callout>

      <H2>Optional settings</H2>
      <p>
        Everything above works with no configuration. Add these when you want the AI features, or to work without
        Docker.
      </p>
      <Table
        head={["Variable", "Where", "What it turns on"]}
        rows={[
          [
            "ANTHROPIC_API_KEY",
            <>
              <code>offer-app/.env.local</code>
            </>,
            "The Agent page in the dashboard.",
          ],
          [
            "ANTHROPIC_API_KEY",
            <>
              <code>api/.env</code>
            </>,
            "Dynamic save offers in cancel flows. Without it, the flow shows its static offer.",
          ],
          [
            "OFFER_API_URL=mock",
            <>
              <code>offer-app/.env.local</code>
            </>,
            "Runs the dashboard on an in-memory mock API with a demo workspace, no Docker needed. Offers and cancel flows are hidden in this mode.",
          ],
        ]}
      />

      <H2>Next steps</H2>
      <ul>
        <li>
          Learn the records you just touched in <Link href="/docs/concepts">Core concepts</Link>.
        </li>
        <li>
          Gate features in React with the <Link href="/docs/sdk">React SDK</Link>.
        </li>
        <li>
          Put it online with <Link href="/docs/deploy">Deploy on Render</Link>.
        </li>
      </ul>
    </>
  );
}
