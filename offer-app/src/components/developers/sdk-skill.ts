// An agent skill (SKILL.md) that copies the React SDK into a customer's codebase and wires it to
// this app. The SDK isn't on npm, so the skill carries its source (read from src/sdk on the server).

export interface SdkFile {
  /** Path inside src/sdk, e.g. "checkout/provider.tsx". */
  path: string;
  code: string;
}

export interface SdkSkillOptions {
  checkout: boolean;
  cancel: boolean;
  /** Inline the publishable key. The secret key is never included. */
  publicKey: boolean;
}

export interface SdkSkillInput {
  baseUrl: string;
  appId: string;
  appName: string;
  publicKey: string;
  files: SdkFile[];
  examples: { flag: string; usageEntitlement: string };
}

export const SKILL_NAME = "offer-sdk";
export const SKILL_PATH = `.claude/skills/${SKILL_NAME}/SKILL.md`;

/** The core files are always included: checkout and cancel import its client. */
export function sdkFilesFor(files: SdkFile[], opts: Pick<SdkSkillOptions, "checkout" | "cancel">) {
  return files.filter((f) =>
    f.path.startsWith("checkout/") ? opts.checkout : f.path.startsWith("cancel/") ? opts.cancel : true,
  );
}

/** A fence longer than any backtick run in the code, so the file can't close it early. */
function fenced(code: string, lang: string) {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${code.replace(/\n$/, "")}\n${fence}`;
}

const F = "```";

/** "a, b and c" */
function joinList(items: (string | null)[], conjunction: "and" | "or") {
  const list = items.filter((i): i is string => Boolean(i));
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} ${conjunction} ${list.at(-1)}` : (list[0] ?? "");
}

function accessSection(input: SdkSkillInput) {
  const { appId, examples } = input;
  return `### Check access (\`@offer/sdk\`)

\`GET /apps/${appId}/namespaces/:accountId/plan\` with the publishable key returns the account's plan with every offer and incentive already applied:

${F}json
{
  "plan": { "id": "pro", "name": "Pro", "isFree": false, "meta": {} },
  "incentive": null,
  "addons": [],
  "entitlements": [
    { "id": "${examples.usageEntitlement}", "type": "usage", "usage": 12, "max": 75, "left": 63, "can": true },
    { "id": "${examples.flag}", "type": "boolean", "usage": 0, "max": null, "left": null, "can": true }
  ]
}
${F}

- Gate on \`can\`. \`max: null\` and \`left: null\` mean unlimited.
- An entitlement missing from the list isn't granted: treat it as \`can: false\`.
- The account id is the product's own user or workspace id. Accounts are created by a server with the secret key when someone signs up (\`POST /apps/${appId}/namespaces\` with \`{ "id", "name", "plan" }\`; a 409 means it already exists). Until then \`/plan\` returns 404.

Wrap the signed-in part of the app in the core provider once, then read the plan with a small hook on the SDK's client (the SDK has no plan hook yet). If the project already uses TanStack Query or SWR, write the hook with that instead.

${F}tsx
"use client";

import { OfferProvider, useOfferClient } from "@offer/sdk";
import { useEffect, useState, type ReactNode } from "react";

export type Entitlement = {
  id: string;
  name: string;
  type: "usage" | "boolean";
  usage: number;
  max: number | null;
  left: number | null;
  can: boolean;
};
export type AccountPlan = {
  plan: { id: string; name: string; isFree: boolean };
  incentive: string | null;
  addons: string[];
  entitlements: Entitlement[];
};

export function OfferAccess({ children }: { children: ReactNode }) {
  return (
    <OfferProvider baseUrl={API_URL} apiKey={PUBLISHABLE_KEY}>
      {children}
    </OfferProvider>
  );
}

export function useAccountPlan(accountId: string) {
  const client = useOfferClient();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ accountId: string; plan?: AccountPlan; error?: Error }>();

  useEffect(() => {
    const controller = new AbortController();
    client
      .request<AccountPlan>(\`/apps/\${APP_ID}/namespaces/\${encodeURIComponent(accountId)}/plan\`, { signal: controller.signal })
      .then(
        (plan) => setState({ accountId, plan }),
        (error: Error) => {
          if (!controller.signal.aborted) setState({ accountId, error });
        },
      );
    return () => controller.abort();
  }, [client, accountId, nonce]);

  const current = state?.accountId === accountId ? state : undefined;
  const find = (id: string) => current?.plan?.entitlements.find((e) => e.id === id);
  return {
    plan: current?.plan ?? null,
    error: current?.error ?? null,
    loading: !current,
    refresh: () => setNonce((n) => n + 1),
    can: (id: string) => find(id)?.can ?? false,
    /** null = unlimited */
    left: (id: string) => {
      const e = find(id);
      return e ? e.left : 0;
    },
  };
}
${F}

${F}tsx
function ExportButton({ accountId }: { accountId: string }) {
  const { can, loading } = useAccountPlan(accountId);
  if (loading) return null;
  if (!can("${examples.flag}")) return <a href="/pricing">Upgrade to unlock this</a>;
  return <button type="button">Export</button>;
}
${F}

Record usage once the action succeeds (\`/add\` is +1, \`/remove\` is −1, \`/amount\` with \`{ "amount": n }\` adds n), then \`refresh()\`. The publishable key can record usage, but record anything you bill on from a server with the secret key. When the entitlement is set to block overage, a write past the limit throws \`OfferApiError\` with status 402; its \`body.message\` is ready to show and \`body.offer?.checkout_url\` is an upgrade link.

${F}ts
import { OfferApiError } from "@offer/sdk";

// In a component or hook: const client = useOfferClient();
try {
  await client.request(\`/apps/\${APP_ID}/namespaces/\${encodeURIComponent(accountId)}/usage/${examples.usageEntitlement}/add\`, { method: "POST" });
} catch (err) {
  if (err instanceof OfferApiError && err.status === 402) {
    const limit = err.body as { message: string; offer: { checkout_url: string | null } | null };
    // Show limit.message and link to limit.offer?.checkout_url
  } else throw err;
}
${F}`;
}

