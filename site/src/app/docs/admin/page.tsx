import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Step, Steps, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Dashboard tour",
  description: "Sign-in, workspaces, apps, the dashboard layout, every page in the app nav, the demo workspace and mock mode.",
};

export default function DashboardTourPage() {
  return (
    <>
      <DocsHeader
        title="Dashboard tour"
        lead="The dashboard (offer-app) is where your team edits the catalog, builds offers and cancel flows, reads usage and manages keys and webhooks. This page shows where each of those lives."
      />

      <p>
        The dashboard is a Next.js app that talks to the Offer API through its own backend. Your browser calls{" "}
        <code>/api/admin/*</code> on the dashboard, which checks your session and forwards the request to the API with
        the admin key. It only forwards <code>/apps/:appId/*</code> when that app belongs to your active workspace.
      </p>

      <H2>Setup and sign in</H2>
      <p>
        Each install has one admin account, using email and password through{" "}
        <a href="https://better-auth.com">better-auth</a>. The first time you open a fresh install, every page sends
        you to <code>/setup</code> to create it, then to <code>/onboarding</code> to name your first workspace. Once the
        admin exists, sign-up closes (the API returns 403 for any other email) and <code>/setup</code> redirects to{" "}
        <code>/sign-in</code>. The shared demo login doesn&apos;t count as the admin.
      </p>
      <p>
        With the hosted API, better-auth runs inside the API on Postgres and the dashboard proxies{" "}
        <code>/api/auth/*</code> to it, so session cookies stay on the dashboard&apos;s domain. In mock mode it runs
        inside the dashboard process with an in-memory store.
      </p>

      <H2>Workspaces</H2>
      <p>
        A workspace holds your apps, and the admin owns every workspace they create. Team members aren&apos;t
        available yet, so there&apos;s no members page or invitations.
      </p>
      <p>
        Workspace settings live under <code>/settings</code>: <strong>General</strong> (name, slug, ID, delete the
        workspace) and <strong>Profile</strong> (your name, appearance, password and sessions). To switch workspaces or create another one, open the logo menu at the top of the rail and choose{" "}
        <strong>Switch workspace</strong>.
      </p>

      <H2>Apps</H2>
      <p>
        An app is one product you sell. Each app has its own catalog, customer accounts, API keys, offers, cancel flow
        and webhooks. Create one from <strong>All apps</strong> (<code>/apps</code>) or the <strong>+</strong> tile in
        the rail. The <strong>Create app</strong> dialog asks for a name and what to start with:
      </p>
      <TermList
        items={[
          { term: "Blank app", children: "An empty catalog." },
          { term: "SaaS sample", children: "Free, Starter, Pro and Enterprise plans with usage limits, add-ons and promos." },
          { term: "Course sample", children: "One-time access tiers for an online course or community." },
        ]}
      />
      <p>
        <strong>App settings</strong> (<code>/apps/[appId]/settings</code>) holds the app&apos;s name and ID, the{" "}
        <Link href="/docs/admin/offers">Payments</Link> section for PayPal and your checkout page, and{" "}
        <strong>Delete app</strong>, which removes the app and everything in it after you type its name.
      </p>

      <H2>The layout</H2>
      <p>The dashboard has three columns.</p>
      <TermList
        items={[
          {
            term: "App rail",
            children: (
              <>
                The narrow column on the left. The logo opens the workspace menu (<strong>All apps</strong>,{" "}
                <strong>New app</strong>, <strong>Workspace settings</strong>,{" "}
                <strong>Switch workspace</strong>). Below it is one tile per app, then a light/dark toggle, settings
                and your account menu (<strong>Profile</strong>, <strong>Theme</strong>, <strong>Sign out</strong>).
              </>
            ),
          },
          {
            term: "Nav panel",
            children:
              "The pages of the app you're in, or the workspace pages when you're on /apps or /settings. It starts with the Quick actions button.",
          },
          { term: "Page", children: "The page itself, with a header and toolbar at the top. Record pages have a details panel on the right." },
        ]}
      />
      <p>On narrow screens the rail and nav panel fold into a drawer that you open from the page header.</p>

      <H2>App navigation</H2>
      <p>
        Items are listed in the order the nav panel shows them. Routes are relative to <code>/apps/[appId]</code>,
        so <code>/</code> is the app&apos;s Overview.
      </p>
      <Table
        head={["Route", "Nav item", "What you do there"]}
        rows={[
          [
            "/",
            "Overview",
            "A setup checklist for new apps, then key numbers, usage over the last 30 days, accounts by plan, recent activity and top accounts.",
          ],
          ["/analytics", "Analytics", "Usage over time per entitlement, top accounts and saved reports."],
          [
            "/agent",
            "Agent",
            <>
              Chat with Claude about your catalog and approve the changes it proposes. See{" "}
              <Link href="/docs/admin/agent">Agent and MCP</Link>.
            </>,
          ],
          [
            "/offers",
            "Offers",
            <>
              Build offers, publish them and share their checkout links. See <Link href="/docs/admin/offers">Offers</Link>.
            </>,
          ],
          [
            "/cancel-flow",
            "Cancel flow",
            <>
              Edit the questions and save offers your cancel button shows. See{" "}
              <Link href="/docs/admin/cancel-flows">Cancel flows</Link>.
            </>,
          ],
          [
            "/plans",
            "Catalog → Plans",
            <>
              Plans with their limits, add-ons, pricing card and metadata. See <Link href="/docs/admin/catalog">Catalog</Link>.
            </>,
          ],
          ["/entitlements", "Catalog → Entitlements", "The features and limits you gate, as usage limits or feature flags."],
          ["/addons", "Catalog → Add-ons", "Optional extras that plans and incentives include."],
          ["/incentives", "Catalog → Incentives", "Overrides you apply to single accounts: higher limits, extra features, add-ons."],
          [
            "/accounts",
            "Customers → Accounts",
            "Your customers. Search, filter by plan or incentive, change an account's plan and see its live access and usage.",
          ],
          [
            "/developers",
            "Developers → Integration",
            "Copy-paste snippets with this app's real keys and IDs.",
          ],
          [
            "/developers/api",
            "Developers → API reference",
            "Every endpoint, with a Try it panel that sends real requests.",
          ],
          [
            "/developers/mcp",
            "Developers → MCP server",
            <>
              Connect Claude, Cursor and other assistants to the app, choose what they can do, and see every call.
              See <Link href="/docs/api/mcp">MCP server</Link>.
            </>,
          ],
          [
            "/developers/keys",
            "Developers → API keys",
            <>
              The secret and public keys, and regenerating them. See{" "}
              <Link href="/docs/admin/developers">Keys and webhooks</Link>.
            </>,
          ],
          [
            "/developers/webhooks",
            "Developers → Webhooks",
            "Webhook endpoints, delivery logs, the event log and Zapier.",
          ],
          ["/settings", "App settings", "Name and ID, Payments (PayPal and your checkout page), and deleting the app."],
        ]}
      />
      <p>
        <strong>Offers</strong> and <strong>Cancel flow</strong> only appear when the API supports them, so they are
        hidden in mock mode.
      </p>

      <H2>Analytics</H2>
      <p>
        <strong>Analytics</strong> charts the usage your app reports through the usage endpoints. The toolbar picks a
        period (<strong>7D</strong>, <strong>30D</strong>, <strong>60D</strong>, <strong>6M</strong>,{" "}
        <strong>1Y</strong> or <strong>All</strong>) and which entitlements to include. The page shows totals,{" "}
        <strong>Usage over time</strong> (by amount or by number of calls), <strong>By entitlement</strong> (select rows
        to focus the page on them) and <strong>Top accounts</strong>.
      </p>
      <p>
        <strong>Save report</strong> stores the selected entitlements and period under a name. Reports are saved on the
        app, so everyone in the workspace sees them. The reports menu applies, updates, renames or deletes them. Each
        account page has its own <strong>Analytics</strong> tab with the same numbers for one account.
      </p>
      <p>
        These views read <code>GET /apps/:appId/analytics/timeseries</code>, <code>…/analytics/events</code> and{" "}
        <code>…/analytics/reports</code>. If the API you point at doesn&apos;t have them, the dashboard hides those
        parts instead of failing.
      </p>

      <H2>Quick actions</H2>
      <p>
        Press <code>⌘K</code> (<code>Ctrl+K</code> on Windows and Linux) or click <strong>Quick actions</strong> at the
        top of the nav panel. With no query it lists:
      </p>
      <ul>
        <li>
          <strong>Navigate</strong>: every page of the current app.
        </li>
        <li>
          <strong>Create</strong>: <strong>New plan</strong>, <strong>New entitlement</strong>,{" "}
          <strong>New add-on</strong>, <strong>New incentive</strong>, <strong>New offer</strong> and{" "}
          <strong>New account</strong>.
        </li>
        <li>
          <strong>Workspace</strong>: <strong>All apps</strong>, <strong>New app</strong>,{" "}
          <strong>Workspace settings</strong> and the theme.
        </li>
      </ul>
      <p>
        Typing also searches the current app&apos;s plans, incentives and entitlements by name or ID, and its accounts
        by name or ID. Matching records are listed first.
      </p>

      <H2>The demo workspace</H2>
      <p>
        The demo workspace is a shared login with sample data, for showing the dashboard without setting anything up.
        It signs in as <code>demo@offersdk.dev</code> (password <code>demo-password</code>) to a workspace called Acme
        Labs with two apps: Notebook AI (a SaaS) and Course Hub (an online course). Both have catalogs, accounts that
        signed up over several months, usage history and saved reports. Notebook AI also has a draft offer and a live
        cancel flow.
      </p>
      <Steps>
        <Step title="Start the API and the dashboard">
          <p>
            From the repo root, <code>pnpm dev:api</code> starts Postgres and the API in Docker, and{" "}
            <code>pnpm dev:app</code> starts the dashboard on <code>http://localhost:6768</code>.
          </p>
        </Step>
        <Step title="Open it">
          <p>
            Click <strong>Explore the demo workspace</strong> on the sign-in page. The button shows when{" "}
            <code>DEMO_ENABLED=true</code> is set on the dashboard. It defaults to on under <code>next dev</code>. The
            first click builds the demo workspace, which takes a few seconds. It&apos;s built again whenever the
            workspace has no apps left.
          </p>
        </Step>
        <Step title="Reset it">
          <Code
            lang="bash"
            code={`# rebuild the demo apps after visitors have changed them
pnpm seed:demo --reset
# against a deployed dashboard
APP_URL=https://your-dashboard.example.com pnpm seed:demo --reset`}
          />
          <p>
            The script signs in and calls the dashboard like a browser would, so it only needs the dashboard&apos;s URL
            (<code>APP_URL</code>, default <code>http://localhost:6768</code>). Without <code>--reset</code>, it builds
            the demo ahead of the first click and leaves an existing one alone.
          </p>
        </Step>
      </Steps>
      <H3>What the demo account can&apos;t do</H3>
      <p>
        Many visitors share the demo login, so the API stops it from changing its profile, email or password,
        deleting itself, signing out other sessions, editing, deleting or leaving the workspace, and inviting,
        removing or changing the role of members. Those calls fail with “The demo workspace is read-only. Sign in with your admin
        account to make changes.” Everything inside the apps stays editable, which is why <code>--reset</code> exists.
      </p>
      <Callout title="The guard lives in the hosted API.">
        It is part of the API&apos;s better-auth setup. In mock mode the dashboard runs its own in-memory auth, which
        doesn&apos;t block these calls.
      </Callout>

      <H2>Mock mode</H2>
      <p>
        To run the dashboard without the API or a database, set this in <code>offer-app/.env.local</code>:
      </p>
      <Code lang="bash" title="offer-app/.env.local" code="OFFER_API_URL=mock" />
      <p>
        The dashboard then serves an in-memory copy of the Offer API with the same routes, status codes and key
        permissions, and runs better-auth in-process. Everything resets when the dev server restarts.
      </p>
      <ul>
        <li>
          The demo account is created automatically with its two sample apps, and{" "}
          <strong>Explore the demo workspace</strong> always shows.
        </li>
        <li>
          The mock is also served at <code>/api/mock/*</code> and accepts each app&apos;s real secret and public keys,
          so snippets, curl and the API reference&apos;s <strong>Try it</strong> work locally. The{" "}
          <strong>API keys</strong> page labels the connection <strong>Mock API (in-memory)</strong>.
        </li>
        <li>
          The mock doesn&apos;t sell anything or run cancel flows. The <strong>Offers</strong> and{" "}
          <strong>Cancel flow</strong> nav items and the <strong>Payments</strong> settings are hidden.
        </li>
      </ul>
      <p>
        Under <code>next dev</code> with no <code>OFFER_API_URL</code>, the dashboard connects to the API at{" "}
        <code>http://localhost:6767</code> with the development admin key. Builds and tests use the mock unless{" "}
        <code>OFFER_API_URL</code> is set. The full list of variables is in{" "}
        <Link href="/docs/deploy/environment">Environment variables</Link>.
      </p>
    </>
  );
}
