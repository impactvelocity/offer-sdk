import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Step, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Build one checkout page with the checkout SDK and sell any offer on it, paid through PayPal.",
};

const serverPage = `// app/pricing/page.tsx
import { getOffer, type Interval } from "@offer/sdk/checkout";
import { requireUser } from "@/lib/session"; // your own auth helper
import { CheckoutForm } from "./checkout-form";

const INTERVALS: Interval[] = ["month", "year", "once"];

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { offer, ref, plan, interval } = await searchParams;
  const user = await requireUser();
  const config = {
    apiUrl: process.env.OFFER_API_URL!,
    appId: process.env.OFFER_APP_ID!,
    publishableKey: process.env.OFFER_PUBLIC_KEY!,
  };

  // Fetched on the server so the page renders with prices.
  const initialOffer = await getOffer({ ...config, offerId: offer, account: user.id, ref });

  return (
    <CheckoutForm
      {...config}
      initialOffer={initialOffer}
      offerId={offer ?? null}
      account={user.id}
      refCode={ref ?? null}
      plan={plan ?? null}
      interval={INTERVALS.find((i) => i === interval) ?? null}
    />
  );
}`;

const clientForm = `// app/pricing/checkout-form.tsx
"use client";

import { Offer, OfferProvider, type OfferProviderProps } from "@offer/sdk/checkout";
import { useRouter } from "next/navigation";

export function CheckoutForm(props: Omit<OfferProviderProps, "children" | "onSuccess">) {
  const router = useRouter();
  return (
    <OfferProvider {...props} onSuccess={(checkout) => router.push(\`/welcome?checkout=\${checkout.id}\`)}>
      <Offer.Status />
      <Offer.Headline />
      <Offer.IntervalToggle labels={{ year: "Yearly (2 months free)" }} />
      <Offer.Plans className="plans">{(plan) => <Offer.Plan plan={plan} className="plan" />}</Offer.Plans>
      <Offer.Bumps className="bumps">{(bump) => <Offer.Bump bump={bump} />}</Offer.Bumps>
      <Offer.Summary />
      <Offer.Email />
      <Offer.Checkout style={{ color: "black", shape: "pill" }} />
    </OfferProvider>
  );
}`;

const planCard = `import { Offer, type PlanRenderProps } from "@offer/sdk/checkout";

function PlanCard({ plan, selected, select, priceText, listPriceText, renewalText, savings }: PlanRenderProps) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="plan-card" onClick={select}>
      <span>{plan.name}</span>
      {savings ? <span className="badge">Save {savings}%</span> : null}
      <span>
        {listPriceText ? <s>{listPriceText}</s> : null} <strong>{priceText}</strong>
      </span>
      <span>{renewalText ?? plan.description}</span>
    </button>
  );
}

<Offer.Plans>{(plan) => <Offer.Plan plan={plan}>{(props) => <PlanCard {...props} />}</Offer.Plan>}</Offer.Plans>`;

const dataCss = `/* The default markup carries its state in data attributes. */
[data-offer-plan][data-selected] { border-color: var(--accent); }
[data-offer-plan][data-featured] { order: -1; }
[data-offer-plan] [data-part="price"] s { opacity: 0.5; }
[data-offer-intervals] button[data-selected] { background: var(--accent); }
[data-offer-bump][data-selected] { outline: 1px solid var(--accent); }
[data-offer-summary] [data-part="total"] { font-weight: 600; }
[data-offer-checkout][data-phase="confirming"] { opacity: 0.6; }
[data-offer-checkout] [data-error] { color: var(--danger); }`;

const customButton = `"use client";

import { useOffer } from "@offer/sdk/checkout";

// Sends the buyer to PayPal's own page instead of the popup buttons.
export function PayOnPaypal() {
  const { summary, phase, checkoutError, redirectToPaypal } = useOffer();
  return (
    <>
      <button type="button" disabled={!summary?.ready || phase === "starting"} onClick={() => void redirectToPaypal().catch(() => {})}>
        Continue to PayPal
      </button>
      {checkoutError ? <p role="alert">{checkoutError}</p> : null}
    </>
  );
}`;

