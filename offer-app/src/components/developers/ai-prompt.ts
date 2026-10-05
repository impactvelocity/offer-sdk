// Markdown context for AI coding assistants, describing this app's integration.

import type { Addon, Entitlement, Incentive, Plan } from "@/lib/api/types";
import { ENV } from "./snippets";

export interface PromptOptions {
  catalog: boolean;
  reactHook: boolean;
  usage: boolean;
  webhooks: boolean;
  realKeys: boolean;
}

export interface PromptInput {
  baseUrl: string;
  appId: string;
  appName: string;
  secretKey: string;
  publicKey: string;
  entitlements: Entitlement[];
  plans: Plan[];
  incentives: Incentive[];
  addons: Addon[];
  examples: { account: string; plan: string; freePlan: string; usageEntitlement: string; flag: string };
}

const FENCE = "```";

function catalogSection({ entitlements, plans, incentives, addons }: PromptInput) {
  const types = new Map(entitlements.map((e) => [e.id, e.type]));
  const refs = (list: { id: string; max?: number | null }[]) =>
    list
      .map((r) => (types.get(r.id) === "boolean" ? r.id : r.max == null ? `${r.id} (unlimited)` : `${r.id} ≤ ${r.max}`))
      .join(", ") || "nothing";

  const lines = ["## This app's catalog", "", "Read these ids from the API at runtime; they can change from the dashboard.", ""];
  lines.push("### Entitlements");
  if (entitlements.length) {
    lines.push("| id | type | name | description |", "|---|---|---|---|");
    for (const e of entitlements) lines.push(`| \`${e.id}\` | ${e.type} | ${e.name} | ${e.description ?? ""} |`);
  } else lines.push("None yet.");

  lines.push("", "### Plans");
  if (plans.length) {
    for (const p of plans) {
      const extras = [p.isFree ? "free plan" : null, p.addons.length ? `add-ons: ${p.addons.join(", ")}` : null].filter(Boolean);
      lines.push(`- \`${p.id}\` (${p.name}${extras.length ? `; ${extras.join("; ")}` : ""}): ${refs(p.entitlements)}`);
    }
  } else lines.push("None yet.");

  if (incentives.length) {
    lines.push("", "### Incentives (offers layered on a plan)");
    for (const i of incentives) lines.push(`- \`${i.id}\` (${i.name}): ${refs(i.entitlements)}${i.addons.length ? `; add-ons: ${i.addons.join(", ")}` : ""}`);
  }
  if (addons.length) {
    lines.push("", "### Add-ons");
    for (const a of addons) lines.push(`- \`${a.id}\` (${a.name})${a.description ? `: ${a.description}` : ""}`);
  }
  return lines.join("\n");
}

function hookSection(input: PromptInput, opts: PromptOptions) {
  const key = opts.realKeys ? JSON.stringify(input.publicKey) : `process.env.${ENV.public}!`;
  return `## React hook

Client components read access with the public key through this hook:

${FENCE}tsx
"use client";
import { useCallback, useEffect, useState } from "react";

const OFFER_API = "${input.baseUrl}/apps/${input.appId}";
const PUBLIC_KEY = ${key};

export function useOfferPlan(accountId: string | undefined) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const refresh = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(\`\${OFFER_API}/namespaces/\${encodeURIComponent(accountId)}/plan\`, {
        headers: { Authorization: \`Bearer \${PUBLIC_KEY}\` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setData(await res.json());
    } catch (e) {
      setError(e as Error);
    }
  }, [accountId]);
  useEffect(() => { refresh(); }, [refresh]);
  const find = (id: string) => data?.entitlements.find((e: any) => e.id === id);
  return {
    plan: data,
    error,
    loading: !data && !error,
    refresh,
    can: (id: string) => find(id)?.can ?? false,
    left: (id: string) => (find(id) ? find(id).left : 0), // null = unlimited
    hasAddon: (id: string) => data?.addons.includes(id) ?? false,
  };
}
${FENCE}

Example: \`const { can, left } = useOfferPlan(user.id); if (!can("${input.examples.flag}")) return <Upgrade />;\``;
}

function usageSection(input: PromptInput, opts: PromptOptions) {
  const auth = opts.realKeys ? JSON.stringify(`Bearer ${input.secretKey}`) : `\`Bearer \${process.env.${ENV.secret}}\``;
  return `## Track usage (public or secret key; usage entitlements only)

POST /apps/${input.appId}/namespaces/:accountId/usage/:entitlementId/add     → +1
POST /apps/${input.appId}/namespaces/:accountId/usage/:entitlementId/remove  → -1
POST /apps/${input.appId}/namespaces/:accountId/usage/:entitlementId/amount  body { "amount": integer } → adds amount (negative subtracts; it does not set the value)
→ 200 { "entitlement": string, "count": number }

- Writes do NOT enforce limits. Check \`can\` from /plan before the action, then track it after it succeeds.
- Boolean entitlements can't be tracked (400).
- Track anything you bill on from the server with the secret key.
- To reset a periodic quota, POST /amount with the negative of the current count.

Server helper:

${FENCE}ts
const OFFER_API = "${input.baseUrl}/apps/${input.appId}";

export async function trackUsage(accountId: string, entitlement: string, operation: "add" | "remove" | "amount" = "add", amount?: number) {
  const res = await fetch(\`\${OFFER_API}/namespaces/\${encodeURIComponent(accountId)}/usage/\${entitlement}/\${operation}\`, {
    method: "POST",
    headers: { Authorization: ${auth}, "Content-Type": "application/json" },
    body: operation === "amount" ? JSON.stringify({ amount }) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json() as Promise<{ entitlement: string; count: number }>;
}
${FENCE}`;
}

