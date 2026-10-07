import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, FileTree, H2, H3, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Access and entitlements",
  description: "Add the React SDK to your app, read what an account can use, record usage and handle the 402 an account gets at its limit.",
};

const tsconfig = `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@offer/sdk": ["../offer-app/src/sdk/index.ts"],
      "@offer/sdk/checkout": ["../offer-app/src/sdk/checkout/index.ts"],
      "@offer/sdk/cancel": ["../offer-app/src/sdk/cancel/index.ts"]
    }
  }
}`;

const planResponse = `{
  "plan": { "id": "pro", "name": "Pro", "description": "For the prolific blogger.", "isFree": false, "meta": { "badge": "PRO" } },
  "incentive": null,
  "offer": "launch_50",
  "addons": [],
  "entitlements": [
    { "id": "posts", "feature": "posts", "name": "Posts", "type": "usage", "usage": 12, "max": 75, "left": 63, "can": true },
    { "id": "comments", "feature": "comments", "name": "Comments", "type": "usage", "usage": 140, "max": null, "left": null, "can": true },
    { "id": "pin_posts", "feature": "pin_posts", "name": "Pin posts", "type": "boolean", "usage": 0, "max": null, "left": null, "can": true }
  ]
}`;

const serverClient = `import "server-only";
import { OfferApiError, OfferClient } from "@offer/sdk";

export const offer = new OfferClient({
  baseUrl: process.env.OFFER_API_URL, // http://localhost:6767 locally
  apiKey: process.env.OFFER_SECRET_KEY,
});

const APP_ID = process.env.OFFER_APP_ID!;
export const accountPath = (id: string) => \`/apps/\${APP_ID}/namespaces/\${encodeURIComponent(id)}\`;

type Entitlement = {
  id: string;
  name: string;
  type: "usage" | "boolean";
  usage: number;
  max: number | null;
  left: number | null;
  can: boolean;
};
export type AccountPlan = { plan: { id: string; name: string }; offer: string | null; addons: string[]; entitlements: Entitlement[] };

/** Creates the account on the free plan the first time you see the user. */
export async function ensureAccount(user: { id: string; name: string }) {
  try {
    return await offer.request(accountPath(user.id));
  } catch (err) {
    if (!(err instanceof OfferApiError) || err.status !== 404) throw err;
  }
  try {
    return await offer.request(\`/apps/\${APP_ID}/namespaces\`, {
      method: "POST",
      body: JSON.stringify({ id: user.id, name: user.name, plan: "free" }),
    });
  } catch (err) {
    // Another request created it first.
    if (err instanceof OfferApiError && err.status === 409) return offer.request(accountPath(user.id));
    throw err;
  }
}

export const getPlan = (accountId: string) => offer.request<AccountPlan>(\`\${accountPath(accountId)}/plan\`);

/** Boolean entitlements the plan doesn't include are missing from the list, so default to false. */
export const can = (plan: AccountPlan, entitlementId: string) =>
  plan.entitlements.find((e) => e.id === entitlementId)?.can ?? false;`;

const serverCheck = `"use server";

import { can, getPlan } from "@/lib/offer";
import { requireUser } from "@/lib/session"; // your own auth helper

export async function pinPost(postId: number) {
  const user = await requireUser();
  if (!can(await getPlan(user.id), "pin_posts")) {
    return { error: "Pinned posts aren't included in your plan" };
  }
  // ...pin the post
}`;

const recordUsage = `import { OfferApiError } from "@offer/sdk";
import { accountPath, offer } from "@/lib/offer";

type LimitReached = {
  error: "limit_reached";
  message: string;
  entitlement: { id: string; name: string; usage: number; max: number };
  offer: { id: string; plan: { id: string; name: string }; price: number; checkout_url: string | null } | null;
  retry_after_purchase: boolean;
};

export async function createPost(userId: string, input: { title: string; body: string }) {
  try {
    await offer.request(\`\${accountPath(userId)}/usage/posts/add\`, { method: "POST" });
  } catch (err) {
    if (err instanceof OfferApiError && err.status === 402) {
      const limit = err.body as LimitReached;
      return { error: limit.message, upgradeUrl: limit.offer?.checkout_url ?? "/pricing" };
    }
    throw err;
  }
  // ...save the post. If that fails, give the usage back with /usage/posts/remove.
}`;