const startBody = `{
  "plan": "pro",
  "interval": "month",
  "bumps": ["support"],
  "account": "user_42",
  "ref": "newsletter",
  "return_url": "https://blog.example.com/pricing?offer_checkout=return",
  "cancel_url": "https://blog.example.com/pricing?offer_checkout=cancel"
}`;

const checkoutRow = `{
  "id": "chk_Q2wErTyUiOpAsDfG",
  "app_id": "app_AbCdEf",
  "offer_id": "launch_50",
  "plan_id": "pro",
  "interval": "month",
  "bumps": ["support"],
  "account_id": "user_42",
  "email": null,
  "ref": "newsletter",
  "status": "created",
  "currency": "USD",
  "total_today": 25,
  "quote": {
    "offer_id": "launch_50",
    "offer_name": "Launch week",
    "plan_id": "pro",
    "plan_name": "Pro",
    "interval": "month",
    "currency": "USD",
    "price": 10,
    "list_price": 20,
    "cycles": 3,
    "bumps": [{ "id": "support", "label": "Priority support", "amount": 15, "grant": { "addons": ["priority_support"] } }],
    "setup_fee": 15,
    "total_today": 25,
    "renews_at_price": 20,
    "extras": { "entitlements": [], "addons": [], "ends": "subscription" }
  },
  "paypal": { "kind": "subscription", "id": "I-BW452GLLEP1G" },
  "approve_url": "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=…",
  "created_at": "2026-10-01T12:00:00.000Z",
  "completed_at": null
}`;