function webhookSection(input: PromptInput) {
  return `## Billing webhooks

Plans change when billing changes. In the payment provider's webhook handler (server, secret key):

- Checkout completed / subscription upgraded → \`PATCH /apps/${input.appId}/namespaces/:accountId\` with \`{ "plan": "<plan id>" }\` (e.g. \`"${input.examples.plan}"\`).
- Subscription cancelled → \`PATCH …/namespaces/:accountId\` with \`{ "plan": "${input.examples.freePlan}" }\`.
- Apply a promo → \`PATCH …/namespaces/:accountId\` with \`{ "incentive": "<incentive id>" }\`; remove it with \`DELETE …/namespaces/:accountId/incentive\`.

Store the account id on the checkout session (e.g. Stripe \`client_reference_id\`) and the target plan id in its metadata. Changes apply on the next /plan read; usage counters are kept.`;
}

export function buildPrompt(input: PromptInput, opts: PromptOptions) {
  const base = `${input.baseUrl}/apps/${input.appId}`;
  const secret = opts.realKeys ? input.secretKey : `read from env ${ENV.secret}`;
  const pub = opts.realKeys ? input.publicKey : `read from env ${ENV.public}`;

  const sections = [
    `# Offer SDK integration: ${input.appName}

You are helping integrate Offer SDK into this codebase. Offer SDK is a hosted entitlement API. It stores ${input.appName}'s plans, usage limits, feature flags, add-ons and offers, and answers "what can this customer do right now?". Plans and limits are changed from the Offer SDK dashboard without code changes, so never hard-code limits or plan rules: always read them from the API.

## Configuration

- Base URL: ${input.baseUrl}
- App ID: ${input.appId}
- Every route below is under ${base}
- Auth header: \`Authorization: Bearer <key>\`
- Secret key (\`key_…\`, ${secret}): server only, full access to this app's routes.
- Public key (\`pub_…\`, ${pub}): safe in browsers. Only GET …/namespaces/:id/plan, GET …/plans/pricing and the usage routes.
- Errors are JSON \`{ "error": string }\`: 400 invalid input, 401 bad key (or a public key on a secret-only route), 404 not found, 409 duplicate id.

## Concepts

- Account (called "namespace" in the API): one end customer of this product. Use the product's own user or workspace id as the account id. Each account has exactly one plan and at most one incentive.
- Entitlement: a gated feature. \`usage\` entitlements are counted against a \`max\`; \`boolean\` entitlements are feature flags.
- Plan: a set of entitlements (with limits) and add-ons, plus metadata.
- Incentive: an offer layered on the account's plan. It overrides limits and can grant extra entitlements and add-ons.`,
    opts.catalog ? catalogSection(input) : null,
    `## Create an account (server, secret key)

Call on sign-up. Treat 409 as success so retries are safe.

POST /apps/${input.appId}/namespaces
Body: { "id": string, "name": string, "plan": string, "incentive"?: string }
→ 201 { id, app_id, name, plan, incentive, created_at }. 404 if the plan doesn't exist. An unknown incentive is silently dropped.

## Update or delete an account (server, secret key)

PATCH /apps/${input.appId}/namespaces/:accountId   body { "name"?, "plan"?, "incentive"?: string | null } (shallow merge) → 200 account
DELETE /apps/${input.appId}/namespaces/:accountId/incentive → 200 account with incentive null
DELETE /apps/${input.appId}/namespaces/:accountId → 200 { "deleted": true }

## Check access (public or secret key)

GET /apps/${input.appId}/namespaces/:accountId/plan
→ 200 {
  "plan": { "id", "name", "description", "isFree", "meta" },
  "incentive": string | null,
  "addons": string[],
  "entitlements": [{ "id", "feature", "name", "type": "usage" | "boolean", "usage", "max", "left", "can" }]
}

- Gate features on \`can\`. It is \`usage < max\`, or always true when \`max\` is null.
- \`max: null\` and \`left: null\` mean unlimited. Boolean entitlements always have \`max: null\`.
- An entitlement missing from the list is not granted (treat \`can\` as false).
- Incentive overrides are already applied. Private meta keys are stripped (GET …/full-plan includes them; call it from the server only).
- Re-read after plan changes or usage writes; don't cache for long.`,
    opts.usage ? usageSection(input, opts) : null,
    `## Pricing page (public or secret key)

GET /apps/${input.appId}/plans/pricing
→ 200 [{ "plan_id", "isFree", "title", "description", "benefits": [{ "id", "title" }], "featured", "type": "subscription" | "one_time", "monthlyPrice", "yearlyPrice", "price", "currency" }]`,
    opts.reactHook ? hookSection(input, opts) : null,
    opts.webhooks ? webhookSection(input) : null,
    `## Rules

- Never ship the secret key to the browser or commit it. Use environment variables.
- Server-side checks with the secret key are the source of truth; client checks are for UI only.`,
  ];

  return sections.filter(Boolean).join("\n\n");
}
