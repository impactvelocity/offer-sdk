import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/section-heading";
import { OrderSummary } from "@/components/what-you-get/order-summary";
import {
  AdminVisual,
  ApiVisual,
  CancelVisual,
  CheckoutVisual,
  Checkmark,
  McpVisual,
  PayPalVisual,
  PostmanVisual,
  RenderVisual,
  ZapierVisual,
} from "@/components/what-you-get/visuals";

export const metadata: Metadata = {
  title: "What you get",
  description:
    "The Offer API, the admin app, an MCP server, PayPal checkout and agentic cancel flows, plus four bonuses. Free, open source and self-hostable.",
};

type Benefit = { title: string; body: ReactNode };

const products: { id: string; name: string; title: string; lead: string; visual: ReactNode; benefits: Benefit[] }[] = [
  {
    id: "api",
    name: "Offer API",
    title: "One API for plans, access and offers.",
    lead: "Your app asks what an account can do and gets one answer.",
    visual: <ApiVisual />,
    benefits: [
      {
        title: "One call for access.",
        body: "The full plan merges the account's plan, offer extras and incentive into one list of features and limits.",
      },
      {
        title: "Usage metering.",
        body: "Count credits, seats and storage against each limit. At the limit, the API answers 402 with an upgrade and a checkout link.",
      },
      {
        title: "Signed webhooks.",
        body: "Plan changes, limit warnings and cancel saves, signed to the Standard Webhooks spec and retried when delivery fails.",
      },
      {
        title: "Keys for each side.",
        body: "A publishable key for the browser, a secret key for your server and short-lived account tokens for cancel flows.",
      },
      {
        title: "React SDK.",
        body: "Hooks and gates for access checks, plus headless checkout and cancel flow components you style like your app.",
      },
      {
        title: "OpenAPI spec.",
        body: (
          <>
            Browse every endpoint at <code className="font-mono text-xs">/docs</code> or generate a client from{" "}
            <code className="font-mono text-xs">/openapi.json</code>.
          </>
        ),
      },
    ],
  },
  {
    id: "admin",
    name: "Admin app",
    title: "A dashboard for everything you sell.",
    lead: "Change a plan or a limit and the next API call has it. No deploy.",
    visual: <AdminVisual />,
    benefits: [
      { title: "Catalog.", body: "Plans, entitlements, add-ons and incentives, each with its own record page." },
      { title: "Accounts.", body: "Look up any customer's plan, usage and incentive, and change them by hand." },
      { title: "Offers.", body: "Build an offer against a live checkout preview, then share its link with a ref for each partner." },
      { title: "Analytics.", body: "Usage per feature, accounts by plan and your heaviest users over time." },
      {
        title: "Agent.",
        body: "Ask about accounts and usage in plain English, or have it draft plans and incentives. Nothing changes until you approve.",
      },
      { title: "Workspaces.", body: "Invite your team, and keep each app's keys, webhooks and PayPal connection apart." },
    ],
  },
  {
    id: "mcp",
    name: "MCP server",
    title: "Your offers and entitlements in any agent.",
    lead: "Connect any AI assistant or coding agent to your app.",
    visual: <McpVisual />,
    benefits: [
      {
        title: "Every endpoint is a tool.",
        body: "Accounts, plans, entitlements, incentives, usage and webhooks, with the same parameters as the API.",
      },
      {
        title: "Access per connection.",
        body: "Read only, read and write, or full access. Clients ask before they run anything that deletes.",
      },
      { title: "OAuth or a key.", body: "Sign in with OAuth from chat apps, or use a secret key in coding agents." },
      {
        title: "Prompts included.",
        body: "Review your catalog, investigate an account, launch an incentive or debug a webhook in one step.",
      },
      { title: "Resources.", body: "Your catalog, pricing cards and recent events, ready to read as context." },
      { title: "Activity log.", body: "See which client called which tool, with its arguments and result." },
    ],
  },
  {
    id: "checkout",
    name: "PayPal checkout",
    title: "Sell any offer through PayPal.",
    lead: "Each link carries its own prices, bumps and extra entitlements.",
    visual: <CheckoutVisual />,
    benefits: [
      {
        title: "One page for every offer.",
        body: "Build your checkout once from SDK components, then pass a different offer for each ad, partner or promo.",
      },
      {
        title: "Monthly, yearly or once.",
        body: "Each plan in an offer gets its own price per interval, plus order bumps charged with the first payment.",
      },
      { title: "Prices checked on the server.", body: "Every selection is priced again before it reaches PayPal." },
      {
        title: "Access on payment.",
        body: "PayPal's webhook moves the account to its plan and grants the offer's extra entitlements.",
      },
      {
        title: "Offers that change.",
        body: "Edit an offer's prices or extras and the live link follows. Set an end date and it stops selling.",
      },
      { title: "Partner credit.", body: "Add a ref to any link and each sale is credited to that partner." },
    ],
  },
  {
    id: "cancel",
    name: "Cancel flow",
    title: "A cancel flow that makes the save offer.",
    lead: "An agent picks one for each customer, and PayPal takes the approval.",
    visual: <CancelVisual />,
    benefits: [
      {
        title: "Your questions.",
        body: "Set the reasons and steps in the dashboard. Your app code doesn't change.",
      },
      {
        title: "Agentic save offers.",
        body: "The agent reads the account's usage and reason, then picks a discount, pause, downgrade or incentive.",
      },
      { title: "Guardrails on the server.", body: "You cap what it can offer, and the API checks every pick against your caps." },
      {
        title: "Approved in PayPal.",
        body: "Discounts and downgrades open PayPal for the customer to approve. Nothing changes without it.",
      },
      {
        title: "Pauses that end on time.",
        body: "A Render Workflow suspends the subscription and resumes it on the date you set.",
      },
      {
        title: "Save rate per reason.",
        body: "See why customers leave, which offers they take and how much monthly revenue you kept.",
      },
    ],
  },
];

