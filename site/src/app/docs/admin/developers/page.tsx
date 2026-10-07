import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocsHeader, H2, H3, Step, Steps, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Keys and webhooks",
  description: "Each app's API keys and what regenerating them revokes, the in-dashboard endpoint reference, webhook endpoints with delivery logs, and Zapier.",
};

export default function DevelopersAdminPage() {
  return (
    <>
      <DocsHeader
        title="Keys and webhooks"
        lead="The Developers section of each app holds its API keys, a reference you can call from the browser, and the webhook endpoints that receive its events."
      />

      <p>
        Everything here is per app, under <strong>Developers</strong> in the app nav. This page covers what you do in
        the dashboard. Authentication, request formats and event payloads are in <Link href="/docs/api">Authentication</Link>{" "}
        and <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>

      <H2>API keys</H2>
      <p>
        <strong>Developers → API keys</strong> (<code>/apps/[appId]/developers/keys</code>) shows the app&apos;s two
        keys. Your product sends one of them as <code>Authorization: Bearer &lt;key&gt;</code>.
      </p>
      <TermList
        items={[
          {
            term: "Secret key",
            children: (
              <>
                <code>key_…</code>. Full access to every route for this app. Use it from your server only, stored as{" "}
                <code>OFFER_SECRET_KEY</code>. Never ship it in browser or mobile code.
              </>
            ),
          },
          {
            term: "Public key",
            children: (
              <>
                <code>pub_…</code>, also called the publishable key. Safe in browser and mobile code, for example as{" "}
                <code>NEXT_PUBLIC_OFFER_PUBLIC_KEY</code>. It reads an account&apos;s access and the pricing cards, and
                adds usage.
              </>
            ),
          },
        ]}
      />
      <p>The page&apos;s <strong>What each key can do</strong> table spells it out:</p>
      <Table
        mono={false}
        head={["Capability", "Secret", "Public"]}
        rows={[
          ["Read an account's access (…/namespaces/:id/plan)", "Yes", "Yes"],
          ["Read pricing cards (…/plans/pricing)", "Yes", "Yes"],
          ["Read and add usage (…/namespaces/:id/usage/*)", "Yes", "Yes, for any account"],
          ["Lower usage (…/usage/:id/remove, a negative …/amount)", "Yes", "No"],
          ["Read private plan meta (…/namespaces/:id/full-plan)", "Yes", "No"],
          ["Create, update and delete accounts", "Yes", "No"],
          ["Manage plans, entitlements, add-ons and incentives", "Yes", "No"],
          ["Read analytics", "Yes", "No"],
          ["Update or delete the app, regenerate keys", "Yes", "No"],
        ]}
      />
      <Callout tone="warning" title="The public key isn't tied to one account.">
        Anyone with it can add usage to any account by id. Track anything you bill on from your server.
      </Callout>
      <p>
        The <strong>Connection</strong> section at the bottom shows the base URL your product should call, the app ID,
        and whether the dashboard is on the <strong>Hosted API</strong> or the <strong>Mock API (in-memory)</strong>.
      </p>

      <H3>Regenerate a key</H3>
      <p>
        Click <strong>Regenerate</strong> next to a key, type the app&apos;s name and confirm with{" "}
        <strong>Regenerate key</strong>. The new key is shown in full once, with a reminder to copy it now.
      </p>
      <ul>
        <li>
          The old key stops working immediately. Every caller still using it gets 401 errors until you deploy the new
          one.
        </li>
        <li>
          Regenerating the <strong>secret key</strong> also revokes every account token. Tokens (<code>act_…</code>)
          are signed with the secret key, so the cancel flow SDK and anything else using a token needs a fresh one from
          your server.
        </li>
        <li>Regenerating one key leaves the other unchanged.</li>
      </ul>

      <H2>Integration guide and API reference</H2>
      <p>Two pages help you write the integration against this app&apos;s real data:</p>
      <TermList
        items={[
          {
            term: "Integration",
            children: (
              <>
                <code>/developers</code>. Snippets filled in with this app&apos;s keys, IDs and base URL: environment
                variables, creating an account at sign-up, checking access, tracking usage, changing plans from billing
                webhooks, rendering the pricing page, a <strong>React SDK skill</strong> that a coding agent uses to copy
                the SDK into your app and wire it up, and an <strong>AI assistant context</strong> block to paste into
                any AI assistant.
              </>
            ),
          },
          {
            term: "API reference",
            children: (
              <>
                <code>/developers/api</code>. Every endpoint, filterable by group and searchable by path or method. Each
                one has a <strong>Try it</strong> panel that sends a real request from your browser with the secret or
                public key, and asks before sending a destructive one.
              </>
            ),
          },
        ]}
      />
      <Callout title="Try it changes real data.">
        Requests go to the API the dashboard is connected to. In mock mode they go to the dashboard&apos;s{" "}
        <code>/api/mock</code>, which resets on restart. The full list of routes is also in the{" "}
        <Link href="/docs/api/reference">Endpoint reference</Link>.
      </Callout>

      <H2>Webhook endpoints</H2>
      <p>
        <strong>Developers → Webhooks</strong> (<code>/apps/[appId]/developers/webhooks</code>) sends signed HTTP
        requests to your endpoints when something happens in the app, such as <code>account.plan_changed</code>,{" "}
        <code>usage.limit_reached</code> or <code>cancel_flow.cancelled</code>. It has three tabs:
      </p>
      <TermList
        items={[
          {
            term: "Endpoints",
            children: "Each endpoint with its events, status, success rate over 7 days and last delivery.",
          },
          {
            term: "Event log",
            children: "Every event in the app from the last 30 days, whether or not an endpoint received it. Filter by event type.",
          },
          { term: "Events & signing", children: "Every event type, and how to verify signatures." },
        ]}
      />

      <H3>Add an endpoint</H3>
      <Steps>
        <Step title="Enter the URL and events">
          <p>
            Click <strong>Add endpoint</strong>. Enter the <strong>Endpoint URL</strong> (plain <code>http</code> works
            for testing, use <code>https</code> in production) and an optional <strong>Description</strong>. Under{" "}
            <strong>Events to send</strong>, either turn on <strong>All events</strong>, which includes event types
            added later, or tick events by resource.
          </p>
        </Step>
        <Step title="Store the signing secret">
          <p>
            Open the endpoint and copy its <strong>Signing secret</strong> (<code>whsec_…</code>). Store it on your
            server as <code>OFFER_WEBHOOK_SECRET</code> and verify the <code>webhook-signature</code> header on every
            request. <Link href="/docs/api/webhooks">Webhooks</Link> shows how.
          </p>
        </Step>
        <Step title="Send a test">
          <p>
            Under <strong>Send a test event</strong>, pick an event type and click{" "}
            <strong>Send sample payload</strong>. The payload is marked <code>&quot;test&quot;: true</code>, and a
            toast shows whether your endpoint accepted it. The delivery shows up in the log.
          </p>
        </Step>
      </Steps>

      <H3>The endpoint page</H3>
      <p>
        Each endpoint has a page at <code>/apps/[appId]/developers/webhooks/[webhookId]</code>. The top shows{" "}
        <strong>Delivered</strong>, <strong>Failed</strong> and <strong>Success rate</strong> for the last 7 days, and{" "}
        <strong>Retrying</strong> for deliveries pending now.
      </p>
      <TermList
        items={[
          {
            term: "Deliveries",
            children: (
              <>
                The delivery log, filterable by <strong>Delivered</strong>, <strong>Retrying</strong> and{" "}
                <strong>Failed</strong>. Each row has the event, status, response code, attempts and time. Expand one
                to see the request body and your server&apos;s response, when the next retry is due, and a{" "}
                <strong>Retry now</strong> button for anything that hasn&apos;t succeeded.
              </>
            ),
          },
          { term: "Events", children: "The events this endpoint receives, with an Edit events button." },
          {
            term: "Signing secret",
            children: (
              <>
                <strong>Roll</strong> issues a new secret. The old one stops working immediately, so deliveries fail
                verification until you update <code>OFFER_WEBHOOK_SECRET</code>.
              </>
            ),
          },
        ]}
      />
      <p>
        The <strong>…</strong> menu has <strong>Copy URL</strong>, <strong>Pause endpoint</strong> (or{" "}
        <strong>Resume endpoint</strong>) and <strong>Delete endpoint</strong>. Deleting drops pending retries and the
        delivery log.
      </p>
      <Callout tone="warning" title="Paused endpoints miss events.">
        Events that happen while an endpoint is paused are never delivered later. The API also turns an endpoint off
        by itself when it answers <code>410 Gone</code>. The page then says <strong>This endpoint was turned off</strong>{" "}
        until you click <strong>Resume</strong>.
      </Callout>
      <p>
        Retry timing and the payload format are in <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>

      <H2>Connect Zapier</H2>
      <p>
        Zapier receives the same signed webhooks, so you can send Offer events to other apps without writing a server.
        Click <strong>Connect Zapier</strong> on the Webhooks page, or one of the ready-made recipes under{" "}
        <strong>Automate with Zapier</strong>, such as “Post to Slack when an account changes plan”.
      </p>
      <Steps>
        <Step title="Create a Catch Hook in Zapier">
          <p>
            In Zapier, start a Zap with <strong>Webhooks by Zapier</strong> → <strong>Catch Hook</strong>. Leave “Pick
            off a child key” empty and copy the webhook URL Zapier shows you.
          </p>
        </Step>
        <Step title="Paste the URL and pick the trigger">
          <p>
            Paste the Catch Hook URL into the dialog and choose the event that triggers the Zap. The dashboard saves it
            as a webhook endpoint marked <strong>Zapier</strong>, subscribed to that one event, and sends a sample
            event right away.
          </p>
        </Step>
        <Step title="Map the fields">
          <p>
            Back in Zapier, click <strong>Test trigger</strong> to pull in the sample and map its fields. If the sample
            didn&apos;t arrive, check the URL and send another from the endpoint page.
          </p>
        </Step>
      </Steps>
      <p>
        Zapier doesn&apos;t check signatures, so you can ignore the signing secret for a Zapier endpoint. Turning the
        Zap off or deleting it makes Zapier answer <code>410 Gone</code>, which turns the endpoint off. Turn the Zap
        back on, then resume the endpoint. More in <Link href="/docs/sponsors/zapier">Zapier</Link>.
      </p>
    </>
  );
}
