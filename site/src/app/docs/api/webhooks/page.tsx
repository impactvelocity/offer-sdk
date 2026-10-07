import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Callout, Code, DocsHeader, H2, H3, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Webhooks",
  description: "The events the Offer API sends, how each request is signed, and how failed deliveries are retried.",
};

type EventRow = { type: string; when: ReactNode; data: ReactNode };

const c = (text: string) => <code>{text}</code>;

const CATALOG: { title: string; events: EventRow[] }[] = [
  {
    title: "Accounts",
    events: [
      { type: "account.created", when: "An account was created, through the API or by a checkout from a buyer without one.", data: c("object") },
      { type: "account.updated", when: "Any change to an account.", data: <>{c("object")}, {c("previous")}</> },
      { type: "account.deleted", when: "An account was deleted.", data: c("object") },
      { type: "account.plan_changed", when: "The account moved to a different plan.", data: <>{c("object")}, {c("previous.plan")}</> },
      { type: "account.incentive_applied", when: "An incentive was applied, or replaced the previous one.", data: <>{c("object")}, {c("previous.incentive")}</> },
      { type: "account.incentive_removed", when: "The account's incentive was removed.", data: <>{c("object")}, {c("previous.incentive")}</> },
    ],
  },
  {
    title: "Usage",
    events: [
      { type: "usage.limit_warning", when: "An account crossed 80% of a usage limit.", data: c("object") },
      { type: "usage.limit_reached", when: "An account used up a limit. Its can is now false.", data: c("object") },
    ],
  },
  {
    title: "Plans",
    events: [
      { type: "plan.created", when: "A plan was added.", data: c("object") },
      { type: "plan.updated", when: "A plan's details, limits, add-ons, meta or pricing changed.", data: <>{c("object")}, {c("previous")}</> },
      { type: "plan.deleted", when: "A plan was deleted.", data: c("object") },
    ],
  },
  {
    title: "Incentives",
    events: [
      { type: "incentive.created", when: "An incentive was created.", data: c("object") },
      { type: "incentive.updated", when: "An incentive's details, overrides or add-ons changed.", data: <>{c("object")}, {c("previous")}</> },
      { type: "incentive.deleted", when: "An incentive was deleted.", data: c("object") },
    ],
  },
  {
    title: "Billing",
    events: [
      { type: "checkout.completed", when: "A buyer paid through PayPal and the purchase was applied.", data: <>{c("object")} (the checkout), {c("account")}</> },
      { type: "account.addon_granted", when: "An account got an add-on of its own, for example from an order bump.", data: <>{c("object")}, {c("addon_id")}, {c("source")}</> },
      { type: "subscription.renewed", when: "PayPal charged a renewal.", data: c("object") },
      { type: "subscription.cancelled", when: "A PayPal subscription was cancelled or expired. The account moved to the free plan, if there is one.", data: <>{c("object")}, {c("previous.plan")}</> },
      { type: "subscription.paused", when: "Billing was suspended for a few months, usually from a cancel flow.", data: <>{c("object")}, {c("previous.plan")}</> },
      { type: "subscription.resumed", when: "A paused subscription started billing again and the account is back on its plan.", data: <>{c("object")}, {c("previous.plan")}</> },
    ],
  },
  {
    title: "Retention",
    events: [
      { type: "cancel_flow.saved", when: "A customer in a cancel flow accepted a save offer.", data: <>{c("object")} (the session), {c("account")}</> },
      {
        type: "cancel_flow.cancelled",
        when: "A customer finished a cancel flow and cancelled. PayPal subscriptions are already cancelled; cancel other billing here.",
        data: <>{c("object")} (the session), {c("account")}</>,
      },
    ],
  },
];

const createEndpoint = `curl -X POST http://localhost:6767/apps/$APP_ID/webhooks \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://blog.example.com/api/webhooks",
    "events": ["checkout.completed", "cancel_flow.cancelled"]
  }'`;

