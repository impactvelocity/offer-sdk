// Code snippets for the integration guide, generated from the app's real base URL, app ID,
// catalog ids and (optionally) keys.

import type { DevContext, Examples } from "./use-dev-context";

export interface SnippetContext {
  baseUrl: string;
  appId: string;
  appName: string;
  secretKey: string;
  publicKey: string;
  /** Inline the real keys instead of environment variables. */
  real: boolean;
  ex: Examples;
  /** First boolean entitlement (feature flag), if the app has one. */
  flag: string;
  /** Display name of `ex.usageEntitlement`. */
  usageName: string;
}

/** Builds the snippet context from the developer context, once the app and base URL have loaded. */
export function toSnippetContext(ctx: DevContext, real: boolean): SnippetContext | null {
  if (!ctx.app || !ctx.baseUrl) return null;
  const usage = ctx.entitlements.find((e) => e.id === ctx.examples.usageEntitlement);
  return {
    baseUrl: ctx.baseUrl,
    appId: ctx.appId,
    appName: ctx.app.name,
    secretKey: ctx.app.api_key,
    publicKey: ctx.app.public_key,
    real,
    ex: ctx.examples,
    flag: ctx.entitlements.find((e) => e.type === "boolean")?.id ?? "export_pdf",
    usageName: usage?.name ?? "AI credits",
  };
}

type KeyKind = "secret" | "public";

/** Just enough context to build request URLs and auth headers. */
export type ApiContext = Pick<SnippetContext, "baseUrl" | "appId" | "secretKey" | "publicKey" | "real">;

export const ENV = { secret: "OFFER_SECRET_KEY", public: "NEXT_PUBLIC_OFFER_PUBLIC_KEY", shellPublic: "OFFER_PUBLIC_KEY" };

export function maskKey(key: string) {
  return key ? `${key.slice(0, 8)}${"•".repeat(12)}${key.slice(-4)}` : "";
}

const appUrl = (c: ApiContext) => `${c.baseUrl}/apps/${c.appId}`;
const keyValue = (c: ApiContext, kind: KeyKind) => (kind === "secret" ? c.secretKey : c.publicKey);

/** Key as used in a shell command. */
function shellKey(c: ApiContext, kind: KeyKind) {
  if (c.real) return keyValue(c, kind);
  return kind === "secret" ? `$${ENV.secret}` : `$${ENV.shellPublic}`;
}

/** Authorization header value as a JS expression. */
function jsAuth(c: ApiContext, kind: KeyKind) {
  if (c.real) return JSON.stringify(`Bearer ${keyValue(c, kind)}`);
  return `\`Bearer \${process.env.${kind === "secret" ? ENV.secret : ENV.public}}\``;
}

/** Key constant initialiser in TypeScript files. */
function tsKey(c: ApiContext, kind: KeyKind) {
  if (c.real) return JSON.stringify(keyValue(c, kind));
  return `process.env.${kind === "secret" ? ENV.secret : ENV.public}!`;
}

/** `{ "id": "usr_42", "plan": "free" }` on one line. */
function inlineJson(body: Record<string, unknown>) {
  return `{ ${Object.entries(body)
    .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
    .join(", ")} }`;
}