function checkoutSection() {
  return `### Checkout page (\`@offer/sdk/checkout\`)

One page sells every plan and offer through PayPal. Before it works:

- PayPal must be connected in the dashboard: **App settings → Payments**.
- Set **App settings → Payments → Checkout page** to this page's URL. Offer links and over-limit upgrade links then send buyers here with \`?offer=&plan=&interval=&account=&ref=\`.
- \`<Offer.Checkout>\` loads PayPal's JS SDK from \`https://www.paypal.com\`. If the project sets a Content-Security-Policy, allow it for scripts and frames.

${F}tsx
"use client";

import { Offer, OfferProvider, type Checkout, type Interval } from "@offer/sdk/checkout";

const INTERVALS: Interval[] = ["month", "year", "once"];

/** \`search\` is the page's query string. Pass the signed-in user's account id; without one the buyer enters an email. */
export function CheckoutForm(props: { search: URLSearchParams; accountId?: string; onSuccess(checkout: Checkout): void }) {
  const { search } = props;
  return (
    <OfferProvider
      apiUrl={API_URL}
      appId={APP_ID}
      publishableKey={PUBLISHABLE_KEY}
      offerId={search.get("offer")}
      plan={search.get("plan")}
      interval={INTERVALS.find((i) => i === search.get("interval")) ?? null}
      account={props.accountId ?? search.get("account")}
      refCode={search.get("ref")}
      onSuccess={props.onSuccess}
    >
      <Offer.Status />
      <Offer.Headline />
      <Offer.IntervalToggle />
      <Offer.Plans>{(plan) => <Offer.Plan plan={plan} />}</Offer.Plans>
      <Offer.Bumps>{(bump) => <Offer.Bump bump={bump} />}</Offer.Bumps>
      <Offer.Summary />
      <Offer.Email />
      <Offer.Checkout />
    </OfferProvider>
  );
}
${F}

- Without \`offer\` it sells the plans at their regular prices. An expired or unknown offer falls back to them too, and \`<Offer.Status>\` says why.
- \`onSuccess\` runs once the API has applied the purchase: the account is on the new plan, so refresh any access you've loaded.
- In the Next.js app router, fetch the offer in the server component with \`getOffer({ apiUrl, appId, publishableKey, offerId, account, ref })\` and pass it as \`initialOffer\`, so the page renders with prices.
- Every \`Offer.*\` part takes \`className\`, and most take \`children\` as a function for fully custom markup. \`useOffer()\` (from \`@offer/sdk/checkout\`) exposes the whole state for a custom page.`;
}

