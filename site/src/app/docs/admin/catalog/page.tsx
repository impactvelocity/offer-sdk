import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Step, Steps, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Edit plans, entitlements, add-ons and incentives in the dashboard, apply them to accounts, and see how the API combines them.",
};

export default function CatalogDocsPage() {
  return (
    <>
      <DocsHeader
        title="Catalog"
        lead="Plans, entitlements, add-ons and incentives decide what each account can use. You edit them under Catalog in the app nav, and your app sees the change on its next access check."
      />

      <p>
        The four record types are explained in <Link href="/docs/concepts">Core concepts</Link>. This page covers
        where you edit each one, how they attach to accounts, and the order the API applies them in. Each list page
        has a help button (<strong>How Plans Work</strong>, <strong>How Entitlements Work</strong> and so on) that
        opens a short explainer.
      </p>

      <H2>Entitlements</H2>
      <p>
        <strong>Catalog → Entitlements</strong> (<code>/apps/[appId]/entitlements</code>) lists the features and limits
        you gate. Click <strong>New entitlement</strong> and fill in:
      </p>
      <TermList
        items={[
          { term: "Name", children: "Shown in the dashboard and returned to the SDK as name." },
          {
            term: "ID",
            children: (
              <>
                What your code checks, such as <code>ai_credits</code>. IDs can&apos;t be changed after creation.
              </>
            ),
          },
          {
            term: "Type",
            children: (
              <>
                <strong>Usage</strong> (<code>usage</code>) is counted against a limit, such as projects or credits.{" "}
                <strong>Feature flag</strong> (<code>boolean</code>) is on or off, such as SSO or PDF export.
              </>
            ),
          },
          { term: "Description", children: "Optional. What the entitlement gives access to or limits." },
        ]}
      />
      <p>
        An entitlement has no limit of its own. Limits are set where you attach it: on a plan, an offer or an incentive.
        The list shows where each entitlement is used, and you can filter it to <strong>Usage</strong> or{" "}
        <strong>Feature flags</strong>. Changing the type of an entitlement that plans already use keeps their existing
        limits.
      </p>
      <Callout title="Blocking usage past the limit is API-only.">
        A usage entitlement can refuse calls over its limit with a 402 and an upgrade offer. The dashboard doesn&apos;t
        have a control for it: set <code>{`overage: { mode: "block" }`}</code> with{" "}
        <code>PATCH /apps/:appId/entitlements/:id</code>. See the <Link href="/docs/api/reference">Endpoint reference</Link>.
      </Callout>

      <H2>Plans</H2>
      <p>
        <strong>Catalog → Plans</strong> (<code>/apps/[appId]/plans</code>) lists every plan with its price, limits,
        add-ons and account count. Every account is on exactly one plan.
      </p>
      <Steps>
        <Step title="Create the plan">
          <p>
            Click <strong>New plan</strong>. Give it a name and ID, an optional description, and turn on{" "}
            <strong>Free plan</strong> if accounts on it don&apos;t pay. The plan page opens.
          </p>
        </Step>
        <Step title="Attach entitlements and add-ons">
          <p>
            On the <strong>Access</strong> tab, pick an entitlement under <strong>Add entitlement…</strong> and enter a
            limit. Leave the limit empty for unlimited. Feature flags take no limit. Click any limit later to change it.
            Add add-ons the same way below.
          </p>
        </Step>
        <Step title="Set the price">
          <p>
            On the <strong>Pricing</strong> tab, fill in the pricing card and click{" "}
            <strong>Publish pricing card</strong>. See <a href="#the-pricing-editor">The pricing editor</a>.
          </p>
        </Step>
      </Steps>
      <p>The plan page has four tabs and a side panel:</p>
      <TermList
        items={[
          { term: "Access", children: "The entitlements with their limits, and the add-ons included." },
          { term: "Pricing", children: "The Free plan switch and the pricing card." },
          { term: "Metadata", children: "Key/value pairs your app reads at runtime." },
          { term: "Accounts", children: "Accounts on this plan, paginated." },
          {
            term: "Side panel",
            children: (
              <>
                <strong>Details</strong> (edit the name and description in place), <strong>Checkout link</strong> for a
                plan that isn&apos;t free and has a price on its pricing card, an <strong>Internal note</strong> for
                your team, and <strong>SDK response</strong>: what{" "}
                <code>GET /namespaces/:id/plan</code> returns for a new account on this plan.
              </>
            ),
          },
        ]}
      />
      <p>
        <strong>Duplicate</strong> copies the limits, add-ons, metadata and pricing card into a new plan. Accounts stay
        on the original. <strong>Delete plan</strong> asks you to type the plan ID when accounts are on it, because
        their access checks fail until you move them to another plan.
      </p>

      <H3 id="the-pricing-editor">The pricing editor</H3>
      <p>
        The <strong>Pricing</strong> tab edits what <code>GET /apps/:appId/plans/pricing</code> returns for your pricing
        page. A live preview of the card sits on the right, with a <strong>Monthly</strong>/<strong>Yearly</strong>{" "}
        toggle for subscriptions.
      </p>
      <TermList
        items={[
          {
            term: "Free plan",
            children:
              "Accounts on it don't pay. It shows as Free on your pricing page and is never offered as a paid upgrade. The SDK sees it as isFree.",
          },
          { term: "Title and Description", children: "The card's heading and subheading." },
          {
            term: "Pricing",
            children: (
              <>
                <strong>Subscription</strong> takes a <strong>Monthly price</strong> and a{" "}
                <strong>Yearly price</strong>. <strong>One-time</strong> takes a single <strong>Price</strong>. Both
                take a <strong>Currency</strong>.
              </>
            ),
          },
          { term: "Featured", children: "Highlights the plan on your pricing page." },
          { term: "Benefits", children: "Bullet lines for the card. Drag to reorder." },
        ]}
      />
      <p>
        <strong>Publish pricing card</strong> saves it (the button reads <strong>Save changes</strong> once a card
        exists). <strong>Remove card</strong> takes the plan off <code>GET /plans/pricing</code>. The card&apos;s prices
        are also the list prices that <Link href="/docs/admin/offers">offers</Link> and plan checkout links sell at.
      </p>

      <H3>Metadata</H3>
      <p>
        The <strong>Metadata</strong> tab stores key/value pairs on the plan, such as <code>max_projects</code>,{" "}
        <code>badge</code> or <code>stripe_price_id</code>. Numbers, booleans and JSON are parsed, so the SDK gets
        real types. Each key is one of:
      </p>
      <TermList
        items={[
          {
            term: "Public",
            children: (
              <>
                Returned by <code>GET …/plan</code>, so your frontend can read it.
              </>
            ),
          },
          {
            term: "Private",
            children: (
              <>
                Stripped from <code>…/plan</code>. Your backend reads it from <code>GET …/full-plan</code> with the
                secret key.
              </>
            ),
          },
        ]}
      />

      <H2>Add-ons</H2>
      <p>
        <strong>Catalog → Add-ons</strong> (<code>/apps/[appId]/addons</code>) holds optional extras, such as an extra
        storage pack or white-label branding. An add-on is a name, an ID and a description. It does nothing until you
        attach it: on a plan&apos;s <strong>Access</strong> tab, an incentive&apos;s <strong>Overrides</strong> tab, or
        an offer. Your app receives the IDs in the <code>addons</code> array of the access response.
      </p>
      <p>
        An account can also own add-ons directly, for example after buying an order bump. The dashboard has no control
        for this; use <code>POST /apps/:appId/namespaces/:id/addons</code>.
      </p>

      <H2>Incentives</H2>
      <p>
        <strong>Catalog → Incentives</strong> (<code>/apps/[appId]/incentives</code>) holds overrides you apply to
        single accounts: a promo, a partner deal, a beta perk or a win-back offer. An incentive changes what an account
        gets without changing its plan.
      </p>
      <TermList
        items={[
          {
            term: "Overrides tab",
            children: (
              <>
                <strong>Entitlements</strong> override the limit from the account&apos;s plan, or grant the entitlement
                if the plan doesn&apos;t include it. <strong>Add-ons</strong> are granted on top of the plan&apos;s.{" "}
                <strong>Impact by plan</strong> shows what accounts on each plan end up with.
              </>
            ),
          },
          { term: "Accounts tab", children: "Every account that has this incentive, with its plan." },
          {
            term: "Apply to an account",
            children: "A side panel to search accounts, apply the incentive, or remove it from an account.",
          },
          {
            term: "Apply from your backend",
            children: "A snippet for applying it from your server with the secret key, for example after a promo code checkout.",
          },
        ]}
      />
      <p>
        An account has at most one incentive. Applying a new one replaces the old one. Removing an incentive never
        touches usage counters or the account&apos;s plan.
      </p>

      <H2>Accounts</H2>
      <p>
        <strong>Customers → Accounts</strong> (<code>/apps/[appId]/accounts</code>) lists your customers. The API calls
        them namespaces. You can search by name or ID and filter by plan or incentive. Your app usually creates
        accounts, but <strong>New account</strong> creates one by hand: an <strong>Account ID</strong> (the user or team
        ID from your product), an optional name, a plan and an optional incentive. You need at least one plan first.
      </p>
      <p>An account page has four tabs and a side panel:</p>
      <TermList
        items={[
          {
            term: "Access",
            children:
              "The resolved result: usage against each limit, every feature flag and whether the account has it, and add-ons from the plan or the incentive.",
          },
          { term: "Activity", children: "Recent usage calls for this account (add, remove, amount)." },
          { term: "Analytics", children: "Usage by entitlement over a period." },
          {
            term: "API response",
            children: (
              <>
                A curl command and the live response, for <code>/plan</code> with the public key or{" "}
                <code>/full-plan</code> with the secret key.
              </>
            ),
          },
          {
            term: "Side panel",
            children: (
              <>
                <strong>Details</strong> and a <strong>Usage simulator</strong> that sends the same usage calls your
                app makes.
              </>
            ),
          },
        ]}
      />

      <H3>Changing one account</H3>
      <p>
        There is no per-account entitlement editor. To change what one account gets, either move it to another plan or
        apply an incentive:
      </p>
      <ul>
        <li>
          <strong>Change plan</strong> in the page header opens a dialog that lists what changes (limits, features and
          add-ons) before you confirm.
        </li>
        <li>
          The <strong>…</strong> menu has <strong>Apply incentive…</strong> (or <strong>Change incentive…</strong>),{" "}
          <strong>Remove incentive</strong>, <strong>Rename…</strong>, <strong>Copy account ID</strong> and{" "}
          <strong>Delete account</strong>.
        </li>
      </ul>
      <p>Both take effect on your app&apos;s next access check.</p>

      <H2>How access is resolved</H2>
      <p>
        When your app asks for an account&apos;s access (<code>GET /apps/:appId/namespaces/:id/plan</code> or{" "}
        <code>/full-plan</code>), the API builds the answer from up to three layers. A later layer overrides an earlier
        one for the same entitlement ID:
      </p>
      <ol>
        <li>
          <strong>The plan</strong>: its entitlements and limits.
        </li>
        <li>
          <strong>Offer extras</strong>: the extra entitlements from the offer the account bought through. They apply
          while the subscription is active, and stop when the intro price ends or the set duration passes, depending on
          how the offer was configured.
        </li>
        <li>
          <strong>The incentive</strong>: its overrides, until the incentive&apos;s expiry passes if it has one.
        </li>
      </ol>
      <p>
        Add-ons are merged from all three layers plus the ones the account owns. Each entitlement comes back with its
        limit, current usage, what&apos;s left and whether the account can use it.
      </p>
      <Table
        head={["Layer", "ai_credits limit"]}
        rows={[
          ["Pro plan", "2,500"],
          ["Offer extra (during the discount)", "5,000"],
          ["Incentive", "Unlimited"],
          ["Result", "Unlimited, until the incentive is removed. Then 5,000 while the discount lasts, then 2,500."],
        ]}
      />
      <p>
        The API reads the catalog on every request. Nothing about plans, limits or incentives is compiled into your
        app, so edits in the dashboard reach your users on their next check, with no deploy.
      </p>
      <Code
        lang="json"
        title="GET /apps/:appId/namespaces/acme/plan (trimmed)"
        code={`{
  "plan": { "id": "pro", "name": "Pro", "isFree": false, "meta": {} },
  "incentive": "black_friday_2026",
  "offer": "spring_sale",
  "addons": ["ai_boost"],
  "entitlements": [
    { "id": "ai_credits", "type": "usage", "usage": 1200, "max": null, "left": null, "can": true },
    { "id": "export_pdf", "type": "boolean", "usage": 0, "max": null, "left": null, "can": true }
  ]
}`}
      />
      <p>
        The React SDK reads this response for you. See <Link href="/docs/sdk">Access and entitlements</Link>.
      </p>
    </>
  );
}
