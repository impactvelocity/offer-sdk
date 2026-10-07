import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, Step, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Zapier",
  description: "Send Offer SDK webhook events to other apps through a Zapier Catch Hook, with the same signing, retries and delivery log.",
};

const payload = `{
  "id": "evt_…",
  "type": "account.plan_changed",
  "created_at": "2026-10-06T12:00:00.000Z",
  "app_id": "app_…",
  "data": { … }
}`;

export default function ZapierDocsPage() {
  return (
    <>
      <DocsHeader
        title="Zapier"
        lead="Connect a Zap to an Offer event and act on it in Slack, a CRM, email or any other app Zapier supports, without writing a receiver."
      />

      <p>
        A Zapier connection is a regular Offer webhook endpoint whose URL is a Zapier Catch Hook. Events are signed,
        retried and logged like any other endpoint. The difference is the setup: the dashboard creates the
        endpoint for you and sends a sample event so Zapier can learn its fields.
      </p>

      <H2>Recipes</H2>
      <p>
        The Webhooks page has four starting points. Each one opens the connect dialog with its event already picked.
      </p>
      <Table
        mono={false}
        head={["Recipe", "Event"]}
        rows={[
          ["Post to Slack when an account changes plan", <code key="e">account.plan_changed</code>],
          ["Email a customer who hits a usage limit", <code key="e">usage.limit_reached</code>],
          ["Add new accounts to your CRM", <code key="e">account.created</code>],
          ["Alert sales when usage nears a limit", <code key="e">usage.limit_warning</code>],
        ]}
      />
      <p>
        You can pick any other event in the dialog. <Link href="/docs/api/webhooks">Webhooks</Link> lists them all with
        their payloads.
      </p>

      <H2>Connect a Zap</H2>
      <Steps>
        <Step title="Start a Zap with a Catch Hook">
          <p>
            In Zapier, create a Zap whose trigger is <strong>Webhooks by Zapier</strong> with the{" "}
            <strong>Catch Hook</strong> event. Leave <strong>Pick off a child key</strong> empty, then copy the webhook
            URL Zapier shows you. It looks like <code>https://hooks.zapier.com/hooks/catch/123456/abcdef/</code>.
          </p>
        </Step>
        <Step title="Open the connect dialog">
          <p>
            In the dashboard, open the app and go to <strong>Developers → Webhooks</strong>. Press{" "}
            <strong>Connect Zapier</strong>, or one of the recipes.
          </p>
        </Step>
        <Step title="Paste the URL and pick the event">
          <p>
            Paste the Catch Hook URL and choose the event that should trigger the Zap. If the host isn&apos;t{" "}
            <code>zapier.com</code>, the dialog warns you, and the endpoint still works as a regular webhook.
          </p>
        </Step>
        <Step title="Connect and send the sample">
          <p>
            Press <strong>Connect and send sample</strong>. The dashboard creates the endpoint, then sends a test event
            of the type you picked. Back in Zapier, press <strong>Test trigger</strong> to pull it in and map its fields
            to the next step.
          </p>
          <p>
            If the sample fails, the endpoint is still saved. Check the URL, then send another test from the
            endpoint&apos;s page.
          </p>
        </Step>
      </Steps>

      <H2>What Zapier receives</H2>
      <p>
        Every delivery is a <code>POST</code> with a JSON body. In Zapier, the fields appear under these names, with
        everything about the account or record inside <code>data</code>. Samples sent from the dashboard also carry{" "}
        <code>&quot;test&quot;: true</code>.
      </p>
      <Code title="Delivery body" lang="json" code={payload} />
      <p>
        Requests carry the Standard Webhooks headers <code>webhook-id</code>, <code>webhook-timestamp</code> and{" "}
        <code>webhook-signature</code>. A Catch Hook doesn&apos;t check them, but they&apos;re there if you later move
        the endpoint to your own server.
      </p>

      <H2>Retries, the log and 410 Gone</H2>
      <p>A Zapier endpoint goes through the same delivery worker as every other endpoint:</p>
      <ul>
        <li>
          A delivery succeeds on any <code>2xx</code> within 10 seconds. A redirect counts as a failure.
        </li>
        <li>
          Failed deliveries are retried after 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours and 24 hours: 7
          attempts in total, then the delivery is marked failed.
        </li>
        <li>
          Every attempt is in the endpoint&apos;s delivery log with its status code and the start of the response body.
          You can retry a delivery by hand from there.
        </li>
        <li>
          If the URL answers <code>410 Gone</code> (how Zapier and other services say a hook should stop receiving),
          the delivery fails at once with no retries, and the endpoint is disabled with the reason{" "}
          <code>Endpoint returned 410 Gone</code>. Re-enable it once the Zap is live again.
        </li>
      </ul>

      <H2>Create one with the API</H2>
      <p>
        The dialog calls the webhooks API with <code>source: &quot;zapier&quot;</code>. The source only affects the
        dashboard, which shows the Zapier mark and Zapier-specific help on the endpoint. You can subscribe one endpoint to several events
        this way, and an app can have up to 25 endpoints.
      </p>
      <Code
        title="Create a Zapier endpoint"
        lang="bash"
        code={`
curl -X POST https://your-api.example.com/apps/$APP_ID/webhooks \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    "events": ["account.plan_changed"],
    "source": "zapier",
    "description": "Zapier · Plan changed"
  }'

# Send a sample so Zapier's "Test trigger" can see the fields
curl -X POST https://your-api.example.com/apps/$APP_ID/webhooks/$WEBHOOK_ID/test \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "type": "account.plan_changed" }'`}
      />
      <Callout title="Nothing to deploy.">
        Zapier needs no environment variables or keys on the Offer side. If the API can send webhooks, it can send them
        to Zapier.
      </Callout>
      <p>
        For managing endpoints and reading the delivery log in the dashboard, see{" "}
        <Link href="/docs/admin/developers">Keys and webhooks</Link>.
      </p>
    </>
  );
}