const endpointResponse = `{
  "id": "whk_QwErTyNiOpAsDfGh",
  "app_id": "app_AbCdEf",
  "url": "https://blog.example.com/api/webhooks",
  "description": null,
  "events": ["checkout.completed", "cancel_flow.cancelled"],
  "enabled": true,
  "source": "custom",
  "secret": "whsec_…",
  "disabled_reason": null,
  "created_at": "2026-10-01T12:00:00.000Z",
  "updated_at": "2026-10-01T12:00:00.000Z",
  "stats": { "total": 0, "succeeded": 0, "failed": 0, "pending": 0, "last_delivery_at": null, "last_status": null, "last_response_status": null }
}`;

const request = `POST /api/webhooks HTTP/1.1
Content-Type: application/json
User-Agent: OfferSDK-Webhooks/1.0
webhook-id: evt_kTnBwQzXyPcRfLmHsDaGqEoJ
webhook-timestamp: 1790856000
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=

{
  "id": "evt_kTnBwQzXyPcRfLmHsDaGqEoJ",
  "type": "account.plan_changed",
  "created_at": "2026-10-01T12:00:00.000Z",
  "app_id": "app_AbCdEf",
  "data": {
    "object": { "id": "user_42", "app_id": "app_AbCdEf", "name": "Ada", "plan": "pro", "incentive": null, "created_at": "2026-09-01T09:30:00.000Z" },
    "previous": { "plan": "free" }
  }
}`;

const usageData = `{
  "object": {
    "account_id": "user_42",
    "entitlement_id": "posts",
    "entitlement_name": "Posts",
    "usage": 40,
    "max": 50,
    "left": 10,
    "percent": 80
  }
}`;

const verifyLibrary = `// app/api/webhooks/route.ts
import { Webhook, WebhookVerificationError } from "standardwebhooks";

const SECRET = process.env.OFFER_WEBHOOK_SECRET!; // "whsec_…"

export async function POST(req: Request) {
  const body = await req.text(); // the raw body, before any JSON parsing
  const headers = Object.fromEntries(req.headers);

  let event: { id: string; type: string; data: Record<string, unknown> };
  try {
    event = new Webhook(SECRET.slice("whsec_".length)).verify(body, headers) as typeof event;
  } catch (err) {
    if (err instanceof WebhookVerificationError) return Response.json({ error: err.message }, { status: 401 });
    throw err;
  }

  // Retries reuse the event id, so skip ids you've already handled.
  if (await alreadyHandled(event.id)) return Response.json({ received: true });

  switch (event.type) {
    case "checkout.completed":
      // link data.account.id to your user, send a receipt…
      break;
    case "cancel_flow.cancelled":
      // stop billing you run outside PayPal…
      break;
  }
  return Response.json({ received: true });
}`;

const verifyManual = `import { createHmac, timingSafeEqual } from "node:crypto";

/** Standard Webhooks verification without a library. */
export function verifyOfferWebhook(secret: string, headers: Headers, body: string, toleranceSeconds = 300): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  // Reject old requests, so a captured one can't be replayed later.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(\`\${id}.\${timestamp}.\${body}\`).digest("base64"));

  // The header can hold several space-separated "v1,<signature>" entries.
  return signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    const actual = Buffer.from(signature ?? "");
    return version === "v1" && actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}`;

const testSend = `curl -X POST http://localhost:6767/apps/$APP_ID/webhooks/$WEBHOOK_ID/test \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "type": "checkout.completed" }'`;

const delivery = `{
  "id": "whd_pLmKjHgFdSaQwErTyIoPZxCb",
  "endpoint_id": "whk_QwErTyNiOpAsDfGh",
  "event_id": "evt_kTnBwQzXyPcRfLmHsDaGqEoJ",
  "event_type": "account.plan_changed",
  "status": "pending",
  "attempts": 2,
  "next_attempt_at": "2026-10-01T12:06:00.000Z",
  "last_attempt_at": "2026-10-01T12:01:00.000Z",
  "response_status": 500,
  "response_body": "Internal Server Error",
  "error": "HTTP 500",
  "duration_ms": 182,
  "test": false,
  "created_at": "2026-10-01T12:00:00.000Z",
  "payload": { "id": "evt_kTnBwQzXyPcRfLmHsDaGqEoJ", "type": "account.plan_changed", "…": "…" }
}`;