function curl(c: ApiContext, method: string, path: string, kind: KeyKind, body?: Record<string, unknown>) {
  const lines = [
    `curl${method === "GET" ? "" : ` -X ${method}`} "${appUrl(c)}${path}"`,
    `  -H "Authorization: Bearer ${shellKey(c, kind)}"`,
  ];
  if (body) lines.push(`  -H "Content-Type: application/json"`, `  -d '${inlineJson(body)}'`);
  return lines.join(" \\\n");
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

// ---------------------------------------------------------------------------
// 1. Keys & base URL

export function envFile(c: SnippetContext) {
  const secret = c.real ? c.secretKey : maskKey(c.secretKey);
  const pub = c.real ? c.publicKey : maskKey(c.publicKey);
  return `# Server only: full access to ${c.appName}. Never expose it to the browser.
${ENV.secret}=${secret}

# Browser-safe: reads plans and pricing, tracks usage.
${ENV.public}=${pub}`;
}

export function shellExports(c: SnippetContext) {
  const secret = c.real ? c.secretKey : maskKey(c.secretKey);
  const pub = c.real ? c.publicKey : maskKey(c.publicKey);
  return `# Lets you paste the cURL examples on this page as-is
export ${ENV.secret}="${secret}"
export ${ENV.shellPublic}="${pub}"`;
}

// ---------------------------------------------------------------------------
// 2. Create an account

export function createAccount(c: SnippetContext) {
  const body = { id: "usr_42", name: "Ada Lovelace", plan: c.ex.freePlan };
  return [
    { label: "cURL", lang: "bash" as const, code: curl(c, "POST", "/namespaces", "secret", body) },
    {
      label: "JavaScript",
      lang: "ts" as const,
      code: `// On sign-up, from your server
const OFFER_API = "${appUrl(c)}";

const res = await fetch(\`\${OFFER_API}/namespaces\`, {
  method: "POST",
  headers: {
    Authorization: ${jsAuth(c, "secret")},
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ id: user.id, name: user.name, plan: "${c.ex.freePlan}" }),
});

// 409 means the account already exists, so retries are safe.
if (!res.ok && res.status !== 409) {
  throw new Error(\`Offer API \${res.status}: \${(await res.json()).error}\`);
}`,
    },
    {
      label: "Response · 201",
      lang: "json" as const,
      code: json({
        id: "usr_42",
        app_id: c.appId,
        name: "Ada Lovelace",
        plan: c.ex.freePlan,
        incentive: null,
        created_at: "2026-10-03T09:30:00.000Z",
      }),
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. Check what they can do

export function checkAccess(c: SnippetContext) {
  const ent = c.ex.usageEntitlement;
  return [
    { label: "cURL", lang: "bash" as const, code: curl(c, "GET", `/namespaces/${c.ex.account}/plan`, "public") },
    {
      label: "JavaScript (server)",
      lang: "ts" as const,
      code: `// Before doing the work, e.g. in an API route
const OFFER_API = "${appUrl(c)}";

const res = await fetch(\`\${OFFER_API}/namespaces/\${accountId}/plan\`, {
  headers: { Authorization: ${jsAuth(c, "secret")} },
});
const access = await res.json();

const ${camel(ent)} = access.entitlements.find((e) => e.id === "${ent}");
if (!${camel(ent)}?.can) {
  return Response.json({ error: "Upgrade to continue" }, { status: 402 });
}`,
    },
  ];
}

export function reactHook(c: SnippetContext) {
  const ent = c.ex.usageEntitlement;
  return [
    {
      label: "use-offer-plan.tsx",
      lang: "tsx" as const,
      code: `"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const OFFER_API = "${appUrl(c)}";
const PUBLIC_KEY = ${tsKey(c, "public")};

export interface Entitlement {
  id: string;
  name: string;
  type: "usage" | "boolean";
  usage: number;
  max: number | null; // null = unlimited
  left: number | null; // null = unlimited
  can: boolean;
}

export interface OfferPlan {
  plan: { id: string; name: string; description: string | null; isFree: boolean; meta: Record<string, unknown> };
  incentive: string | null;
  addons: string[];
  entitlements: Entitlement[];
}

export function useOfferPlan(accountId: string | undefined) {
  const [data, setData] = useState<OfferPlan | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(\`\${OFFER_API}/namespaces/\${encodeURIComponent(accountId)}/plan\`, {
        headers: { Authorization: \`Bearer \${PUBLIC_KEY}\` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? \`Offer API \${res.status}\`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const find = (id: string) => data?.entitlements.find((e) => e.id === id);

  return {
    plan: data,
    error,
    loading: !data && !error,
    refresh,
    /** Can the account use this right now? Not on their plan = false. */
    can: (id: string) => find(id)?.can ?? false,
    /** Remaining quota: null = unlimited, 0 when not granted. */
    left: (id: string) => {
      const e = find(id);
      return e ? e.left : 0;
    },
    hasAddon: (id: string) => data?.addons.includes(id) ?? false,
  };
}

export function Gate({
  accountId,
  entitlement,
  fallback = null,
  children,
}: {
  accountId: string;
  entitlement: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, loading } = useOfferPlan(accountId);
  if (loading) return null;
  return <>{can(entitlement) ? children : fallback}</>;
}`,
    },
    {
      label: "Usage",
      lang: "tsx" as const,
      code: `import { Gate, useOfferPlan } from "./use-offer-plan";

// Feature flag: render only when the plan (or an offer) includes it
<Gate accountId={user.id} entitlement="${c.flag}" fallback={<UpgradeButton />}>
  <ExportButton />
</Gate>;

// Usage limit: show what's left and stop at the cap
function ${pascal(ent)}Button({ accountId }: { accountId: string }) {
  const { can, left } = useOfferPlan(accountId);
  const remaining = left("${ent}");
  return (
    <button disabled={!can("${ent}")}>
      ${c.usageName}: {remaining === null ? "unlimited" : \`\${remaining} left\`}
    </button>
  );
}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Track usage

export function trackUsage(c: SnippetContext) {
  const ent = c.ex.usageEntitlement;
  const path = `/namespaces/${c.ex.account}/usage/${ent}`;
  return [
    { label: "Add 1", lang: "bash" as const, code: curl(c, "POST", `${path}/add`, "public") },
    { label: "Remove 1", lang: "bash" as const, code: `# Secret key only\n${curl(c, "POST", `${path}/remove`, "secret")}` },
    {
      label: "Add amount",
      lang: "bash" as const,
      code: `# Adds to the count (negative amounts subtract, with the secret key only)\n${curl(c, "POST", `${path}/amount`, "public", { amount: 25 })}`,
    },
    {
      label: "JavaScript (server)",
      lang: "ts" as const,
      code: `const OFFER_API = "${appUrl(c)}";

// "add" = +1, "remove" = -1, "amount" = +amount (may be negative)
export async function trackUsage(accountId, entitlement, operation = "add", amount) {
  const res = await fetch(
    \`\${OFFER_API}/namespaces/\${encodeURIComponent(accountId)}/usage/\${entitlement}/\${operation}\`,
    {
      method: "POST",
      headers: {
        Authorization: ${jsAuth(c, "secret")},
        "Content-Type": "application/json",
      },
      body: operation === "amount" ? JSON.stringify({ amount }) : undefined,
    },
  );
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { entitlement, count }
}

await trackUsage(user.id, "${ent}");
await trackUsage(user.id, "${ent}", "amount", 25);`,
    },
    { label: "Response", lang: "json" as const, code: json({ entitlement: ent, count: 26 }) },
  ];
}

// ---------------------------------------------------------------------------
// 5. Billing webhooks

export function billingWebhook(c: SnippetContext) {
  return [
    {
      label: "Stripe webhook (Next.js)",
      lang: "ts" as const,
      code: `// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const OFFER_API = "${appUrl(c)}";
const SECRET_KEY = ${tsKey(c, "secret")};

async function offer(method: string, path: string, body?: unknown) {
  const res = await fetch(\`\${OFFER_API}\${path}\`, {
    method,
    headers: { Authorization: \`Bearer \${SECRET_KEY}\`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(\`Offer API \${res.status}: \${(await res.json()).error}\`);
  return res.json();
}

export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get("stripe-signature")!,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "checkout.session.completed": {
      // Set client_reference_id (your account ID) and metadata.plan when you create the session.
      const session = event.data.object;
      await offer("PATCH", \`/namespaces/\${session.client_reference_id}\`, {
        plan: session.metadata?.plan ?? "${c.ex.plan}",
      });
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await offer("PATCH", \`/namespaces/\${subscription.metadata.account_id}\`, { plan: "${c.ex.freePlan}" });
      break;
    }
  }

  return Response.json({ received: true });
}`,
    },
    {
      label: "Change plan",
      lang: "bash" as const,
      code: curl(c, "PATCH", `/namespaces/${c.ex.account}`, "secret", { plan: c.ex.plan }),
    },
    {
      label: "Apply an offer",
      lang: "bash" as const,
      code: curl(c, "PATCH", `/namespaces/${c.ex.account}`, "secret", { incentive: c.ex.incentive }),
    },
    {
      label: "Remove an offer",
      lang: "bash" as const,
      code: curl(c, "DELETE", `/namespaces/${c.ex.account}/incentive`, "secret"),
    },
  ];
}

// ---------------------------------------------------------------------------
// 6. Pricing page

export function pricing(c: SnippetContext) {
  return [
    { label: "cURL", lang: "bash" as const, code: curl(c, "GET", "/plans/pricing", "public") },
    {
      label: "React",
      lang: "tsx" as const,
      code: `"use client";

import { useEffect, useState } from "react";

const OFFER_API = "${appUrl(c)}";
const PUBLIC_KEY = ${tsKey(c, "public")};

interface PricingCard {
  plan_id: string;
  isFree: boolean;
  title: string;
  description?: string | null;
  benefits: { id: string; title: string }[];
  featured?: boolean;
  type?: "subscription" | "one_time";
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  price?: number | null;
  currency: string;
}

export function PricingTable({ yearly = false }: { yearly?: boolean }) {
  const [cards, setCards] = useState<PricingCard[]>([]);

  useEffect(() => {
    fetch(\`\${OFFER_API}/plans/pricing\`, { headers: { Authorization: \`Bearer \${PUBLIC_KEY}\` } })
      .then((res) => res.json())
      .then(setCards);
  }, []);

  return (
    <div className="pricing">
      {cards.map((card) => {
        const amount = card.type === "one_time" ? card.price : yearly ? card.yearlyPrice : card.monthlyPrice;
        const price = new Intl.NumberFormat("en", { style: "currency", currency: card.currency }).format(amount ?? 0);
        return (
          <article key={card.plan_id} data-featured={card.featured || undefined}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <strong>{card.isFree ? "Free" : price}</strong>
            <ul>
              {card.benefits.map((b) => (
                <li key={b.id}>{b.title}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 7. One entitlement or add-on (the "SDK usage" tab in their edit dialogs)

/** Server-side fetch of an account's resolved plan, shared by the per-item snippets. */
function fetchPlan(c: ApiContext) {
  return `const OFFER_API = "${appUrl(c)}";

const res = await fetch(\`\${OFFER_API}/namespaces/\${accountId}/plan\`, {
  headers: { Authorization: ${jsAuth(c, "secret")} },
});`;
}

export function entitlementUsage(c: ApiContext, ent: { id: string; name: string; type: "usage" | "boolean" }) {
  const v = camel(ent.id);
  const react =
    ent.type === "usage"
      ? `import { useOfferPlan } from "./use-offer-plan";

function ${pascal(ent.id)}Button({ accountId }: { accountId: string }) {
  const { can, left } = useOfferPlan(accountId);
  const remaining = left("${ent.id}"); // null = unlimited

  return (
    <button disabled={!can("${ent.id}")}>
      ${ent.name}: {remaining === null ? "unlimited" : \`\${remaining} left\`}
    </button>
  );
}`
      : `import { Gate, useOfferPlan } from "./use-offer-plan";

// Render only when the account's plan (or an incentive) includes it
<Gate accountId={user.id} entitlement="${ent.id}" fallback={<UpgradeButton />}>
  <${pascal(ent.id)} />
</Gate>;

// Or check it inline
const { can } = useOfferPlan(user.id);
const has${pascal(ent.id)} = can("${ent.id}");`;

  const tabs = [
    { label: "React", lang: "tsx" as const, code: react },
    {
      label: "Server check",
      lang: "ts" as const,
      code: `// Repeat the check before doing anything that costs you
${fetchPlan(c)}
const { entitlements } = await res.json();

const ${v} = entitlements.find((e) => e.id === "${ent.id}");
if (!${v}?.can) {
  return Response.json({ error: "Upgrade to continue" }, { status: 402 });
}`,
    },
  ];
  if (ent.type === "usage") {
    const path = `/namespaces/\${accountId}/usage/${ent.id}`;
    tabs.push({
      label: "Track usage",
      lang: "ts" as const,
      code: `const OFFER_API = "${appUrl(c)}";
const headers = { Authorization: ${jsAuth(c, "secret")}, "Content-Type": "application/json" };

// After the work succeeds: count one use
await fetch(\`\${OFFER_API}${path}/add\`, { method: "POST", headers });

// Or a specific amount (negative amounts subtract)
await fetch(\`\${OFFER_API}${path}/amount\`, {
  method: "POST",
  headers,
  body: JSON.stringify({ amount: 25 }),
});`,
    });
  }
  return tabs;
}

export function addonUsage(c: ApiContext, addon: { id: string; name: string }) {
  return [
    {
      label: "React",
      lang: "tsx" as const,
      code: `import { useOfferPlan } from "./use-offer-plan";

function ${pascal(addon.id)}Section({ accountId }: { accountId: string }) {
  const { hasAddon, loading } = useOfferPlan(accountId);
  if (loading) return null;

  return hasAddon("${addon.id}") ? <${pascal(addon.id)} /> : <UpgradeButton addon="${addon.id}" />;
}`,
    },
    {
      label: "Server check",
      lang: "ts" as const,
      code: `// Add-ons come from the plan plus any incentive on the account
${fetchPlan(c)}
const { addons } = await res.json();

if (!addons.includes("${addon.id}")) {
  return Response.json({ error: "${addon.name} isn't included" }, { status: 402 });
}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 8. Frontend examples per catalog page (the "Use SDK" drawers)

export function planSdk(c: SnippetContext) {
  return [
    {
      label: "Current plan",
      lang: "tsx" as const,
      code: `import { useOfferPlan } from "./use-offer-plan";

function PlanBadge({ accountId }: { accountId: string }) {
  const { plan: access, loading } = useOfferPlan(accountId);
  if (loading || !access) return null;

  return (
    <div>
      <span>{access.plan.name}</span>
      {access.plan.isFree ? <a href="/pricing">Upgrade</a> : null}
    </div>
  );
}

// Public plan metadata (private keys are stripped):
// access.plan.meta`,
    },
    { ...pricing(c)[1], label: "Pricing page" },
  ];
}

export function incentiveSdk(c: SnippetContext) {
  return [
    {
      label: "Active offer",
      lang: "tsx" as const,
      code: `import { useOfferPlan } from "./use-offer-plan";

function OfferBanner({ accountId }: { accountId: string }) {
  const { plan: access } = useOfferPlan(accountId);
  if (access?.incentive !== "${c.ex.incentive}") return null;

  return <div className="banner">Your offer is active</div>;
}

// Overrides are already applied: can(), left() and hasAddon()
// include whatever the incentive grants, so your gates need no changes.`,
    },
  ];
}

/** Apply or remove one incentive from your backend (the incentive page's "Apply to an account" panel). */
export function applyIncentive(c: SnippetContext, incentiveId: string) {
  return [
    {
      label: "JavaScript",
      lang: "ts" as const,
      code: `const OFFER_API = "${appUrl(c)}";
const headers = { Authorization: ${jsAuth(c, "secret")}, "Content-Type": "application/json" };

// Apply: replaces any incentive the account already has
await fetch(\`\${OFFER_API}/namespaces/\${accountId}\`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ incentive: "${incentiveId}" }),
});

// Remove: the account falls back to its plan's limits
await fetch(\`\${OFFER_API}/namespaces/\${accountId}/incentive\`, { method: "DELETE", headers });`,
    },
    {
      label: "cURL · apply",
      lang: "bash" as const,
      code: curl(c, "PATCH", `/namespaces/${c.ex.account}`, "secret", { incentive: incentiveId }),
    },
    { label: "cURL · remove", lang: "bash" as const, code: curl(c, "DELETE", `/namespaces/${c.ex.account}/incentive`, "secret") },
  ];
}

// ---------------------------------------------------------------------------

function camel(id: string) {
  return id.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase()).replace(/^[^a-z]+/i, "") || "entitlement";
}

function pascal(id: string) {
  const c = camel(id);
  return c.charAt(0).toUpperCase() + c.slice(1);
}
