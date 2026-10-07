import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Step, Steps, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Offers",
  description: "Connect PayPal, build an offer with a live checkout preview, publish it, and share its link with a ref for each source.",
};

export default function OffersDocsPage() {
  return (
    <>
      <DocsHeader
        title="Offers"
        lead="An offer is a way to buy: which plans are for sale, at what price, with which extras and order bumps. You build it in the dashboard, publish it, and share its checkout link."
      />

      <p>
        Offers live under <strong>Offers</strong> in the app nav (<code>/apps/[appId]/offers</code>). Buyers pay with
        PayPal through your own PayPal REST app, so the money goes straight to you. Buying sets the account&apos;s plan,
        records the offer on the account and adds the offer&apos;s extras. When an intro discount ends, PayPal bills
        the list price.
      </p>
      <Callout title="Offers need the Offer API.">
        The in-memory mock doesn&apos;t sell anything, so the <strong>Offers</strong> nav item is hidden when the
        dashboard runs with <code>OFFER_API_URL=mock</code>.
      </Callout>

      <H2>Before you start</H2>
      <ul>
        <li>
          At least one paid plan (the <strong>Free plan</strong> switch off). Its pricing card supplies the list
          prices. A plan without one can still be sold, but you set its price in each offer. See{" "}
          <Link href="/docs/admin/catalog">Catalog</Link>.
        </li>
        <li>PayPal connected for the app. You can build drafts without it, but you can&apos;t publish.</li>
        <li>Optionally, your own checkout page built with the React SDK.</li>
      </ul>

      <H2>Connect PayPal</H2>
      <p>
        PayPal is set per app under <strong>App settings → Payments</strong> (
        <code>/apps/[appId]/settings#payments</code>). Until it&apos;s connected, the offer pages show{" "}
        <strong>Connect PayPal to publish offers and take payments</strong> with a link there.
      </p>
      <Steps>
        <Step title="Create a REST app in PayPal">
          <p>
            At developer.paypal.com, open <strong>Apps &amp; Credentials</strong> and create or open a REST app. Copy
            its client ID and secret.
          </p>
        </Step>
        <Step title="Connect it">
          <p>
            Pick <strong>Sandbox</strong> or <strong>Live</strong>, paste the <strong>Client ID</strong> and{" "}
            <strong>Secret</strong>, and click <strong>Connect PayPal</strong>. The API checks the credentials with
            PayPal, then stores the secret encrypted. The dashboard never shows it again.
          </p>
        </Step>
        <Step title="Check the webhook status">
          <p>
            The connected card shows the environment, the client ID and whether PayPal webhooks were registered. They
            register when the API is on a public HTTPS address, and then renewals and cancellations update accounts on
            their own. Without them, a checkout completes when the buyer returns to your page.
          </p>
        </Step>
      </Steps>
      <p>
        <strong>Replace</strong> swaps in new credentials. <strong>Disconnect</strong> stops new checkouts. Existing
        PayPal subscriptions keep billing, but their renewals and cancellations stop reaching the app.
      </p>

      <H3>Checkout page</H3>
      <p>
        The <strong>Checkout page</strong> field in the same section is the URL of your page that renders the checkout
        SDK, such as <code>https://yourapp.com/checkout</code>. Offer links, plan links and over-limit upgrade links
        send buyers there with <code>?offer=…</code>. Until you set it, links point at the dashboard&apos;s demo
        checkout at <code>/demo/checkout</code>. Building that page is covered in{" "}
        <Link href="/docs/sdk/checkout">Checkout</Link>.
      </p>

      <H2>The offers list</H2>
      <p>
        The list shows each offer&apos;s status, plans, deal, sales (with the cap, if any), end date and creation date.
        Click a row to open the offer. The row menu has <strong>Copy checkout link</strong>,{" "}
        <strong>Duplicate</strong>, <strong>Copy ID</strong> and <strong>Delete</strong>. The status is what a buyer
        would see right now:
      </p>
      <TermList
        items={[
          { term: "Draft", children: "Saved but never published." },
          { term: "Live", children: "Published and taking buyers." },
          { term: "Ended", children: "Published, but its end date has passed." },
          { term: "Sold out", children: "Published, but it reached its maximum number of sales." },
          { term: "Archived", children: "Taken down after being published." },
        ]}
      />
      <p>
        Only a live offer sells at its own terms. A link to any other offer still opens the checkout, at your regular
        prices.
      </p>

      <H2>Build an offer</H2>
      <p>
        <strong>New offer</strong> opens a full-page editor at <code>/apps/[appId]/offers/new</code>, with the form on
        the left and a <strong>Checkout preview</strong> on the right. <strong>Duplicate</strong> opens the same editor
        filled in from an existing offer.
      </p>
      <TermList
        items={[
          {
            term: "Details",
            children: (
              <>
                <strong>Name</strong> and <strong>ID</strong> (used in <code>?offer=</code> links and API calls, fixed
                after creation), plus an optional <strong>Headline</strong>, <strong>Subhead</strong> and{" "}
                <strong>Bullets</strong> (one per line) for the checkout page.
              </>
            ),
          },
          {
            term: "Pricing",
            children: (
              <>
                One discount for every plan in the offer: <strong>Percent off</strong>, <strong>Amount off</strong> or{" "}
                <strong>No discount</strong>, and <strong>For how many payments</strong> (empty means it never ends).{" "}
                <strong>Billing options</strong> picks <strong>Monthly</strong>, <strong>Yearly</strong> and{" "}
                <strong>Lifetime</strong>. Lifetime needs one-time prices.
              </>
            ),
          },
          {
            term: "Plans",
            children: (
              <>
                Tick each paid plan to include. <strong>Preselect</strong> one to have it chosen when the checkout opens.
                Each included plan opens a price row per billing option and an extras list (below).
              </>
            ),
          },
          {
            term: "Order bumps",
            children: (
              <>
                One-time extras offered at checkout, like a setup call or a credit pack. <strong>Add bump</strong>, then
                set a <strong>Label</strong>, <strong>Price</strong>, optional <strong>Description</strong>, what it{" "}
                <strong>Gives</strong> (<strong>An add-on</strong> or <strong>Credits</strong> of a usage entitlement)
                and which plans it&apos;s <strong>Shown with</strong> (none selected means every plan).
              </>
            ),
          },
          {
            term: "Availability",
            children: (
              <>
                <strong>Ends</strong> (a date and time) and <strong>Max sales</strong>. Both only stop new buyers.
                Existing buyers keep their price.
              </>
            ),
          },
        ]}
      />

      <H3>Prices per plan</H3>
      <p>
        For each billing option, the row shows the plan&apos;s list price struck through and an input for the offer
        price. Leave it empty to use the offer&apos;s discount, which the input shows in grey as a placeholder. For
        monthly and yearly prices you can also set how many payments the price lasts. A billing option the plan has no
        list price for shows <strong>Set a price</strong>.
      </p>

      <H3>Extra entitlements</H3>
      <p>
        <strong>Add extra</strong> gives buyers of that plan more than the plan does: pick an entitlement and a limit
        (empty means unlimited). Next to the limit you see the plan&apos;s own limit, or “not in plan”. A feature flag
        has no limit and shows “Included with this offer”. <strong>Extras last</strong> sets how long they apply:
      </p>
      <ul>
        <li>
          <strong>While subscribed</strong>
        </li>
        <li>
          <strong>During the discount</strong>
        </li>
        <li>
          <strong>For 3 months</strong>, <strong>For 6 months</strong> or <strong>For 1 year</strong>
        </li>
      </ul>
      <p>
        Extras sit between the plan and any incentive when the API resolves access. See{" "}
        <Link href="/docs/admin/catalog#how-access-is-resolved">How access is resolved</Link>.
      </p>

      <H3>Live preview</H3>
      <p>
        Each time you stop typing, the editor sends the unsaved fields to{" "}
        <code>POST /apps/:appId/offers/draft-preview</code>. The API validates them, prices every plan and billing
        option, and returns the same public offer the checkout page would receive. Nothing is stored. The preview is
        rendered with the checkout SDK&apos;s components, so it matches what buyers see apart from your styling.
      </p>
      <p>
        If the API rejects a field, its error shows above the preview, the last valid preview stays visible, and{" "}
        <strong>Create draft</strong> (or <strong>Save offer</strong> when editing) is disabled until you fix it.
      </p>

      <H2>Publish and archive</H2>
      <p>
        <strong>Create draft</strong> saves the offer and opens its page. From there:
      </p>
      <TermList
        items={[
          {
            term: "Publish",
            children:
              "Re-validates the offer against the current catalog, creates the PayPal billing plan behind every recurring price, and makes the offer live. It fails if PayPal isn't connected.",
          },
          {
            term: "Edit",
            children: "Opens the editor at /offers/[offerId]/edit. Edits apply to future purchases. Every checkout keeps the price it was quoted.",
          },
          {
            term: "Archive",
            children: "Stops new purchases. The link falls back to your regular prices, and accounts that bought keep their price and extras. Publish again brings it back.",
          },
          {
            term: "Delete offer",
            children: "Same fallback for the link. Buyers keep their terms, but the offer's stats are gone. Archive instead if you want to keep them.",
          },
        ]}
      />

      <H2>The offer page</H2>
      <p>
        Each offer has a page at <code>/apps/[appId]/offers/[offerId]</code> with four tabs:
      </p>
      <TermList
        items={[
          {
            term: "Performance",
            children: (
              <>
                <strong>Views</strong>, <strong>Checkouts</strong>, <strong>Sales</strong> (with conversion from views)
                and <strong>Revenue</strong> (first payments and bumps). Below that, <strong>By plan</strong>,{" "}
                <strong>By source</strong> (one row per <code>?ref=</code> value, plus Direct) and{" "}
                <strong>Order bumps</strong> with each bump&apos;s take rate.
              </>
            ),
          },
          { term: "Checkout", children: "The checkout as buyers see it, priced by the API." },
          { term: "Accounts", children: "Accounts that bought through the offer, while their subscription is active." },
          {
            term: "Checkouts",
            children: (
              <>
                Every checkout started from the offer, with buyer, plan, source and status: <strong>Started</strong>,{" "}
                <strong>Paid</strong>, <strong>Expired</strong>, <strong>Failed</strong> or <strong>Cancelled</strong>.
              </>
            ),
          },
        ]}
      />
      <p>
        The side panel shows the offer&apos;s details (status, deal, billing options, sales, end date, source and
        publish date), the <strong>Share</strong> box, and the plans with their extras and bumps.
      </p>

      <H2>Share links</H2>
      <p>
        The <strong>Share</strong> box builds the offer&apos;s checkout link. Type a <code>ref</code> such as{" "}
        <code>partner_x</code> and the link gets <code>?ref=partner_x</code>, so you can give each affiliate, campaign
        or email its own link. Sales then show up per ref under <strong>By source</strong>.
      </p>
      <Code
        lang="text"
        title="Link formats"
        code={`# with a checkout page set in App settings → Payments
https://yourapp.com/checkout?offer=spring_sale&ref=partner_x

# without one: the dashboard's demo checkout
https://dashboard.example.com/demo/checkout?app=<appId>&key=<publicKey>&offer=spring_sale&ref=partner_x`}
      />
      <p>
        Plans have a link too. A paid plan&apos;s page shows a <strong>Checkout link</strong> that sells it at its list
        price through the built-in <code>default</code> offer (<code>?offer=default&amp;plan=&lt;planId&gt;</code>).
        Use an offer when you want a sale price, extras or bumps.
      </p>
      <p>
        How PayPal subscriptions, plan changes and webhooks work underneath is covered in{" "}
        <Link href="/docs/sponsors/paypal">PayPal</Link>.
      </p>
    </>
  );
}