export default function SdkCheckoutPage() {
  return (
    <>
      <DocsHeader
        title="Checkout"
        lead="Design one checkout page with headless components, then sell any offer on it by id. The API prices every purchase and PayPal takes the payment."
      />

      <p>
        The checkout SDK is its own entry point, <code>@offer/sdk/checkout</code>, so pages that only check access
        never load PayPal. It needs the API URL, the app id and the publishable key. The secret key stays on your
        server. See <Link href="/docs/sdk">Access and entitlements</Link> for how the SDK is imported.
      </p>

      <H2>Before you start</H2>
      <ul>
        <li>
          Connect PayPal for the app, in the dashboard or with <code>PUT /apps/:appId/paypal</code>. Without it,{" "}
          <code>offer.paypal</code> is <code>null</code>, <code>Offer.Checkout</code> renders a &ldquo;Payments
          aren&apos;t set up&rdquo; message, and starting a checkout returns <code>409</code>.
        </li>
        <li>
          Publish the offer. Drafts and archived offers aren&apos;t sold. The page falls back to regular prices
          instead.
        </li>
        <li>
          Set the app&apos;s <code>checkout_url</code> to this page, so share links and{" "}
          <Link href="/docs/sdk">402 upgrade links</Link> point at it.
        </li>
      </ul>

      <H2>How a purchase works</H2>
      <Steps>
        <Step title="Load the offer">
          <p>
            <code>getOffer()</code> on the server, or the provider in the browser, calls{" "}
            <code>GET /apps/:appId/offers/:offerId/public</code>. It never fails for a bad id: it returns the
            requested offer if it can be bought, else the <code>fallback</code> offer, else the plans at their
            regular prices. It also returns the app&apos;s PayPal client id.
          </p>
        </Step>
        <Step title="The buyer picks">
          <p>
            The components keep the selection valid as the buyer changes it: only plans sold for the chosen interval,
            and only bumps that apply to that plan and interval. Totals on the page are for display.
          </p>
        </Step>
        <Step title="The API prices it">
          <p>
            Clicking the PayPal button calls <code>POST /apps/:appId/offers/:offerId/checkout</code> with only the
            selection. The API prices it again from the stored offer, saves the quote on the checkout and creates a
            PayPal subscription for monthly and yearly prices, or a PayPal order for a one-time price.
          </p>
        </Step>
        <Step title="The buyer approves in PayPal">
          <p>
            PayPal&apos;s popup opens with the API&apos;s subscription or order id. On approval the provider calls{" "}
            <code>POST /apps/:appId/checkouts/:checkoutId/complete</code>, which checks the payment with PayPal,
            captures one-time orders and applies the purchase to the account.
          </p>
        </Step>
        <Step title="Confirmed">
          <p>
            While PayPal is still activating a subscription, <code>/complete</code> returns{" "}
            <code>status: &quot;created&quot;</code>. The provider retries every 1.5 seconds, up to 20 times, then
            calls <code>onSuccess</code> with the completed checkout. PayPal&apos;s webhook applies the same purchase
            if the buyer closes the tab first, as long as the API has a public HTTPS URL for PayPal to call.
          </p>
        </Step>
      </Steps>

      <H2>A full checkout page</H2>
      <p>
        Fetch the offer on the server so the page renders with prices, then hand everything to a client component.
        The query string decides what the page sells: <code>?offer=</code> picks the offer, <code>?ref=</code>{" "}
        records who sent the buyer, and <code>?plan=</code> and <code>?interval=</code> preselect a plan.
      </p>
      <Code title="app/pricing/page.tsx" lang="tsx" code={serverPage} />
      <Code title="app/pricing/checkout-form.tsx" lang="tsx" code={clientForm} />
      <p>
        The dashboard&apos;s <code>/demo/checkout</code> page is a styled version of this pattern.
      </p>

      <H2>OfferProvider</H2>
      <Table
        head={["Prop", "Type", "Description"]}
        rows={[
          ["apiUrl", "string", "The Offer API's public URL."],
          ["appId", "string", "The app to sell for."],
          ["publishableKey", "string", "The app's pub_… key. Safe in the browser."],
          ["offerId", "string | null", "The offer to sell, usually from ?offer=. Without it, the plans sell at regular prices."],
          ["fallback", "string | null", "The offer to show when offerId can't be bought."],
          ["initialOffer", "PublicOffer", "The result of getOffer() on the server. Skips the browser fetch."],
          ["account", "string | null", "The signed-in buyer's account id. Without it, the buyer enters an email."],
          ["email", "string | null", "Prefills the email field."],
          ["refCode", "string | null", "Who sent the buyer, usually from ?ref=. Saved on the checkout."],
          ["plan", "string | null", "Preselects a plan."],
          ["interval", "\"month\" | \"year\" | \"once\" | null", "Preselects a billing interval."],
          ["onSuccess", "(checkout: Checkout) => void", "Runs once the API has applied the purchase."],
          ["fetch", "typeof fetch", "Optional custom fetch."],
        ]}
      />
      <Callout title="Pass the account when you know it.">
        Targeted offers are sold to one account only, and the API checks <code>account</code> against them. Without
        an account, the buyer enters an email and the API creates a new account (<code>acct_…</code>) when the payment
        completes. The <code>checkout.completed</code> webhook carries that account in <code>data.account</code>, so
        link it to your user there.
      </Callout>

      <H2>Components</H2>
      <p>
        <code>Offer.*</code> components read from the nearest provider and render plain, unstyled markup. Each takes{" "}
        <code>className</code>. Most also take a function as <code>children</code> to render your own markup with the
        same state.
      </p>
      <Table
        head={["Component", "Props", "Renders"]}
        rows={[
          ["Offer.Status", "children?: (reason, ctx) => ReactNode", "Why the requested offer isn't shown (expired, sold out…). Nothing otherwise."],
          ["Offer.Headline", "children?: (ctx) => ReactNode", "The offer's headline, subhead and bullets, or its name."],
          ["Offer.IntervalToggle", "labels?: Partial<Record<Interval, ReactNode>>", "A radio group of intervals. Hidden when the offer has only one."],
          ["Offer.Plans", "children: (plan) => ReactNode", "One child per plan sold for the selected interval."],
          ["Offer.Plan", "plan, children?: (props: PlanRenderProps) => ReactNode", "A radio button with name, price, renewal terms, description and features."],
          ["Offer.Bumps", "children: (bump) => ReactNode", "One child per bump that applies to the selection. Nothing when none apply."],
          ["Offer.Bump", "bump, children?: (props: BumpRenderProps) => ReactNode", "A checkbox with label, price and description."],
          ["Offer.Summary", "children?: (ctx) => ReactNode", "Line items, the total due today and the renewal terms."],
          ["Offer.Email", "label?, placeholder?", "An email field. Renders nothing when the provider has an account."],
          [
            "Offer.Checkout",
            "onSuccess?, style?, children?: (ctx) => ReactNode",
            <>
              PayPal&apos;s buttons for the selection, plus status and error text. <code>children</code> replaces all of
              it and PayPal&apos;s buttons don&apos;t load, so a custom button calls <code>ctx.redirectToPaypal()</code>.
              See <a href="#paying-on-paypals-page">Paying on PayPal&apos;s page</a>.
            </>,
          ],
        ]}
      />

      <H3>Render props</H3>
      <p>
        <code>Offer.Plan</code> and <code>Offer.Bump</code> do the price formatting for you when you render your own
        markup.
      </p>
      <Code title="A custom plan card" lang="tsx" code={planCard} />
      <Table
        head={["PlanRenderProps", "Type", "Description"]}
        rows={[
          ["plan", "OfferPlan", "The plan, with benefits, extras and prices."],
          ["price", "OfferPrice", "amount, list_price, cycles and then for the selected interval."],
          ["interval, currency", "Interval, string", "The selected interval and the offer's currency."],
          ["selected, select()", "boolean, () => void", "Whether it's selected, and how to select it."],
          ["priceText", "string", "\"$10/mo\""],
          ["listPriceText", "string | null", "The regular price when discounted, else null."],
          ["renewalText", "string | null", "\"for 3 months, then $20/mo\", or null when the price never changes."],
          ["savings", "number | null", "Percent off the regular price."],
        ]}
      />
      <Table
        head={["BumpRenderProps", "Type", "Description"]}
        rows={[
          ["bump", "OfferBump", "label, description, amount and the add-ons it grants."],
          ["selected", "boolean", "Whether it's in the selection."],
          ["toggle(on?)", "(on?: boolean) => void", "Adds or removes it."],
          ["priceText", "string", "\"+$50\""],
        ]}
      />

      <H3>Styling</H3>
      <p>
        The default markup carries its state in <code>data-*</code> attributes, so you can style it from a stylesheet
        without render props.
      </p>
      <Code title="checkout.css" lang="text" code={dataCss} />
      <Table
        head={["Attribute", "On"]}
        rows={[
          ["data-selected", "The selected interval button, plan and bump."],
          ["data-featured", "Plans marked featured in the catalog."],
          ["data-offer-plan", "Each plan, set to its id."],
          ["data-offer-bump", "Each bump, set to its id."],
          ["data-part", "Inner parts: name, price, renewal, description, features, label, total."],
          ["data-phase", "Offer.Checkout's wrapper: the checkout phase."],
          ["data-offer-status", "Offer.Status, set to the reason."],
          ["data-error", "Error text inside Offer.Checkout."],
        ]}
      />

      <H2>useOffer()</H2>
      <p>
        Everything the provider knows, for a fully custom checkout. Call it inside the checkout{" "}
        <code>OfferProvider</code>.
      </p>
      <Table
        head={["Field", "Type", "Description"]}
        rows={[
          ["offer", "PublicOffer | null", "The resolved offer. resolved_from says whether it is the requested offer, the fallback or regular prices."],
          ["isLoading, error", "boolean, Error | null", "State of the browser fetch. Always settled with initialOffer."],
          ["selection", "{ plan, interval, bumps }", "The current selection."],
          ["summary", "Summary | null", "plan, price, bumps, totalToday, renewal and ready (a plan with a price above zero)."],
          ["bumps", "OfferBump[]", "Bumps that apply to the selection."],
          ["selectPlan(planId)", "(planId: string) => void", "Selects a plan. The provider keeps the selection valid."],
          ["setInterval(interval)", "(interval: Interval) => void", "Switches the interval, and the plan if it isn't sold for it."],
          ["toggleBump(bumpId, on?)", "(bumpId: string, on?: boolean) => void", "Adds or removes a bump."],
          ["account", "string | null", "The account passed to the provider."],
          ["email, setEmail", "string, (email: string) => void", "The email field's value, when there is no account."],
          ["phase", "CheckoutPhase", "idle, starting, approving, confirming, completed or failed."],
          ["checkout, checkoutError", "Checkout | null, string | null", "The checkout record and the last error message."],
          ["startCheckout()", "() => Promise<Checkout>", "Creates the checkout on the API. Offer.Checkout calls it for you."],
          ["confirm()", "() => Promise<Checkout | null>", "After approval: completes the checkout, retrying while PayPal activates."],
          ["redirectToPaypal()", "() => Promise<void>", "Starts the checkout and sends the buyer to PayPal's page instead of the popup."],
          ["cancel(), fail(err)", "functions", "Back to idle, or into the failed phase with a message."],
          ["client", "CheckoutClient", "The underlying client."],
        ]}
      />

      <H3>Paying on PayPal&apos;s page</H3>
      <p>
        <code>redirectToPaypal()</code> is for flows where a popup doesn&apos;t fit. It creates the checkout with a
        return URL of the current page plus <code>?offer_checkout=return</code>, remembers the checkout id in{" "}
        <code>sessionStorage</code> and leaves for PayPal. When the buyer comes back, the provider removes PayPal&apos;s
        query parameters from the URL and confirms the checkout. A cancelled approval comes back with{" "}
        <code>?offer_checkout=cancel</code> and nothing happens.
      </p>
      <Code title="components/pay-on-paypal.tsx" lang="tsx" code={customButton} />

      <H2>What the browser sends</H2>
      <p>
        The browser sends ids, never prices. The API looks up the offer, checks it can still be bought by this buyer,
        and prices the plan, interval and bumps itself. A request for an offer that can&apos;t be bought returns{" "}
        <code>409</code> with a <code>reason</code>.
      </p>
      <Code title="POST /apps/:appId/offers/launch_50/checkout" lang="json" code={startBody} />
      <Code title="201 Created" lang="json" code={checkoutRow} />
      <p>
        Every checkout keeps the quote it was given. Editing the offer later changes future purchases only, and
        buyers keep the price and extras they bought. <code>approve_url</code> is PayPal&apos;s approval page, used by{" "}
        <code>redirectToPaypal()</code> and by links the API creates for 402 responses.
      </p>
      <p>
        To sell one plan at its regular price without an offer, call{" "}
        <code>POST /apps/:appId/plans/:planId/checkout</code>. It takes the same body without <code>plan</code> and{" "}
        <code>bumps</code>. On the page, leave out <code>offerId</code> and pass <code>plan</code>.
      </p>

      <H2>Share links and ?ref=</H2>
      <p>
        An offer&apos;s link is your checkout page with its id in the query string. Add <code>ref</code> to tell
        partners and campaigns apart:
      </p>
      <Code lang="text" code="https://blog.example.com/pricing?offer=launch_50&ref=newsletter" />
      <p>
        Pass <code>ref</code> to the provider as <code>refCode</code> and to <code>getOffer()</code> as{" "}
        <code>ref</code>. The API counts the page view against the offer, saves the ref on the checkout, includes it
        in the <code>checkout.completed</code> webhook and on the account&apos;s subscription, and breaks down{" "}
        <code>GET /apps/:appId/offers/:offerId/stats</code> by ref. Refs are at most 100 characters.
      </p>
      <p>
        The dashboard builds these links for you on the offer page, from the app&apos;s <code>checkout_url</code>.
        Until you set one, its links point at the dashboard&apos;s own <code>/demo/checkout</code> page. See{" "}
        <Link href="/docs/admin/offers">Offers</Link>.
      </p>

      <H2>Previewing a draft</H2>
      <p>
        Drafts can&apos;t be bought, and publishing needs PayPal. To see a draft on your real page, send its fields to{" "}
        <code>POST /apps/:appId/offers/draft-preview</code> with the secret key from your server, and pass the result
        as <code>initialOffer</code>. Nothing is stored.
      </p>

      <H2>Helpers</H2>
      <p>
        The entry point also exports the pure functions the components use, for building your own UI:{" "}
        <code>formatMoney</code>, <code>priceLabel</code>, <code>renewalLabel</code>, <code>savings</code>,{" "}
        <code>summarize</code>, <code>plansFor</code>, <code>availableBumps</code>, <code>normalize</code>,{" "}
        <code>initialSelection</code>, <code>planPrice</code> and <code>INTERVAL_LABELS</code>. The{" "}
        <code>CheckoutClient</code> class wraps the four checkout routes: <code>getOffer</code>,{" "}
        <code>startCheckout</code>, <code>completeCheckout</code> and <code>getCheckout</code>.
      </p>
    </>
  );
}