const limitBody = `{
  "error": "limit_reached",
  "message": "You've used 3 of 3 Posts on the Free plan. Pro includes 75 Posts for $4.50/month for 3 months, then $9/month. Upgrade here: https://blog.example.com/pricing?offer=launch_50&plan=pro&interval=month&account=user_42",
  "entitlement": { "id": "posts", "name": "Posts", "usage": 3, "max": 3 },
  "offer": {
    "id": "launch_50",
    "name": "Launch week: 50% off",
    "plan": { "id": "pro", "name": "Pro" },
    "interval": "month",
    "currency": "USD",
    "price": 4.5,
    "list_price": 9,
    "cycles": 3,
    "new_limit": 75,
    "checkout_url": "https://blog.example.com/pricing?offer=launch_50&plan=pro&interval=month&account=user_42",
    "expires_at": null
  },
  "retry_after_purchase": true
}`;

const browserProvider = `// app/account/page.tsx (server component)
import { AccountPanel } from "./account-panel";
import { requireUser } from "@/lib/session"; // your own auth helper

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <AccountPanel
      apiUrl={process.env.OFFER_API_URL!}
      appId={process.env.OFFER_APP_ID!}
      publishableKey={process.env.OFFER_PUBLIC_KEY!}
      accountId={user.id}
    />
  );
}`;

const browserHook = `"use client";

import { OfferProvider, useOfferClient } from "@offer/sdk";
import { useEffect, useState } from "react";

type AccountPlan = { entitlements: { id: string; can: boolean }[] };

// Your own hook on top of the SDK's client. The SDK has no plan hook yet.
function useAccountPlan(appId: string, accountId: string) {
  const client = useOfferClient();
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    client
      .request<AccountPlan>(\`/apps/\${appId}/namespaces/\${encodeURIComponent(accountId)}/plan\`, { signal: controller.signal })
      .then(setPlan, () => {});
    return () => controller.abort();
  }, [client, appId, accountId]);
  return plan;
}

function PinButton({ appId, accountId }: { appId: string; accountId: string }) {
  const plan = useAccountPlan(appId, accountId);
  if (!plan) return null;
  const pin = plan.entitlements.find((e) => e.id === "pin_posts");
  if (!pin?.can) return <a href="/pricing?plan=pro">Upgrade to pin posts</a>;
  return <button type="button">Pin post</button>;
}

export function AccountPanel(props: { apiUrl: string; appId: string; publishableKey: string; accountId: string }) {
  return (
    <OfferProvider baseUrl={props.apiUrl} apiKey={props.publishableKey}>
      <PinButton appId={props.appId} accountId={props.accountId} />
    </OfferProvider>
  );
}`;

const pricingCards = `import { priceLabel } from "@offer/sdk/checkout";
import { OfferClient } from "@offer/sdk";

type PricingCard = { plan_id: string; title: string; monthlyPrice?: number; yearlyPrice?: number; currency?: string; isFree: boolean };

export default async function PricingTable() {
  const client = new OfferClient({ baseUrl: process.env.OFFER_API_URL, apiKey: process.env.OFFER_PUBLIC_KEY });
  const cards = await client.request<PricingCard[]>(\`/apps/\${process.env.OFFER_APP_ID}/plans/pricing\`);
  return (
    <ul>
      {cards.map((c) => (
        <li key={c.plan_id}>
          {c.title}: {c.isFree ? "Free" : priceLabel(c.monthlyPrice ?? 0, "month", c.currency ?? "USD")}
        </li>
      ))}
    </ul>
  );
}`;

