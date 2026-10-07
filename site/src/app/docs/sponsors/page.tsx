import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardGrid, DocsHeader, H2, Table } from "@/components/docs/prose";
import { DEVPOST_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "How sponsors are used",
  description: "Where PayPal, Render, Zapier and Postman sit in Offer SDK, and what each one needs from you.",
};

export default function SponsorsPage() {
  return (
    <>
      <DocsHeader
        title="How sponsors are used"
        lead="Offer SDK was built for the PayPal AI Hackathon. This page lists each sponsor tool it uses, what that tool does in the product, and what you configure to turn it on."
      />

      <p>
        Offer SDK is an entry in the <a href={DEVPOST_URL}>PayPal AI Hackathon</a>. It uses PayPal for every payment,
        Render to host the stack and run pauses, Zapier to carry webhooks to other apps, and Postman for a request
        collection. The AI side of the product is covered in <Link href="/docs/ai">AI features</Link>.
      </p>

      <H2>At a glance</H2>
      <Table
        mono={false}
        head={["Tool", "What it does in Offer SDK", "What you configure", "Page"]}
        rows={[
          [
            "PayPal",
            "Takes every payment: subscriptions and one-time orders at checkout, plan changes, save-offer discounts, cancellations and pauses. Its webhooks keep accounts in sync with billing.",
            <>
              A PayPal REST app per Offer app (client ID and secret, sandbox or live), entered in the dashboard. On
              Render, PayPal webhooks register themselves.
            </>,
            <Link key="l" href="/docs/sponsors/paypal">
              PayPal
            </Link>,
          ],
          [
            "Render",
            "Hosts the API, dashboard, Workflows service and Postgres from one Blueprint, with private networking between them. Runs subscription pauses as Workflow tasks with retries.",
            <>
              Deploy <code>render.yaml</code>. Add <code>RENDER_API_KEY</code> on the API to run pauses as Workflow
              tasks.
            </>,
            <Link key="l" href="/docs/sponsors/render">
              Render
            </Link>,
          ],
          [
            "Zapier",
            "Carries Offer webhook events to other apps through a Zap, with no code on your side.",
            "A Catch Hook URL from a Zap, pasted into Developers → Webhooks → Connect Zapier.",
            <Link key="l" href="/docs/sponsors/zapier">
              Zapier
            </Link>,
          ],
          [
            "Postman",
            "A collection with a request for every API route, grouped by resource, with a Quickstart folder that sets up an app and saves its keys as it runs.",
            <>
              Import the collection. For a deployed API, also import the environment and set <code>baseUrl</code> and{" "}
              <code>adminKey</code>.
            </>,
            <Link key="l" href="/docs/sponsors/postman">
              Postman
            </Link>,
          ],
        ]}
      />

      <H2>PayPal</H2>
      <p>
        PayPal is the only payment provider. Each Offer app connects its own PayPal REST app, so buyers pay you directly
        and the credentials never leave your API. When a buyer checks out, the API prices the selection from the stored
        offer and creates a PayPal subscription for monthly and yearly prices, or a PayPal order for one-time prices.
        Later changes to a running subscription (a new plan, a save-offer discount, a pause, a cancellation) are made
        through PayPal&apos;s subscription API, and PayPal&apos;s webhooks bring renewals and cancellations back to the
        account. <Link href="/docs/sponsors/paypal">PayPal</Link> covers the setup, every PayPal call, and how to test in
        sandbox.
      </p>

      <H2>Render</H2>
      <p>
        The repo ships a Render Blueprint (<code>render.yaml</code>) that creates the whole stack: the API as a Docker
        web service, the dashboard as a Node web service, a Workflows service, and a Postgres database that only accepts
        internal connections. The dashboard reaches the API over Render&apos;s private network. When a customer accepts
        a pause in a cancel flow, the API starts a Render Workflow task that suspends billing in PayPal, with its own
        retries and run log. <Link href="/docs/sponsors/render">Render</Link> explains the services and the pause
        tasks, and <Link href="/docs/deploy">Deploy on Render</Link> walks through a deploy.
      </p>

      <H2>Zapier</H2>
      <p>
        Offer SDK sends signed webhooks for account, usage, plan, subscription and cancel-flow events. The dashboard has a
        Zapier connect dialog that turns a Zap&apos;s Catch Hook URL into a webhook endpoint and sends a sample event so
        Zapier can map its fields. It&apos;s an ordinary endpoint underneath, with the same signature, retries and
        delivery log. <Link href="/docs/sponsors/zapier">Zapier</Link> has the recipes and the setup steps.
      </p>

      <H2>Postman</H2>
      <p>
        The repo ships a Postman collection that covers every route the API serves. Requests send
        the right key for their route: the secret key by default, the publishable key for browser routes, an account
        token for cancel sessions and the admin key for admin routes. Run the Quickstart folder and it creates an app,
        saves its keys and ids into collection variables, and builds a small catalog, so every other request works
        without copying values by hand. A test in the API fails when a route has no request, so the collection
        can&apos;t fall behind the code. <Link href="/docs/sponsors/postman">Postman</Link> has the download and the
        steps.
      </p>

      <H2>Sponsor pages</H2>
      <CardGrid>
        <Card href="/docs/sponsors/paypal" title="PayPal">
          Checkout, subscriptions, plan changes and webhooks.
        </Card>
        <Card href="/docs/sponsors/render" title="Render">
          The Blueprint, private networking and Workflows for pauses.
        </Card>
        <Card href="/docs/sponsors/zapier" title="Zapier">
          Send Offer events to other apps without writing code.
        </Card>
        <Card href="/docs/sponsors/postman" title="Postman">
          A collection for every API route, with a runnable quickstart.
        </Card>
      </CardGrid>
    </>
  );
}
