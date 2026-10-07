export type DocsLink = { title: string; href: string; description: string };
export type DocsGroup = { title: string; items: DocsLink[] };

/** The docs sidebar, in reading order. The pager and the overview page read from this too. */
export const DOCS_NAV: DocsGroup[] = [
  {
    title: "Getting started",
    items: [
      { title: "Overview", href: "/docs", description: "What Offer SDK is and how the pieces fit." },
      { title: "Quickstart", href: "/docs/quickstart", description: "Run the stack locally and check your first entitlement." },
      { title: "Project structure", href: "/docs/structure", description: "The monorepo, the services, and how a request moves through them." },
      { title: "Core concepts", href: "/docs/concepts", description: "Apps, accounts, plans, entitlements, add-ons, incentives and offers." },
      { title: "AI features", href: "/docs/ai", description: "AI picks save offers and runs the dashboard agent." },
    ],
  },
  {
    title: "Deploy",
    items: [
      { title: "Deploy on Render", href: "/docs/deploy", description: "Ship the API, dashboard, workflows and database from one Blueprint." },
      { title: "Environment variables", href: "/docs/deploy/environment", description: "Every variable each service reads, and which ones you set." },
    ],
  },
  {
    title: "Sponsors",
    items: [
      { title: "How sponsors are used", href: "/docs/sponsors", description: "Where each hackathon sponsor sits in the product." },
      { title: "PayPal", href: "/docs/sponsors/paypal", description: "Checkout, subscriptions, plan changes and webhooks." },
      { title: "Render", href: "/docs/sponsors/render", description: "The Blueprint, private networking and Workflows for pauses." },
      { title: "Zapier", href: "/docs/sponsors/zapier", description: "Send Offer events to other apps without writing code." },
      { title: "Postman", href: "/docs/sponsors/postman", description: "A collection for every API route, with a runnable quickstart." },
    ],
  },
  {
    title: "React SDK",
    items: [
      { title: "Access and entitlements", href: "/docs/sdk", description: "Read what an account can use and gate features." },
      { title: "Checkout", href: "/docs/sdk/checkout", description: "Build one checkout page for every offer." },
      { title: "Cancel flows", href: "/docs/sdk/cancel-flows", description: "Ask why, offer a save, and cancel or pause in PayPal." },
    ],
  },
  {
    title: "API",
    items: [
      { title: "Authentication", href: "/docs/api", description: "Base URL, keys, account tokens and errors." },
      { title: "Endpoint reference", href: "/docs/api/reference", description: "Every route, grouped by resource." },
      { title: "Webhooks", href: "/docs/api/webhooks", description: "Events, signatures and retries." },
      { title: "MCP server", href: "/docs/api/mcp", description: "Connect AI assistants and coding agents with OAuth or a key." },
    ],
  },
  {
    title: "Dashboard",
    items: [
      { title: "Dashboard tour", href: "/docs/admin", description: "Workspaces, apps and where everything lives." },
      { title: "Catalog", href: "/docs/admin/catalog", description: "Plans, entitlements, add-ons and incentives." },
      { title: "Offers", href: "/docs/admin/offers", description: "Build offers, preview checkout and share links." },
      { title: "Cancel flows", href: "/docs/admin/cancel-flows", description: "Steps, questions and save offers, with a live preview." },
      { title: "Agent and MCP", href: "/docs/admin/agent", description: "Change the catalog by chatting, and manage the app's MCP server." },
      { title: "Keys and webhooks", href: "/docs/admin/developers", description: "API keys, webhook endpoints and delivery logs." },
    ],
  },
];

export const DOCS_PAGES = DOCS_NAV.flatMap((group) => group.items);

/** Matches a trailing slash too, so `/docs/` still lights up Overview. */
export const isCurrent = (href: string, pathname: string) => pathname.replace(/\/$/, "") === href;
