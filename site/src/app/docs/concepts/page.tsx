import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Core concepts",
  description: "The records Offer SDK is built from, and how they combine into one answer about an account's access.",
};

export default function ConceptsPage() {
  return (
    <>
      <DocsHeader
        title="Core concepts"
        lead="Everything you sell is built from a handful of records. Your code reads the result; the dashboard changes the records."
      />

      <H2>Apps and accounts</H2>
      <TermList
        items={[
          {
            term: "App",
            children: (
              <>
                One product you sell. It has an id (<code>app_…</code>), a secret key (<code>key_…</code>) and a
                publishable key (<code>pub_…</code>). Every other record belongs to one app. A dashboard workspace can
                hold several apps.
              </>
            ),
          },
          {
            term: "Account",
            children: (
              <>
                One customer of your app: a user, a team or an organization, keyed by an id you choose. The API calls
                accounts <code>namespaces</code>, so routes look like <code>/apps/:appId/namespaces/:id</code>. An
                account is always on exactly one plan.
              </>
            ),
          },
        ]}
      />

      <H2>What you sell</H2>
      <TermList
        items={[
          {
            term: "Entitlement",
            children: (
              <>
                One thing an account can use. A <code>boolean</code> entitlement is on or off (“exports”). A{" "}
                <code>usage</code> entitlement is counted against a limit (“1,000 contacts”), or unlimited. Usage
                entitlements can block usage past the limit and answer with an upgrade offer.
              </>
            ),
          },
          {
            term: "Plan",
            children:
              "A named bundle of entitlements, each with its own limit, plus add-ons, pricing and free-form metadata. Plans carry monthly and yearly prices or a one-time price, and one can be marked free.",
          },
          {
            term: "Add-on",
            children:
              "A named extra, such as priority support or a welcome call. Plans, offers and incentives can include add-ons, and an account can own add-ons directly.",
          },
          {
            term: "Incentive",
            children:
              "A per-account override: higher limits, extra entitlements or add-ons for one customer, with an optional expiry. Use it for trials, partner deals and goodwill credits. An account has at most one.",
          },
          {
            term: "Offer",
            children:
              "A way to buy. It lists which plans are for sale, at what price per interval, with an optional intro discount, extra entitlements for buyers, order bumps, an expiry and a redemption cap. Each offer has its own link, so you can run one per campaign or affiliate.",
          },
        ]}
      />
      <Callout title="Billing intervals aren't separate plans.">
        Monthly and yearly are prices on the same plan, so the entitlements stay in one place.
      </Callout>

      <H2>How access is resolved</H2>
      <p>
        When you ask for an account&apos;s plan, the API builds it in three layers. Each layer overrides the one before
        it for any entitlement they share.
      </p>
      <Table
        mono={false}
        head={["Layer", "Comes from", "Applies while"]}
        rows={[
          ["1. Plan", "The account's plan", "Always"],
          [
            "2. Offer extras",
            "The offer the account bought through",
            "The subscription is active, and the extras haven't ended with the intro price or after their set duration",
          ],
          ["3. Incentive", "The incentive on the account", "Until its expiry, if it has one"],
        ]}
      />
      <p>
        Add-ons from every layer are merged with the account&apos;s own. Each entitlement comes back with the account&apos;s
        current usage and a ready answer:
      </p>
      <Code
        lang="json"
        code={`{ "id": "contacts", "feature": "contacts", "name": "Contacts", "type": "usage", "usage": 940, "max": 1000, "left": 60, "can": true }`}
      />
      <p>
        <code>can</code> is the field to gate on. <code>max: null</code> means unlimited. Two routes return this shape:{" "}
        <code>/plan</code> hides plan metadata keys you marked private, and <code>full-plan</code> includes them.
      </p>

      <H2>Usage</H2>
      <p>
        Usage is a counter per account and entitlement. Your code moves it with <code>add</code>,{" "}
        <code>remove</code> or <code>amount</code>, and each change is also kept as an event for analytics. By default
        usage can go past the limit and <code>can</code> turns false. When an entitlement blocks overage, the limit is
        checked in the same atomic update, so two requests at the limit can&apos;t both get through. Counters don&apos;t
        reset by themselves at the end of a billing period.
      </p>

      <H2>Subscriptions and checkouts</H2>
      <p>
        A checkout is one attempt to buy through an offer. The API prices it on the server from the offer&apos;s
        records, whatever the browser sends, and hands it to PayPal. When PayPal confirms the payment, the account moves
        to the plan it bought and the purchase is recorded on the account as its subscription: the offer, the price,
        discounted cycles left and the renewal date.
      </p>
      <p>
        Plan changes, cancellations and pauses all work on that subscription. Cancelling moves the account to your free
        plan; pausing suspends billing in PayPal and moves the account to the free plan until the pause ends.{" "}
        <Link href="/docs/sponsors/paypal">PayPal</Link> covers the details.
      </p>

      <H2>Cancel flows</H2>
      <p>
        A cancel flow is the set of steps a customer sees when they press cancel: questions about why, a save offer, and
        a confirmation. The save offer can be a discount, a pause, a downgrade or an incentive. It can be fixed, or
        picked per customer by an AI agent inside limits you set. See{" "}
        <Link href="/docs/admin/cancel-flows">Cancel flows</Link> in the dashboard docs.
      </p>

      <H2>Events</H2>
      <p>
        Changes produce events, such as <code>account.plan_changed</code>, <code>usage.limit_reached</code> or{" "}
        <code>checkout.completed</code>. The API keeps 30 days of them and delivers each to the webhook endpoints that
        subscribe to its type. See <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>
    </>
  );
}