function cancelSection(input: SdkSkillInput) {
  return `### Cancel flow (\`@offer/sdk/cancel\`)

The questions and save offers are set up in the dashboard's **Cancel flow** page, not in code. The browser needs an account token, minted by a server with the secret key:

${F}http
POST ${input.baseUrl}/apps/${input.appId}/namespaces/:accountId/token
Authorization: Bearer <OFFER_SECRET_KEY>
Content-Type: application/json

{ "ttl_seconds": 3600 }

→ 200 { "account_id": "…", "token": "act_…", "expires_at": "…" }
${F}

Add a server function or API route that checks who's signed in and mints a token for their own account id only. If this repo has no server, don't mint tokens in the browser: stop and tell the user what their backend needs to expose.

${F}tsx
"use client";

import { CancelFlow, CancelFlowProvider } from "@offer/sdk/cancel";

export function CancelButton({ token, onDone }: { token: string; onDone(): void }) {
  return (
    <CancelFlowProvider apiUrl={API_URL} appId={APP_ID} token={token} onSaved={onDone} onCancelled={onDone}>
      <CancelFlow.Trigger>Cancel subscription</CancelFlow.Trigger>
      <CancelFlow.Dialog />
    </CancelFlowProvider>
  );
}
${F}

- \`<CancelFlow.Dialog>\` is a native \`<dialog>\` that walks through the flow's steps. Every part takes \`className\`; the step parts (\`CancelFlow.Question\`, \`CancelFlow.Offer\`, \`CancelFlow.Confirm\`, \`CancelFlow.Done\`…) take \`children\` as a function for custom markup.
- Accepting a discount or downgrade sends the customer to PayPal to approve the new price (\`paypal="redirect"\`, the default; \`"new-tab"\` and \`"manual"\` also work). Pass \`returnUrl\` to choose where PayPal sends them back.
- After \`onSaved\` or \`onCancelled\`, reload the account's plan and subscription.`;
}

