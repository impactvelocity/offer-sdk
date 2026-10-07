import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, EndpointList, H2, Table } from "@/components/docs/prose";
import { RENDER_DEPLOY_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Render",
  description:
    "How Offer SDK runs on Render: one Blueprint for four resources, private networking between them, and Render Workflows for subscription pauses.",
};

export default function RenderDocsPage() {
  return (
    <>
      <DocsHeader
        title="Render"
        lead="Render hosts the whole stack from one Blueprint, and runs subscription pauses as Render Workflow tasks with their own retries and run log."
      />

      <H2>What the Blueprint creates</H2>
      <p>
        <code>render.yaml</code> at the repo root describes four resources. Render creates them together and wires
        their URLs and shared secrets.
      </p>
      <Table
        head={["Resource", "Type", "What it runs"]}
        rows={[
          [
            "offersdk-api",
            "Web service (Docker)",
            <>
              The Offer API from <code>api/Dockerfile</code>. Health check on <code>/health</code>, which also checks
              the database.
            </>,
          ],
          [
            "offer-app",
            "Web service (Node)",
            <>
              The dashboard. Built with pnpm through corepack, health check on <code>/api/health</code>.
            </>,
          ],
          [
            "offersdk-workflows",
            "Workflow (Node)",
            <>
              The pause tasks in <code>workflows/src/index.ts</code>. Needs Node 24 or newer.
            </>,
          ],
          ["offersdk-db", "Postgres 17", "All data, including dashboard users and sessions. Its IP allow list is empty, so only internal connections work."],
        ]}
      />
      <p>
        Each service has a build filter, so a push that only touches <code>api/</code> doesn&apos;t rebuild the
        dashboard, and the reverse.
      </p>

      <H2>Deploy</H2>
      <p>
        Use the <a href={RENDER_DEPLOY_URL}>one-click deploy link</a>, or choose <strong>New → Blueprint</strong> in
        Render and pick your fork. On the first deploy Render asks for the values marked <code>sync: false</code>:
      </p>
      <Table
        head={["Variable", "Service", "Value"]}
        rows={[
          ["ADMIN_API_KEY", "offersdk-api", <>A long random secret, for example from <code>openssl rand -hex 32</code>.</>],
          ["APP_URL", "offersdk-api", "The dashboard's public URL."],
          ["OFFER_API_URL", "offer-app, offersdk-workflows", "The API's public URL."],
          ["ANTHROPIC_API_KEY", "offersdk-api, offer-app", "Optional. Turns on dynamic save offers and the Agent page."],
          ["RENDER_API_KEY", "offersdk-api", "Optional. Runs pauses as Workflow tasks (below)."],
        ]}
      />
      <p>
        <Link href="/docs/deploy">Deploy on Render</Link> walks through the whole deploy, including seeding the demo
        workspace, and <Link href="/docs/deploy/environment">Environment variables</Link> lists every variable.
      </p>

      <H2>Private networking</H2>
      <p>The Blueprint keeps traffic between services off the public internet where it can:</p>
      <ul>
        <li>
          The API reads <code>DATABASE_URL</code> from the database&apos;s internal connection string.
        </li>
        <li>
          The dashboard gets <code>OFFER_API_INTERNAL_URL</code> from the API service&apos;s <code>hostport</code>. Its
          server calls the API at that address, and a bare <code>host:port</code> is treated as <code>http</code>.{" "}
          <code>OFFER_API_URL</code> is still the public address shown in snippets and the API reference.
        </li>
        <li>
          <code>ADMIN_API_KEY</code> is set once on the API and copied to the dashboard (as{" "}
          <code>OFFER_API_ADMIN_KEY</code>) and to the Workflows service with <code>fromService</code>, so the three
          always share one value.
        </li>
      </ul>
      <p>
        The Workflows service calls the API at its public <code>OFFER_API_URL</code>, with the admin key.
      </p>
      <p>
        The API also reads <code>RENDER_EXTERNAL_URL</code>, which Render sets on every web service to its{" "}
        <code>onrender.com</code> address. When an app connects PayPal, the API registers PayPal&apos;s webhook there,
        so billing events reach it with nothing to configure. <code>PUBLIC_API_URL</code> overrides it.
      </p>

      <H2>Pauses on Render Workflows</H2>
      <p>
        When a customer accepts a pause in a cancel flow, billing is suspended in PayPal and the account moves to the free
        plan for a number of months. A pause can last longer than a task is allowed to run (24 hours), so no task sleeps.
        The resume date is stored on the account, and the API checks for pauses that are due.
      </p>
      <Table
        head={["Task", "Started by", "What it does"]}
        rows={[
          [
            "pause-subscription",
            "The API, when a customer accepts a pause.",
            <>
              Calls <code>POST /pauses/apply</code>. Up to 6 retries, 30 seconds apart at first and doubling each time.
            </>,
          ],
          [
            "resume-due-pauses",
            "The API's timer, when at least one pause is due.",
            <>
              Reads <code>GET /pauses/due?limit=100</code> and starts one <code>resume-subscription</code> run per
              account, so one account&apos;s PayPal error doesn&apos;t hold up the rest.
            </>,
          ],
          [
            "resume-subscription",
            "resume-due-pauses",
            <>
              Calls <code>POST /pauses/resume</code>, which reactivates billing in PayPal and restores the plan. Same
              retries as <code>pause-subscription</code>.
            </>,
          ],
        ]}
      />
      <p>
        The tasks hold no billing logic. They call the API&apos;s admin-only <code>/pauses</code> routes, and the API
        talks to PayPal, updates the account and sends <code>subscription.paused</code> or{" "}
        <code>subscription.resumed</code>. A <code>404</code> or <code>409</code> from the API (already paused, already
        resumed, account gone) ends the run as skipped. Any other failure throws, and Render retries the task.
      </p>
      <EndpointList
        endpoints={[
          { method: "GET", path: "/pauses/due?limit=100", summary: "Accounts whose pause has reached its resume date, across all apps.", auth: "Admin key" },
          {
            method: "POST",
            path: "/pauses/apply",
            summary: (
              <>
                Body <code>{"{ app_id, account_id, months, session_id?, reason? }"}</code>. Suspends in PayPal and moves
                the account to the free plan.
              </>
            ),
            auth: "Admin key",
          },
          {
            method: "POST",
            path: "/pauses/resume",
            summary: (
              <>
                Body <code>{"{ app_id, account_id }"}</code>. Reactivates billing and restores the paused plan.
              </>
            ),
            auth: "Admin key",
          },
        ]}
      />

      <H2>How the API starts runs</H2>
      <p>
        The API uses Render&apos;s SDK (<code>@renderinc/sdk</code>) to start tasks by name. Workflow mode is on when both
        variables are set on the API:
      </p>
      <Table
        head={["Variable", "Value"]}
        rows={[
          ["RENDER_API_KEY", "A Render API key from your account settings. The Render SDK reads it from the environment."],
          [
            "RENDER_WORKFLOW_SLUG",
            <>
              The Workflows service name. The Blueprint sets it to <code>offersdk-workflows</code>.
            </>,
          ],
        ]}
      />
      <Code
        title="api/src/lib/pauses.ts"
        lang="ts"
        code={`
render ??= new Render();
const run = await render.workflows.startTask(\`\${process.env.RENDER_WORKFLOW_SLUG}/\${name}\`, args);
return run.taskRunId;`}
      />
      <p>
        When a cancel flow&apos;s pause is accepted, the session&apos;s <code>result</code> includes{" "}
        <code>mode: &quot;workflow&quot;</code> and the <code>task_run_id</code>. A timer in the API checks for due pauses every 60 minutes in workflow mode and
        starts one <code>resume-due-pauses</code> run when any exist.
      </p>

      <H2>Without Render Workflows</H2>
      <p>
        If either variable is missing (local development, tests, or a deploy without <code>RENDER_API_KEY</code>), the
        API applies a pause in the request itself and records <code>mode: &quot;inline&quot;</code>. The same timer
        resumes due pauses in-process every 10 minutes. Nothing else changes for the customer.
      </p>
      <Table
        head={["Variable", "Effect"]}
        rows={[
          ["PAUSE_WORKER_INTERVAL_MS", "Overrides how often the timer checks for due pauses."],
          ["PAUSE_WORKER", <>Set to <code>false</code> to leave the timer to other API instances.</>],
        ]}
      />
      <Callout title="Check which mode is active.">
        The cancel flow page in the dashboard shows <strong>Pauses run on</strong>: Render Workflows or The API. It reads
        this from <code>GET /apps/:appId/cancel-flows/capabilities</code>.
      </Callout>
      <p>
        A pause made directly with <code>POST /apps/:appId/namespaces/:namespaceId/subscription/pause</code> always
        applies inline. Only pauses accepted in a cancel flow go through the workflow. See{" "}
        <Link href="/docs/sponsors/paypal">PayPal</Link> for the PayPal side of pausing.
      </p>
    </>
  );
}