export default function ApiWebhooksPage() {
  return (
    <>
      <DocsHeader
        title="Webhooks"
        lead="The API sends a signed JSON POST to your endpoints when something changes: an account's plan, a usage limit, a payment, a cancellation."
      />

      <p>
        Webhooks keep your app in step with changes made outside it: a teammate editing a plan in the dashboard, a
        PayPal renewal, a customer saved by a cancel flow. Add endpoints in the dashboard under{" "}
        <Link href="/docs/admin/developers">Keys and webhooks</Link>, or through the API. To send events to other apps
        without code, see <Link href="/docs/sponsors/zapier">Zapier</Link>.
      </p>

      <H2>Add an endpoint</H2>
      <p>
        Each endpoint has a URL, a list of event types (or <code>[&quot;*&quot;]</code> for every type, including ones
        added later) and its own signing secret. An app can have up to 25 endpoints.
      </p>
      <Code lang="bash" code={createEndpoint} />
      <Code title="201 Created" lang="json" code={endpointResponse} />
      <p>
        Save the <code>secret</code> where your receiver can read it. URLs must point to a public address: localhost,
        private networks and link-local hosts are rejected when you save the endpoint, and again at send time if the
        host resolves to one. Local development sets <code>WEBHOOKS_ALLOW_PRIVATE_URLS=true</code> on the API so
        receivers on your machine work. <code>source</code> is <code>custom</code> by default, or{" "}
        <code>zapier</code> for endpoints Zapier creates.
      </p>

      <H2>The request</H2>
      <p>
        Every event is a <code>POST</code> with the same envelope. <code>data</code> depends on the event type.
        Events about a record carry it as <code>data.object</code>. Update events add <code>data.previous</code> with
        the old values of the fields that changed.
      </p>
      <Code title="account.plan_changed" lang="http" code={request} />
      <Table
        head={["Field", "Description"]}
        rows={[
          ["id", <>The event id (<code>evt_…</code>). Also sent as <code>webhook-id</code>, and the same on every retry.</>],
          ["type", "The event type."],
          ["created_at", "When the event happened, as an ISO 8601 timestamp."],
          ["app_id", "The app the event belongs to."],
          ["data", "The event's payload. See the catalog below."],
          ["test", <>Present and <code>true</code> only on test sends.</>],
        ]}
      />

      <H2>Verify the signature</H2>
      <p>
        Signatures follow <a href="https://www.standardwebhooks.com">Standard Webhooks</a>. Each request carries
        three headers:
      </p>
      <Table
        head={["Header", "Value"]}
        rows={[
          ["webhook-id", "The event id."],
          ["webhook-timestamp", "Unix seconds when this attempt was sent."],
          [
            "webhook-signature",
            <>
              <code>v1,</code> followed by the base64 HMAC-SHA256 of <code>{"<id>.<timestamp>.<body>"}</code>, keyed
              with the base64-decoded part of the secret after <code>whsec_</code>.
            </>,
          ],
        ]}
      />
      <p>
        Verify against the raw body, before parsing it. The <code>standardwebhooks</code> package does the work. This
        is the blog test bed&apos;s receiver, trimmed:
      </p>
      <Code title="app/api/webhooks/route.ts" lang="ts" code={verifyLibrary} />
      <p>Without a library, it is a few lines of Node:</p>
      <Code title="lib/verify-webhook.ts" lang="ts" code={verifyManual} />
      <Callout tone="warning" title="Answer 401 when verification fails.">
        Anyone can POST to your URL. Act only on requests whose signature matches, and keep the secret on your server.
        <code> POST /apps/:appId/webhooks/:webhookId/secret/regenerate</code> replaces it; the old secret stops
        working at once.
      </Callout>

      <H2>Delivery and retries</H2>
      <p>
        A <code>2xx</code> response within 10 seconds counts as delivered. Anything else is a failure, including a
        redirect, which isn&apos;t followed. After a failure, the API tries again on this schedule:
      </p>
      <Table
        head={["Attempt", "Sent"]}
        rows={[
          ["1", "Right away"],
          ["2", "1 minute after the first failure"],
          ["3", "5 minutes later"],
          ["4", "30 minutes later"],
          ["5", "2 hours later"],
          ["6", "8 hours later"],
          ["7", "24 hours later. If it fails, the delivery is marked failed."],
        ]}
      />
      <ul>
        <li>
          Deliveries go out in parallel, so events can arrive out of order. Use <code>created_at</code> when order
          matters.
        </li>
        <li>
          A retry can arrive after you&apos;ve already handled the event. Store the <code>webhook-id</code> and skip
          ids you&apos;ve seen.
        </li>
        <li>
          Answer quickly and do slow work afterwards. The first 1,024 characters of your response body are kept in the
          delivery log.
        </li>
        <li>
          Events and their deliveries are kept for 30 days.
        </li>
      </ul>

      <H3>410 Gone</H3>
      <p>
        Answer <code>410</code> to unsubscribe. The API marks that delivery failed and disables the endpoint with{" "}
        <code>disabled_reason</code> set to &ldquo;Endpoint returned 410 Gone&rdquo;. This is how Zapier removes a
        subscription. A disabled endpoint gets no new events, and deliveries still waiting for a retry fail with
        &ldquo;Endpoint disabled&rdquo;. Set <code>enabled: true</code> with{" "}
        <code>PATCH /apps/:appId/webhooks/:webhookId</code> to turn it back on.
      </p>

      <H2>Delivery log, tests and retries</H2>
      <p>
        <code>GET /apps/:appId/webhooks/:webhookId/deliveries</code> lists deliveries newest first, with each attempt&apos;s
        status, response and the exact payload. Filter with <code>?status=pending</code>, <code>succeeded</code> or{" "}
        <code>failed</code>, and page with <code>?limit=</code> (default 50). The dashboard shows the same log.
      </p>
      <Code title="A delivery waiting for its third attempt" lang="json" code={delivery} />
      <p>
        <code>POST …/deliveries/:deliveryId/retry</code> sends a delivery again right away and returns the result.
        It is a single attempt: if it fails, the delivery stays failed with no further retries.
      </p>
      <p>
        <code>POST /apps/:appId/webhooks/:webhookId/test</code> sends a sample event of the type you name once, even if
        the endpoint is disabled, and returns the delivery. Without a <code>type</code>, it sends the endpoint&apos;s
        first subscribed type (<code>account.created</code> for <code>*</code>). Test events have{" "}
        <code>&quot;test&quot;: true</code> and don&apos;t show up in the event log or the endpoint&apos;s stats.
      </p>
      <Code lang="bash" code={testSend} />
      <p>
        <code>GET /apps/:appId/events</code> is the app&apos;s event log for the last 30 days, newest first, whether
        or not any endpoint received them. Filter with <code>?type=</code>.
      </p>

      <H2>Event catalog</H2>
      <p>
        <code>GET /event-types</code> returns the same catalog with a sample <code>data</code> for each type, and
        needs no key. Usage events fire once each time a count crosses the threshold, and the API only computes them
        when some endpoint subscribes to them.
      </p>
      {CATALOG.map((group) => (
        <Fragment key={group.title}>
          <H3>{group.title}</H3>
          <Table head={["Event", "When it fires", "data"]} rows={group.events.map((e) => [e.type, e.when, e.data])} />
        </Fragment>
      ))}
      <p>
        In account and subscription events, <code>data.object</code> is the account, including its{" "}
        <code>subscription</code>. A usage event&apos;s object describes the counter:
      </p>
      <Code title="usage.limit_warning" lang="json" code={usageData} />
    </>
  );
}