export function buildSdkSkill(input: SdkSkillInput, opts: SdkSkillOptions) {
  const { baseUrl, appId, appName } = input;
  const files = sdkFilesFor(input.files, opts);
  const parts = joinList(["entitlement checks", opts.checkout ? "a PayPal checkout page" : null, opts.cancel ? "a cancel flow" : null], "and");
  const triggers = joinList(
    [
      "gate a feature on the customer's plan or usage limits",
      opts.checkout ? "build the checkout or pricing page" : null,
      opts.cancel ? "add a cancel subscription button" : null,
    ],
    "or",
  );
  const description = `Installs the Offer SDK's React modules into this codebase, wired to the ${appName} app (${appId}): ${parts}. Use when asked to install, set up or update the Offer SDK, or to ${triggers}.`;

  const modules = [
    "| `@offer/sdk` | `OfferClient`, `OfferApiError`, `OfferProvider`, `useOfferClient` | Reading an account's plan and limits, recording usage |",
    opts.checkout
      ? "| `@offer/sdk/checkout` | `OfferProvider`, `useOffer`, `Offer.*`, `getOffer` | A checkout page that sells plans and offers through PayPal |"
      : null,
    opts.cancel
      ? "| `@offer/sdk/cancel` | `CancelFlowProvider`, `useCancelFlow`, `CancelFlow.*` | A cancel button that runs the cancel flow from the dashboard |"
      : null,
  ].filter(Boolean);

  const aliases = [
    `"@offer/sdk": ["./src/lib/offer-sdk/index.ts"]`,
    opts.checkout ? `"@offer/sdk/checkout": ["./src/lib/offer-sdk/checkout/index.ts"]` : null,
    opts.cancel ? `"@offer/sdk/cancel": ["./src/lib/offer-sdk/cancel/index.ts"]` : null,
  ].filter(Boolean);

  const publicKey = opts.publicKey
    ? `\`${input.publicKey}\``
    : "Not included. Ask the user for it (dashboard: **Developers → API keys**), or leave a placeholder.";

  return `---
name: ${SKILL_NAME}
description: ${JSON.stringify(description)}
---

# Offer SDK for React

Offer SDK is a hosted API that stores ${appName}'s plans, usage limits, feature flags and offers, and answers "what can this customer do right now?". Plans and limits change from the Offer SDK dashboard without code changes, so never hard-code them: read them from the API.

The React SDK isn't published to npm. This skill carries its source, under **SDK files** below. It depends on React 18 or later and nothing else.

| Import | Exports | Use it for |
|---|---|---|
${modules.join("\n")}

## This app

| Setting | Value |
|---|---|
| API URL | \`${baseUrl}\` |
| App ID | \`${appId}\` |
| Publishable key (\`pub_…\`) | ${publicKey} |
| Secret key (\`key_…\`) | Never in this skill, in browser code or in the repo. Server code reads it from \`OFFER_SECRET_KEY\`. |

- **Publishable key**: safe in the browser. It reads plans and pricing, records usage and runs checkouts, for any account id, so treat client-side checks as UI only.${
    opts.cancel ? "\n- **Account token** (`act_…`): minted by a server with the secret key, for one account. The cancel flow runs on one." : ""
  }
- **Secret key**: full access to the app. Only server code uses it.

## Install

1. **Look at the project.** Find the framework (Next.js app or pages router, Vite, React Router, Remix…), the source root, how env vars reach the browser, any \`paths\` already in \`tsconfig.json\`, and whether this repo has server code.
2. **Copy the SDK.** Write every file under **SDK files** to \`src/lib/offer-sdk/\` (or \`lib/offer-sdk/\` when there's no \`src\`, or wherever the project keeps vendored code), keeping the relative paths. Copy them exactly: don't reformat, rename or refactor them, so an update is a straight replace. If the linter or formatter flags them, add the folder to its ignore list. If stricter compiler options in this project reject a file, make the smallest type-only fix and list it in your report.
3. **Add import aliases** to \`compilerOptions.paths\` in \`tsconfig.json\` (relative to \`baseUrl\` when one is set), matching the folder you chose:

   ${F}json
   ${aliases.join(",\n   ")}
   ${F}

   Next.js reads these. For Vite, add the same aliases to \`resolve.alias\` or use \`vite-tsconfig-paths\`. If the toolchain can't do aliases, import the folders by relative path. The files are TypeScript; Next.js and Vite compile them even in a JavaScript project.
4. **Add environment variables** to the env example file, and with real values to the local env file (\`.env.local\` or the project's equivalent, which must be git-ignored):

   | Next.js | Vite | Value |
   |---|---|---|
   | \`OFFER_API_URL\` | \`VITE_OFFER_API_URL\` | \`${baseUrl}\` |
   | \`OFFER_APP_ID\` | \`VITE_OFFER_APP_ID\` | \`${appId}\` |
   | \`OFFER_PUBLIC_KEY\` | \`VITE_OFFER_PUBLIC_KEY\` | the publishable key |${
     opts.cancel ? "\n   | `OFFER_SECRET_KEY` | server env only | the secret key, from the user |" : ""
   }

   In Next.js, read them in a server component and pass them to client components as props, so they need no \`NEXT_PUBLIC_\` prefix. Use \`NEXT_PUBLIC_OFFER_*\` only for client code with no server parent. Other frameworks: use their public prefix. The examples below write \`API_URL\`, \`APP_ID\` and \`PUBLISHABLE_KEY\` for these values.
5. **Wire up what the user asked for** with the patterns under **Usage**. If they only asked to install the SDK, skip this step.
6. **Check it.** Run the project's typecheck, lint and build, and fix what your code broke.

The components are headless: plain HTML with \`data-*\` attributes for state (\`data-selected\`, \`data-featured\`, \`data-phase\`…) and a \`className\` prop. Style them with the project's own CSS or components so they match the rest of the app.

## Rules

- Never send the secret key to the browser, give it a public env prefix, or commit it.
- Gate features on \`can\` from the API. Never hard-code limits, prices or plan rules. Re-check on the server before anything that costs money or must be enforced.${
    opts.checkout
      ? "\n- `@offer/sdk` and `@offer/sdk/checkout` both export an `OfferProvider`. They're different components with different props: import each from its own path."
      : ""
  }
- Don't use \`useOffers\` or \`useOffer\` from \`@offer/sdk\`. They read an old dashboard endpoint, not the Offer API.${
    opts.checkout ? " The checkout's `useOffer` comes from `@offer/sdk/checkout`." : ""
  }
- To update the SDK, copy a fresh version of this skill from **Developers → Integration** in the dashboard and replace the folder.

## Usage

${[accessSection(input), opts.checkout ? checkoutSection() : null, opts.cancel ? cancelSection(input) : null].filter(Boolean).join("\n\n")}

## Report back

Tell the user which files you added or changed, the env vars they still need to fill in, and anything that has to happen outside this repo${
    opts.checkout || opts.cancel ? " (a backend endpoint, connecting PayPal, setting the checkout page, building the cancel flow)" : ""
  }.

## SDK files

${files.length} files. Copy each one to the same path under the SDK folder.

${files.map((f) => `### \`${f.path}\`\n\n${fenced(f.code, f.path.endsWith(".tsx") ? "tsx" : "ts")}`).join("\n\n")}
`;
}