const bonuses: { name: string; body: string; visual: ReactNode }[] = [
  {
    name: "Zapier connection",
    body: "Send any event to a Zap. Recipes post to Slack, add accounts to your CRM and email customers at their limit.",
    visual: <ZapierVisual />,
  },
  {
    name: "Postman collection",
    body: "Every endpoint ready to call, with example bodies and your keys as variables.",
    visual: <PostmanVisual />,
  },
  {
    name: "Simple PayPal setup",
    body: "Paste a client ID and secret. The API checks them and registers its own webhook with PayPal.",
    visual: <PayPalVisual />,
  },
  {
    name: "Render deploy",
    body: "One Blueprint puts the API, the dashboard, workflows and Postgres on your own Render account. You own the data.",
    visual: <RenderVisual />,
  },
];

const terms: { title: string; body: string }[] = [
  { title: "Free.", body: "No card, no seat fees and no usage limits from us." },
  { title: "Open source.", body: "Read, fork and change every line on GitHub." },
  { title: "Self-hostable.", body: "Runs on your Render account, with your own Postgres." },
];

export default function WhatYouGetPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-brand-glow" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-16 sm:px-6 sm:pt-32">
          <h1 className="max-w-4xl font-display text-4xl font-medium tracking-wider text-balance sm:text-5xl lg:text-6xl">
            <span className="text-fg">What you get.</span>{" "}
            <span className="text-neon">Five products and four bonuses.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-tertiary">
            Offer SDK is open source and self-hostable. Check out below for $0, then deploy the whole stack to your own
            Render account.
          </p>
          <dl className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {terms.map((t) => (
              <div key={t.title} className="bg-canvas p-5">
                <dt className="inline font-medium text-fg">{t.title}</dt>{" "}
                <dd className="inline text-fg-muted">{t.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {products.map((p) => (
              <article key={p.id} id={p.id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-panel">
                {/* The card's top row reads like a cart line item. */}
                <div className="flex h-12 items-center justify-between gap-4 border-b border-border px-6">
                  <h2 className="font-medium text-fg">{p.name}</h2>
                  <span className="font-mono text-xs text-fg-tertiary">Qty 1 · Included</span>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="max-w-xl font-display text-xl font-medium tracking-wider text-balance sm:text-2xl">
                    <span className="text-fg">{p.title}</span> <span className="text-fg-muted">{p.lead}</span>
                  </p>
                  <div className="mt-8">{p.visual}</div>
                  <ul className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                    {p.benefits.map((b) => (
                      <li key={b.title} className="bg-panel p-4 text-sm">
                        <span className="font-medium text-fg">{b.title}</span>{" "}
                        <span className="text-fg-muted">{b.body}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}

            <section id="bonuses" aria-labelledby="bonuses-title" className="scroll-mt-20 pt-12">
              <SectionHeading
                title={<span id="bonuses-title">Plus four bonuses.</span>}
                lead="Added to your order at no charge."
              />
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {bonuses.map((b) => (
                  // Drawn as order bumps: dashed border, box already ticked.
                  <article key={b.name} className="flex flex-col rounded-2xl border border-dashed border-accent/40 bg-panel p-5">
                    <div className="flex gap-3">
                      <Checkmark />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-medium text-fg">{b.name}</h3>
                          <span className="shrink-0 font-mono text-xs text-accent-fg">
                            Free<span className="sr-only">, added to your order</span>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-fg-muted">{b.body}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-5">{b.visual}</div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Sticky only where the whole card, buttons included, fits on screen. */}
          <OrderSummary
            products={products}
            bonuses={bonuses}
            className="lg:top-20 lg:[@media(min-height:860px)]:sticky"
          />
        </div>
      </div>
    </>
  );
}