export default function SdkAccessPage() {
  return (
    <>
      <DocsHeader
        title="Access and entitlements"
        lead="Ask the API what an account can use, gate features on the answer, and record usage as it happens. The same calls work from your server and, with the right key, from the browser."
      />

      <p>
        The React SDK is a small set of TypeScript modules: a fetch client, a provider and hooks. It depends on React
        and nothing else. The checkout loads PayPal&apos;s JavaScript SDK from paypal.com when it renders the payment
        buttons. This page covers the core entry point. <Link href="/docs/sdk/checkout">Checkout</Link> and{" "}
        <Link href="/docs/sdk/cancel-flows">Cancel flows</Link> cover the other two.
      </p>

      <H2>Add the SDK to your app</H2>
      <p>
        The SDK isn&apos;t published to npm. Its source lives in the dashboard at <code>offer-app/src/sdk</code>, and
        apps in the monorepo import it through TypeScript path aliases, so SDK changes show up without a build step. Map
        each entry point you use.
      </p>
      <Code title="tsconfig.json" lang="json" code={tsconfig} />
      <FileTree
        items={[
          { path: "offer-app/src/sdk/" },
          { path: "index.ts", depth: 1, note: "@offer/sdk: OfferClient, OfferApiError, OfferProvider, useOfferClient" },
          { path: "checkout/", depth: 1, note: "@offer/sdk/checkout: the checkout provider, useOffer, Offer.*, getOffer" },
          { path: "cancel/", depth: 1, note: "@offer/sdk/cancel: CancelFlowProvider, useCancelFlow, CancelFlow.*" },
        ]}
      />
      <p>
        Outside the monorepo, copy <code>offer-app/src/sdk</code> into your project and point the same aliases at the
        copy. The modules that use hooks start with <code>&quot;use client&quot;</code>, so they work in the Next.js app
        router. <code>OfferClient</code> and <code>getOffer</code> also run on the server.
      </p>
      <p>
        A coding agent can do the copying for you. <strong>Developers → Integration → Install the React SDK with an
        agent</strong> in the dashboard gives you a <code>SKILL.md</code> that carries the SDK&apos;s source and your
        app&apos;s API URL and app ID. Save it in your coding agent&apos;s skills folder, or
        paste it into any other agent. It never includes the secret key.
      </p>
      <Callout title="Two providers share a name.">
        <code>@offer/sdk</code> and <code>@offer/sdk/checkout</code> both export an <code>OfferProvider</code>. They
        are different components with different props. Import each from its own path.
      </Callout>

      <H2>Which key to use</H2>
      <p>
        Every call sends a key as <code>Authorization: Bearer …</code>. Pick the key by where the code runs. The full
        rules are in <Link href="/docs/api">Authentication</Link>.
      </p>
      <Table
        head={["Key", "Runs in", "Use it for"]}
        rows={[
          ["key_…", "Your server", "Everything in your app: creating accounts, changing plans, recording usage, minting account tokens."],
          ["pub_…", "Browser or server", "Reading an account's plan, reading pricing, recording usage and running checkouts."],
          ["act_…", "Browser", "One account's own plan and subscription, and its cancel flow. Minted by your server."],
        ]}
      />
      <Callout tone="warning" title="Never send the secret key to the browser.">
        It can change or delete any record in the app. Read it from an environment variable in server code only, and
        pass the publishable key or an account token to client components.
      </Callout>

      <H2>How access is resolved</H2>
      <p>
        <code>GET /apps/:appId/namespaces/:accountId/plan</code> returns one answer that already combines three
        layers. Each layer overrides the one before it for the same entitlement id:
      </p>
      <ol>
        <li>The account&apos;s plan.</li>
        <li>
          Extras from the offer the account bought through, while its subscription is active and the extras
          haven&apos;t ended.
        </li>
        <li>
          The account&apos;s incentive, until its <code>incentive_expires_at</code> passes.
        </li>
      </ol>
      <p>
        Add-ons from all three are merged with the add-ons the account owns itself. Each entitlement comes back with
        the account&apos;s current usage.
      </p>
      <Code title="GET /apps/:appId/namespaces/user_42/plan" lang="json" code={planResponse} />
      <Table
        head={["Field", "Meaning"]}
        rows={[
          ["id", "The entitlement id. feature carries the same value."],
          ["type", <>
            <code>usage</code> for metered features, <code>boolean</code> for on and off features.
          </>],
          ["usage", "The account's current count. Always 0 for boolean entitlements."],
          ["max", <>The limit after all three layers. <code>null</code> means unlimited.</>],
          ["left", <>
            <code>max</code> minus <code>usage</code>, never below 0. <code>null</code> when unlimited.
          </>],
          ["can", <>
            <code>true</code> while <code>usage</code> is below <code>max</code>, or when there is no limit.
          </>],
        ]}
      />
      <p>
        A boolean entitlement the plan doesn&apos;t include is missing from the list, so treat a missing entitlement
        as <code>can: false</code>. <code>/plan</code> leaves out the meta keys listed in the plan&apos;s{" "}
        <code>privateMetaKeys</code>. <code>/full-plan</code> returns the same thing with private meta included.
      </p>

      <H2>Check access on the server</H2>
      <p>
        Server code uses <code>OfferClient</code> with the secret key. Its <code>request()</code> method takes any
        API path, adds the key and JSON headers, and throws an <code>OfferApiError</code> for any non-2xx response.
        Keep helpers like these in one server-only module.
      </p>
      <Code title="lib/offer.ts" lang="ts" code={serverClient} />
      <p>Then gate the feature where the action happens, not only in the UI:</p>
      <Code title="app/posts/actions.ts" lang="ts" code={serverCheck} />
      <Table
        head={["Option", "Type", "Description"]}
        rows={[
          ["baseUrl", "string", "The Offer API's URL. Defaults to an empty string, which means same origin, so pass it outside the dashboard."],
          ["apiKey", "string", "Sent as the bearer token: a secret key, publishable key or account token."],
          ["fetch", "typeof fetch", "A custom fetch, for logging, tests or caching options."],
        ]}
      />

      <H2>Record usage</H2>
      <p>
        Usage counters live in the API. Change them when the account uses a metered feature, and the next{" "}
        <code>/plan</code> reflects it.
      </p>
      <Table
        head={["Route", "What it does"]}
        rows={[
          ["POST …/usage/:entitlementId/add", "Adds 1."],
          ["POST …/usage/:entitlementId/remove", "Subtracts 1, for example when a post is deleted. Secret key only."],
          [
            "POST …/usage/:entitlementId/amount",
            <>
              Adds <code>{"{ \"amount\": n }"}</code>. Use a negative integer to subtract, with the secret key.
            </>,
          ],
          ["GET …/usage", "Counts for every entitlement on the account's plan."],
          ["GET …/usage/:entitlementId", "One counter."],
        ]}
      />
      <p>
        The routes sit under <code>/apps/:appId/namespaces/:accountId</code> and return{" "}
        <code>{"{ \"entitlement\": \"posts\", \"count\": 4 }"}</code>. Calling them on a boolean entitlement returns{" "}
        <code>400</code>.
      </p>

      <H3>Soft and hard limits</H3>
      <p>
        By default a counter keeps counting past its limit. <code>can</code> turns <code>false</code> and your code
        decides what to do. Check <code>can</code> first, then record the usage.
      </p>
      <p>
        To have the API enforce a limit, set <code>overage</code> on the entitlement with{" "}
        <code>PATCH /apps/:appId/entitlements/:entitlementId</code>. With{" "}
        <code>{"{ \"mode\": \"block\" }"}</code>, an <code>add</code> or positive <code>amount</code> that would go
        past the limit is refused with <code>402</code> and the counter doesn&apos;t move. Add{" "}
        <code>offer_id</code> to choose which offer the upgrade comes from.
      </p>
      <Code title="app/posts/actions.ts" lang="ts" code={recordUsage} />
      <Code title="402 Payment Required" lang="json" code={limitBody} />
      <p>
        The <code>message</code> is plain language, written so you can show it as is or hand it to an AI agent. The
        upgrade is the cheapest plan that raises this limit, taken from the entitlement&apos;s <code>offer_id</code> when
        the account can buy it, else at regular prices. When the
        account pays and you retry, the API first checks that account&apos;s open checkouts with PayPal, so the retry
        works even before PayPal&apos;s webhook arrives.
      </p>

      <H2>Paywalls</H2>
      <p>
        There is no paywall component. Build one from <code>can</code> and a link to your checkout page, or from the{" "}
        <code>checkout_url</code> in a 402. Where that link points depends on the app:
      </p>
      <ul>
        <li>
          With <code>checkout_url</code> set on the app (
          <code>{"PATCH /apps/:appId { \"checkout_url\": \"https://…/pricing\" }"}</code>), it is your page with{" "}
          <code>offer</code>, <code>plan</code>, <code>interval</code> and <code>account</code> in the query string.
          Pass all four from the query string to the <Link href="/docs/sdk/checkout">checkout SDK</Link>.
        </li>
        <li>Without it, the API creates a PayPal approval link on the spot and reuses it for an hour.</li>
        <li>
          Without PayPal connected, <code>checkout_url</code> is <code>null</code>.
        </li>
      </ul>
      <p>
        To nudge before the wall, subscribe to the <code>usage.limit_warning</code> webhook. It fires once when an
        account crosses 80% of a limit. See <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>

      <H2>Read access in the browser</H2>
      <p>
        Wrap client components in the core <code>OfferProvider</code> and call <code>useOfferClient()</code> to get
        an <code>OfferClient</code> that sends the publishable key. Pass the key down from a server component; it
        doesn&apos;t need a <code>NEXT_PUBLIC_</code> variable.
      </p>
      <Code title="app/account/page.tsx" lang="tsx" code={browserProvider} />
      <Code title="app/account/account-panel.tsx" lang="tsx" code={browserHook} />
      <Table
        head={["Prop", "Type", "Description"]}
        rows={[
          ["baseUrl", "string", "The Offer API's public URL."],
          ["apiKey", "string", "The publishable key, or an account token."],
          ["fetch", "typeof fetch", "Optional custom fetch."],
          ["client", "OfferClient", "A client you built yourself. Replaces the three props above."],
        ]}
      />
      <Callout tone="warning" title="The publishable key is not scoped to one account.">
        Anyone with it can read any account&apos;s <code>/plan</code> by id and add usage for it. It can&apos;t read{" "}
        <code>/full-plan</code> or lower a counter; those need the secret key. For
        reads that must stay with one account, mint an account token on your server (see{" "}
        <Link href="/docs/sdk/cancel-flows">Cancel flows</Link>) and pass it as <code>apiKey</code>. A token can read
        its own account&apos;s <code>/plan</code>, <code>/full-plan</code> and <code>/subscription</code>.
      </Callout>

      <H2>Show a pricing table</H2>
      <p>
        <code>GET /apps/:appId/plans/pricing</code> returns the pricing card of every plan that has one, and accepts the
        publishable key. The checkout entry point exports the price formatters.
      </p>
      <Code title="app/pricing/pricing-table.tsx" lang="tsx" code={pricingCards} />

      <H2>Errors</H2>
      <p>
        Every SDK client throws <code>OfferApiError</code> for a non-2xx response. It carries <code>status</code>,{" "}
        <code>message</code> (the API&apos;s <code>error</code> string) and <code>body</code> (the parsed JSON). The
        codes you&apos;ll see are listed in <Link href="/docs/api">Authentication</Link>.
      </p>
      <Callout title="useOffers and useOffer in the core entry point.">
        They read <code>/api/v1/offers</code> on the dashboard, an older endpoint that serves a fixed list. They
        don&apos;t read the Offer API. To sell an offer, use the checkout entry point&apos;s <code>useOffer()</code>.
      </Callout>
    </>
  );
}
