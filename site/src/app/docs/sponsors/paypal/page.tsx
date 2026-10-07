import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, EndpointList, H2, H3, Step, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "PayPal",
  description:
    "How Offer SDK uses PayPal: per-app credentials, server-priced checkouts, subscriptions and orders, plan changes, pauses, cancellations and webhooks.",
};

export default function PayPalDocsPage() {
  return (
    <>
      <DocsHeader
        title="PayPal"
        lead="PayPal takes every payment in Offer SDK. Each app connects its own PayPal REST app, the API prices each checkout itself, and PayPal's webhooks keep accounts in step with billing."
      />

      <H2>Connect a PayPal REST app</H2>
      <p>
        Credentials belong to an Offer app, not to the deployment. Two apps on one API can bill through two different
        PayPal accounts, and buyers pay the app owner directly.
      </p>
      <Steps>
        <Step title="Create a REST app in PayPal">
          <p>
            At <a href="https://developer.paypal.com">developer.paypal.com</a>, open{" "}
            <strong>Apps &amp; Credentials</strong>, pick <strong>Sandbox</strong> or <strong>Live</strong>, and create
            an app. Copy its client ID and secret.
          </p>
        </Step>
        <Step title="Paste them into the dashboard">
          <p>
            In the dashboard, open the app&apos;s <strong>Settings</strong> and find <strong>Payments</strong>. Choose
            Sandbox or Live to match the credentials, paste both values and press <strong>Connect PayPal</strong>.
          </p>
          <p>
            The API checks the pair by requesting an OAuth token from PayPal. If PayPal rejects it, you get a{" "}
            <code>400</code> and nothing is saved. If it works, the secret is encrypted and stored, and the dashboard
            never shows it again.
          </p>
        </Step>
        <Step title="Set a checkout page (optional)">
          <p>
            The same section has a <strong>Checkout page</strong> field: the URL of your page that uses the checkout SDK.
            Offer links and over-limit upgrade links send buyers there with <code>?offer=…</code>. Without it,
            over-limit responses carry a PayPal approval link instead.
          </p>
        </Step>
      </Steps>
      <p>The same connection is available over the API with the app&apos;s secret key or the admin key.</p>
      <EndpointList
        endpoints={[
          { method: "GET", path: "/apps/:appId/paypal", summary: "Connection status: env, client ID, and whether the webhook is registered." },
          {
            method: "PUT",
            path: "/apps/:appId/paypal",
            summary: (
              <>
                Body <code>{"{ client_id, client_secret, env }"}</code>, where <code>env</code> is{" "}
                <code>sandbox</code> (the default) or <code>live</code>. Verifies, stores and registers the webhook.
              </>
            ),
          },
          {
            method: "DELETE",
            path: "/apps/:appId/paypal",
            summary: "Disconnects. Existing PayPal subscriptions keep billing, but their webhooks can no longer be verified.",
          },
        ]}
      />
      <Table
        mono={false}
        head={["Detail", "Behavior"]}
        rows={[
          [
            "Base URL",
            <>
              <code>https://api-m.sandbox.paypal.com</code> for sandbox, <code>https://api-m.paypal.com</code> for live.{" "}
              <code>PAYPAL_API_URL</code> overrides both for every app (the API&apos;s tests point it at a fake PayPal).
            </>,
          ],
          [
            "Secret storage",
            <>
              AES-256-GCM in Postgres. The key comes from <code>SECRETS_KEY</code>, then <code>BETTER_AUTH_SECRET</code>,
              then <code>ADMIN_API_KEY</code>. If that value changes, stored secrets can&apos;t be read and each app has
              to reconnect.
            </>,
          ],
          [
            "Switching accounts",
            "Connecting a different client ID or env clears the app's cached PayPal product and billing plans, since they belong to the old account. Reconnecting the same pair keeps them.",
          ],
          [
            "Public client ID",
            <>
              <code>GET /apps/:appId/offers/:offerId/public</code> returns the client ID and env so the browser can load
              PayPal&apos;s buttons. The secret never leaves the API.
            </>,
          ],
        ]}
      />

      <H2>How a checkout works</H2>
      <p>
        The browser never sends a price. It sends the offer, the plan, the interval and any order bumps, and the API
        prices that selection from the offer stored in Postgres. The quote is saved on the checkout row, and the PayPal
        object is created from it.
      </p>
      <Code
        title="Start a checkout (publishable key)"
        lang="bash"
        code={`
curl -X POST https://your-api.example.com/apps/$APP_ID/offers/$OFFER_ID/checkout \\
  -H "Authorization: Bearer $OFFER_PUBLISHABLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "plan": "pro", "interval": "month", "bumps": ["onboarding"], "account": "user_42" }'`}
      />
      <p>
        The response is the checkout, with <code>paypal.kind</code> (<code>subscription</code> or <code>order</code>),{" "}
        <code>paypal.id</code> and <code>approve_url</code>. The React SDK&apos;s <code>Offer.Checkout</code> hands{" "}
        <code>paypal.id</code> to PayPal&apos;s buttons. Redirect flows, such as emailed links, send the buyer to{" "}
        <code>approve_url</code> with your <code>return_url</code> and <code>cancel_url</code>.
      </p>
      <p>
        After the buyer approves, the SDK calls <code>POST /apps/:appId/checkouts/:checkoutId/complete</code>. The API
        asks PayPal whether it was paid, captures one-time orders, and applies the purchase to the account. It returns{" "}
        <code>status: &quot;created&quot;</code> while PayPal is still activating, and the SDK polls until it&apos;s{" "}
        <code>completed</code>. The webhook does the same thing when it arrives, and a checkout is only granted once.
      </p>
      <Callout title="Plans without an offer.">
        <code>POST /apps/:appId/plans/:planId/checkout</code> sells a plan at its list price. It&apos;s a shortcut for
        the default offer, which has every priced plan at list price.
      </Callout>

      <H2>Subscriptions and orders</H2>
      <Table
        head={["Interval", "PayPal object", "What gets created"]}
        rows={[
          [
            "month, year",
            "Subscription",
            <>
              A billing plan under one PayPal catalog product per app (created on first use). Intro pricing becomes a{" "}
              <code>TRIAL</code> cycle at the sale price for the offer&apos;s number of cycles, then a{" "}
              <code>REGULAR</code> cycle at list price. The SDK loads PayPal&apos;s script with{" "}
              <code>intent=subscription</code>.
            </>,
          ],
          [
            "once",
            "Order",
            <>
              An order with <code>intent: &quot;CAPTURE&quot;</code>, one line item for the plan and one per bump. The
              API captures it when the buyer has approved it.
            </>,
          ],
        ]}
      />
      <p>
        Billing plans are cached by price shape (interval, currency, price, intro cycles and regular price), so every
        offer and checkout with the same shape reuses one PayPal plan. Publishing an offer creates its billing plans
        ahead of time, so the first buyer doesn&apos;t wait. Publishing fails if PayPal isn&apos;t connected.
      </p>
      <H3>Order bumps</H3>
      <p>
        On a subscription, the one-time bumps a buyer picks are added up and sent as the subscription&apos;s setup fee,
        which PayPal charges at activation. On a one-time order they&apos;re extra line items. Either way the bump
        prices come from the stored offer.
      </p>

      <H2>Plan changes and save-offer discounts</H2>
      <p>
        <code>POST /apps/:appId/namespaces/:namespaceId/subscription/change</code> moves a running subscription to
        another plan or interval. If the account&apos;s offer includes the new plan, the account keeps the offer&apos;s
        price, extras and any discounted cycles left. Otherwise it moves to list price and leaves the offer.
      </p>
      <p>
        PayPal needs the buyer to agree to a new price, so the API creates (or reuses) a billing plan for it, calls
        PayPal&apos;s subscription revise endpoint, and returns PayPal&apos;s <code>approve_url</code>. The change is
        stored as <code>subscription.pending_change</code> and applies when PayPal reports the new billing plan, through
        the webhook or a sync. Upgrades apply once approved. Downgrades wait for the renewal date, so nothing already
        paid for is lost.
      </p>
      <p>
        A discount from a cancel flow uses the same path: the price the account would pay next, less the percent, for a
        set number of renewals. The customer approves it on PayPal like any other price change.
      </p>

      <H2>Cancel, pause and resume</H2>
      <EndpointList
        endpoints={[
          {
            method: "POST",
            path: "/apps/:appId/namespaces/:namespaceId/subscription/cancel",
            summary: "Cancels in PayPal, re-reads the subscription, and moves the account to the free plan.",
          },
          {
            method: "POST",
            path: "/apps/:appId/namespaces/:namespaceId/subscription/pause",
            summary: (
              <>
                Body <code>{"{ months, reason? }"}</code>, 1 to 12 months. Suspends billing in PayPal and moves the
                account to the free plan until <code>pause.resume_at</code>.
              </>
            ),
          },
          {
            method: "POST",
            path: "/apps/:appId/namespaces/:namespaceId/subscription/resume",
            summary: "Ends a pause now: reactivates billing in PayPal and restores the paused plan.",
          },
          {
            method: "POST",
            path: "/apps/:appId/namespaces/:namespaceId/subscription/sync",
            summary: "Re-reads the subscription from PayPal: status, renewal date, discounted cycles left and approved plan changes.",
          },
        ]}
      />
      <p>
        A pause uses PayPal&apos;s suspend call, and a resume uses its activate call. Due pauses resume on their own. A
        pause accepted in a cancel flow runs as a Render Workflow task when that&apos;s configured; see{" "}
        <Link href="/docs/sponsors/render">Render</Link>.
      </p>

      <H2>PayPal webhooks</H2>
      <p>PayPal posts each app&apos;s notifications to its own path on the API:</p>
      <Code lang="text" code="POST https://<your-api-host>/paypal/webhooks/<appId>" />
      <p>
        You don&apos;t add this URL in PayPal yourself. When you connect PayPal, the API registers the webhook with
        PayPal for the events below and stores the webhook ID it gets back. The Payments section then says webhooks
        are registered.
      </p>
      <p>
        PayPal only accepts public HTTPS URLs, so the API needs to know its own address. It uses{" "}
        <code>PUBLIC_API_URL</code> when that&apos;s set, and otherwise the <code>onrender.com</code> URL Render gives
        every web service (<code>RENDER_EXTERNAL_URL</code>). A Blueprint deploy needs no setup. Set{" "}
        <code>PUBLIC_API_URL</code> to register a custom domain instead, or when the API runs outside Render.
      </p>
      <Callout tone="warning" title="Don't register the URL by hand in PayPal.">
        Every delivery is verified against the webhook ID the API stored, so a hand-made webhook fails with{" "}
        <code>Invalid signature</code>. It also blocks the API from registering its own, because PayPal won&apos;t take
        the same URL twice. If an app connected before the API had a public address, press <strong>Replace</strong> in
        Payments and save the same credentials to register the webhook.
      </Callout>
      <p>The API subscribes to these eight events:</p>
      <Code
        title="PAYPAL_WEBHOOK_EVENTS in api/src/lib/paypal.ts"
        lang="text"
        code={`
BILLING.SUBSCRIPTION.ACTIVATED
BILLING.SUBSCRIPTION.UPDATED
BILLING.SUBSCRIPTION.CANCELLED
BILLING.SUBSCRIPTION.SUSPENDED
BILLING.SUBSCRIPTION.EXPIRED
BILLING.SUBSCRIPTION.PAYMENT.FAILED
PAYMENT.SALE.COMPLETED
PAYMENT.CAPTURE.COMPLETED`}
      />
      <Table
        head={["Event", "What the API does"]}
        rows={[
          [
            "BILLING.SUBSCRIPTION.*",
            <>
              Reads the subscription in the event. If a checkout is waiting on it and it&apos;s active, the checkout
              completes. Otherwise the account&apos;s subscription is updated: status (<code>ACTIVE</code> to active,{" "}
              <code>SUSPENDED</code> to suspended, <code>CANCELLED</code> or <code>EXPIRED</code> to cancelled), renewal
              date, discounted cycles left, and any pending plan change whose billing plan PayPal now shows. A
              cancellation moves the account to the free plan and sends <code>subscription.cancelled</code>.
            </>,
          ],
          [
            "PAYMENT.SALE.COMPLETED",
            <>
              A subscription payment. The sale doesn&apos;t carry billing details, so the API fetches the subscription
              and handles it the same way. A new payment after the first sends <code>subscription.renewed</code>.
            </>,
          ],
          ["PAYMENT.CAPTURE.COMPLETED", "Completes the one-time order checkout the capture belongs to."],
        ]}
      />
      <p>
        Each delivery is checked with PayPal&apos;s verify-webhook-signature API, then recorded by event ID so a repeat
        is answered <code>200</code> with <code>duplicate: true</code>. If handling fails, the API forgets the event and
        answers <code>500</code>, so PayPal&apos;s retry is processed again.
      </p>
      <p>
        Without registered webhooks, checkouts still complete when the buyer comes back to your page and the SDK calls{" "}
        <code>/complete</code>. Renewals and cancellations made in PayPal won&apos;t reach the account until you call{" "}
        <code>/subscription/sync</code>.
      </p>

      <H2>Test in sandbox</H2>
      <Steps>
        <Step title="Connect sandbox credentials">
          <p>
            Create a sandbox REST app, then connect it in <strong>Settings → Payments</strong> with{" "}
            <strong>Sandbox</strong> selected. The Payments section shows a Sandbox badge.
          </p>
        </Step>
        <Step title="Publish an offer">
          <p>
            Build an offer and publish it. This creates the PayPal product and billing plans in your sandbox account.
          </p>
        </Step>
        <Step title="Pay as a sandbox buyer">
          <p>
            Open your checkout page and pay with a sandbox personal account from your PayPal developer dashboard. No real
            money moves.
          </p>
        </Step>
        <Step title="Check the account">
          <p>
            The account moves to the plan and gets a <code>subscription</code> record. Your own webhook endpoints receive{" "}
            <code>checkout.completed</code>.
          </p>
        </Step>
      </Steps>
      <p>
        On your machine, the API isn&apos;t on a public HTTPS address, so PayPal webhooks aren&apos;t registered.
        Checkouts complete through <code>/complete</code>, and <code>/subscription/sync</code> picks up anything you
        change in PayPal. To exercise the webhooks, deploy to Render, where the API registers them at its{" "}
        <code>onrender.com</code> address.
      </p>
      <p>
        With Bun installed, <code>api/scripts/seed-demo.ts</code> seeds a sample catalog, a half-off offer and your
        sandbox credentials for the dashboard&apos;s <code>/demo/checkout</code> page:
      </p>
      <Code
        lang="bash"
        code={`
cd api
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... bun scripts/seed-demo.ts`}
      />
      <p>
        For the checkout components, see <Link href="/docs/sdk/checkout">Checkout</Link>. For the events your app
        receives, see <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>
    </>
  );
}
