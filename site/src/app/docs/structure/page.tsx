import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/docs/architecture";
import { Callout, DocsHeader, FileTree, H2, H3, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Project structure",
  description: "The Offer SDK monorepo, the services it deploys, and how a request moves between them.",
};

export default function StructurePage() {
  return (
    <>
      <DocsHeader
        title="Project structure"
        lead="One repository holds the API, the dashboard, the React SDK, the Workflows tasks and two sites that use them. This page maps what lives where."
      />

      <H2>The repository</H2>
      <p>
        It&apos;s a pnpm workspace with Next.js apps and one Node package. The API sits beside them on Bun with its own
        lockfile, and runs in Docker.
      </p>
      <FileTree
        items={[
          { path: "api/", note: "Offer API: Hono on Bun, Postgres. Not in the pnpm workspace." },
          { path: "src/routes/", depth: 1, note: "One file per resource" },
          { path: "src/lib/", depth: 1, note: "Auth, plan resolution, PayPal, webhooks, cancel flows, Claude" },
          { path: "migrations/", depth: 1, note: "SQL migrations, run on boot" },
          { path: "test/", depth: 1, note: "End-to-end tests against a real database" },
          { path: "offer-app/", note: "The dashboard (Next.js), plus the React SDK source" },
          { path: "src/app/", depth: 1, note: "Dashboard pages, the BFF and the agent route" },
          { path: "src/sdk/", depth: 1, note: "React SDK: core, checkout/ and cancel/" },
          { path: "src/server/", depth: 1, note: "API client, auth, the agent's tools and the mock API" },
          { path: "workflows/", note: "Render Workflow tasks for subscription pauses" },
          { path: "site/", note: "This site: landing page and docs" },
          { path: "blog/", note: "Test bed that exercises every API route and SDK component" },
          { path: "web/", note: "Older marketing site" },
          { path: "render.yaml", note: "Render Blueprint for the whole stack" },
          { path: "docker-compose.yml", note: "Local Postgres and API" },
        ]}
      />

      <H2>Services</H2>
      <p>A deploy runs three services and a database. Each one has a single job.</p>
      <Table
        head={["Service", "Code", "Job"]}
        rows={[
          [
            "offersdk-api",
            <code key="c">api/</code>,
            "Stores every record, resolves access, prices checkouts with PayPal, runs cancel sessions, signs and delivers webhooks. Also hosts dashboard sign-in.",
          ],
          [
            "offer-app",
            <code key="c">offer-app/</code>,
            "The dashboard your team uses. It has no database of its own: every read and write goes to the API.",
          ],
          [
            "offersdk-workflows",
            <code key="c">workflows/</code>,
            "Pauses and resumes PayPal subscriptions as Render Workflow tasks, with retries per account.",
          ],
          ["offersdk-db", "Postgres 17", "Records as JSONB documents, plus usage counters, events, checkouts and auth tables."],
        ]}
      />
      <ArchitectureDiagram />

      <H2>How a request moves</H2>
      <H3>From your app</H3>
      <p>
        Your server calls the API with the app&apos;s secret key. The browser calls it with the publishable key, or with
        a short-lived account token for flows that act for one customer, such as cancelling. Every app route lives
        under <code>/apps/:appId</code>.
      </p>
      <H3>From the dashboard</H3>
      <p>
        The browser never holds an API key. Dashboard pages call the dashboard&apos;s own server at{" "}
        <code>/api/admin/*</code>, which checks the session, checks that the app belongs to the signed-in workspace, and
        forwards the call to the API with the admin key. Sign-in works the same way: <code>/api/auth/*</code> is proxied
        to the API, so session cookies are set on the dashboard&apos;s domain.
      </p>
      <H3>From PayPal and Render</H3>
      <p>
        PayPal posts to <code>/paypal/webhooks/:appId</code> on the API, which verifies each notification with PayPal
        before acting on it. Workflow tasks call the API&apos;s admin-only <code>/pauses</code> routes to apply and lift
        pauses.
      </p>

      <H2>Mock mode</H2>
      <p>
        The dashboard also ships an in-memory copy of the API in <code>offer-app/src/server/offer-api/mock</code>, with
        the same routes, status codes and key rules. Set <code>OFFER_API_URL=mock</code> to use it. It has no offers,
        checkouts, PayPal or cancel flows, so those sections are hidden, and its data resets when the server restarts.
      </p>
      <Callout title="The SDK isn't on npm yet.">
        It lives in <code>offer-app/src/sdk</code>. The blog imports it through tsconfig paths (<code>@offer/sdk</code>{" "}
        and <code>@offer/sdk/checkout</code>), which is the way to use it in another app today. See{" "}
        <Link href="/docs/sdk">Access and entitlements</Link>.
      </Callout>

      <H2>Tests</H2>
      <ul>
        <li>
          <strong>API.</strong> <code>bun test</code> in <code>api/</code> runs end-to-end against a real database and
          truncates every table, so point <code>DATABASE_URL</code> at a separate test database. PayPal is faked.
        </li>
        <li>
          <strong>Dashboard.</strong> <code>pnpm --filter offer-app test</code> runs Vitest, including checks that the
          mock API matches the real routes.
        </li>
        <li>
          <strong>Blog.</strong> Open <code>/console</code> in the blog, or <code>curl localhost:6770/api/rake</code>,
          to run about 100 checks over the live API and SDK.
        </li>
      </ul>
    </>
  );
}
