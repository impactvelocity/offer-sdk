import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, Step, Steps, Table, TermList } from "@/components/docs/prose";
import { RENDER_DEPLOY_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Deploy on Render",
  description: "Deploy the Offer API, dashboard, Workflows service and Postgres from the repo's Render Blueprint.",
};

export default function DeployPage() {
  return (
    <>
      <DocsHeader
        title="Deploy on Render"
        lead="render.yaml at the root of the repo is a Blueprint for the whole stack. One deploy creates the API, the dashboard, the Workflows service and the database, and wires them together."
      />

      <H2>What gets created</H2>
      <Table
        head={["Name", "Type", "Notes"]}
        rows={[
          ["offersdk-api", "Web service, Docker", "Built from api/Dockerfile. Health check at /health. Runs migrations on boot."],
          ["offer-app", "Web service, Node", "The dashboard. Health check at /api/health."],
          ["offersdk-workflows", "Workflow, Node", "Pause and resume tasks for subscriptions. Region oregon."],
          ["offersdk-db", "Postgres 17", "basic-256mb. Internal connections only."],
        ]}
      />
      <p>
        The two web services start on Render&apos;s <code>starter</code> plan. Change <code>plan</code> in{" "}
        <code>render.yaml</code> before you deploy if you want something else.
      </p>

      <H2>Before you start</H2>
      <ul>
        <li>A Render account. Fork the repo first if you plan to change the code, and deploy your fork.</li>
        <li>
          A long random value for the shared admin key, for example from <code>openssl rand -hex 32</code>.
        </li>
        <li>
          Optional: an Anthropic API key for the agent and dynamic save offers, and a Render API key to run pauses on
          Workflows. You can add both later.
        </li>
      </ul>
      <p>
        PayPal credentials aren&apos;t part of the deploy. Each app connects its own PayPal account in the dashboard,
        under <strong>App settings → Payments</strong>.
      </p>

      <H2>Deploy</H2>
      <Steps>
        <Step title="Start the Blueprint">
          <p>
            Use the <a href={RENDER_DEPLOY_URL}>one-click deploy link</a> for the public repo, or in Render choose{" "}
            <strong>New → Blueprint</strong> and pick your repo. Render reads <code>render.yaml</code> and lists the
            services above.
          </p>
        </Step>
        <Step title="Fill in the values Render asks for">
          <p>Everything else is generated or copied between services. These are the values only you know:</p>
          <Table
            head={["Variable", "Service", "Value"]}
            rows={[
              ["ADMIN_API_KEY", "offersdk-api", "Your random admin key."],
              ["APP_URL", "offersdk-api", "The dashboard's public URL, e.g. https://offer-app.onrender.com"],
              ["OFFER_API_URL", "offer-app", "The API's public URL, e.g. https://offersdk-api.onrender.com"],
              ["OFFER_API_URL", "offersdk-workflows", "The same API URL."],
              ["ANTHROPIC_API_KEY", "offer-app", "Optional. Turns on the Agent page."],
              ["ANTHROPIC_API_KEY", "offersdk-api", "Optional. Turns on dynamic save offers in cancel flows."],
              ["RENDER_API_KEY", "offersdk-api", "Optional. Runs pauses on Render Workflows."],
            ]}
          />
          <Callout title="You won't know the URLs for certain until the first deploy.">
            Render names them after the service, <code>https://&lt;name&gt;.onrender.com</code>, and adds a suffix when
            that name is taken. Enter the expected URLs now. If Render picks different ones, update{" "}
            <code>APP_URL</code> and both <code>OFFER_API_URL</code> values to match.
          </Callout>
        </Step>
        <Step title="Apply and wait for the first deploy">
          <p>
            The database comes up first, then the API runs its migrations and passes its health check. The dashboard
            builds with pnpm and starts once the API is healthy.
          </p>
        </Step>
        <Step title="Create your account">
          <p>
            Open the dashboard, sign up, and create a workspace and your first app. The app&apos;s keys are under{" "}
            <strong>Developers → API keys</strong>.
          </p>
        </Step>
        <Step title="Try the demo workspace (optional)">
          <p>
            The Blueprint sets <code>DEMO_ENABLED=true</code>, so the sign-in page offers{" "}
            <strong>Explore the demo workspace</strong>. The first click builds it in your database, which takes a few
            seconds. The demo login is shared and read-only, so visitors can look around but can&apos;t change or delete
            anything. Send people to <code>/demo-account</code> to open sign-in with the login filled in. To rebuild the
            demo from scratch, run this from your machine. The script signs in through the dashboard like a browser, so it
            only needs the dashboard&apos;s URL:
          </p>
          <Code lang="bash" code="APP_URL=https://offer-app.onrender.com pnpm seed:demo --reset" />
          <p>
            Set <code>DEMO_ENABLED=false</code> on <strong>offer-app</strong> if you don&apos;t want a public demo.
          </p>
        </Step>
      </Steps>

      <H2>How the services find each other</H2>
      <TermList
        items={[
          {
            term: "Shared admin key",
            children: (
              <>
                You set <code>ADMIN_API_KEY</code> once on the API. The Blueprint copies it to the dashboard as{" "}
                <code>OFFER_API_ADMIN_KEY</code> and to the Workflows service as <code>ADMIN_API_KEY</code>. The API
                rejects workspace, sign-in and pause routes without it.
              </>
            ),
          },
          {
            term: "Private network",
            children: (
              <>
                The dashboard calls the API over Render&apos;s private network at <code>OFFER_API_INTERNAL_URL</code>,
                which the Blueprint fills with the API&apos;s internal host and port. <code>OFFER_API_URL</code> stays the
                public address shown in code snippets.
              </>
            ),
          },
          {
            term: "Sign-in",
            children: (
              <>
                Users, sessions and workspaces live in the API&apos;s Postgres. <code>BETTER_AUTH_SECRET</code> is
                generated on the API. Sessions are issued for <code>APP_URL</code>, and that is the only origin the API
                trusts for sign-in.
              </>
            ),
          },
          {
            term: "PayPal webhooks",
            children: (
              <>
                When an app connects PayPal, the API registers a webhook at its own address. On Render that&apos;s the
                service&apos;s <code>onrender.com</code> URL, which Render provides as <code>RENDER_EXTERNAL_URL</code>,
                so webhooks work from the first deploy. Set <code>PUBLIC_API_URL</code> to register a different address.
              </>
            ),
          },
          {
            term: "MCP sign-in",
            children: (
              <>
                The <Link href="/docs/api/mcp">MCP server</Link>&apos;s OAuth metadata uses the same address. If you give
                clients a server URL on a custom domain, set <code>PUBLIC_API_URL</code> to that domain, or sign-in fails.
              </>
            ),
          },
          {
            term: "Database",
            children: (
              <>
                The API reads <code>DATABASE_URL</code> from the database&apos;s internal connection string. The database
                accepts no outside connections.
              </>
            ),
          },
        ]}
      />

      <H2>Run pauses on Render Workflows</H2>
      <p>
        When a customer accepts a pause in a cancel flow, the API suspends their PayPal subscription and later resumes
        it. With <code>RENDER_API_KEY</code> set on the API, each pause and resume runs as a task on{" "}
        <strong>offersdk-workflows</strong> with its own retries. <code>RENDER_WORKFLOW_SLUG</code> is already set to{" "}
        <code>offersdk-workflows</code>. Without the key, the API does the same work in-process on a timer. See{" "}
        <Link href="/docs/sponsors/render">Render</Link> for the tasks.
      </p>

      <H2>Custom domains</H2>
      <p>Add the domain in Render, then update every variable that holds the old address:</p>
      <ul>
        <li>
          New dashboard domain: <code>APP_URL</code> on <strong>offersdk-api</strong>.
        </li>
        <li>
          New API domain: <code>OFFER_API_URL</code> on <strong>offer-app</strong> and{" "}
          <strong>offersdk-workflows</strong>. PayPal webhooks keep arriving at the <code>onrender.com</code> address,
          which stays live. To move them to the new domain, set <code>PUBLIC_API_URL</code> on{" "}
          <strong>offersdk-api</strong>, then disconnect and connect PayPal again in{" "}
          <strong>App settings → Payments</strong> for each app.
        </li>
      </ul>

      <H2>Updates and migrations</H2>
      <p>
        Each service has a build filter, so a push only rebuilds the services whose files changed. Pending migrations in{" "}
        <code>api/migrations</code> run when the API boots, behind a Postgres advisory lock, so several instances can
        start at once. Set <code>MIGRATE_ON_BOOT=false</code> to run them yourself with <code>bun run migrate</code>.
      </p>

      <H2>Troubleshooting</H2>
      <TermList
        items={[
          {
            term: "Dashboard fails to start",
            children: (
              <>
                <code>OFFER_API_ADMIN_KEY is required when OFFER_API_URL is set</code> means the key wasn&apos;t copied
                from the API. Check that <code>ADMIN_API_KEY</code> is set on <strong>offersdk-api</strong>.
              </>
            ),
          },
          {
            term: "Sign-in fails",
            children: (
              <>
                Check that <code>APP_URL</code> on the API matches the dashboard address in your browser exactly,
                including <code>https://</code>. Fix it and redeploy the API.
              </>
            ),
          },
          {
            term: "PayPal shows the webhook as not registered",
            children: (
              <>
                The API couldn&apos;t find a public HTTPS address for itself, or PayPal refused it. Outside Render, set{" "}
                <code>PUBLIC_API_URL</code>. If the URL was already added by hand in PayPal, delete it there first, since
                PayPal won&apos;t register it twice. Then connect PayPal again under{" "}
                <strong>App settings → Payments</strong>.
              </>
            ),
          },
          {
            term: "The Agent page asks for a key",
            children: (
              <>
                Set <code>ANTHROPIC_API_KEY</code> on <strong>offer-app</strong>. The API&apos;s own key is only used
                for cancel flows.
              </>
            ),
          },
        ]}
      />
      <p>
        Every variable each service reads is listed in{" "}
        <Link href="/docs/deploy/environment">Environment variables</Link>.
      </p>
    </>
  );
}
