// Seeds the PayPal checkout demo: a "Scrapely" catalog (free/basic/pro/team
// plans, scrapes and exports entitlements, a welcome-call add-on), the "5050"
// half-off offer, PayPal sandbox credentials and an over-limit upgrade offer.
//
//   APP_ID=app_xxx \                      # optional: an app made in the dashboard (else a new app)
//   PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… \   # PayPal sandbox REST app
//   bun scripts/seed-demo.ts
//
// API_URL (default http://localhost:6767), ADMIN_API_KEY (default dev-admin-key)
// and DEMO_URL (the dashboard's /demo/checkout page, default
// http://localhost:6768/demo/checkout) can be overridden. Safe to re-run.

export {}; // a module, for top-level await

const API_URL = (process.env.API_URL ?? "http://localhost:6767").replace(/\/+$/, "");
const ADMIN = process.env.ADMIN_API_KEY ?? "dev-admin-key";
const DEMO_URL = process.env.DEMO_URL ?? "http://localhost:6768/demo/checkout";

async function api(method: string, path: string, body?: unknown, { ok = [] as number[] } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok && !ok.includes(res.status)) throw new Error(`${method} ${path} → ${res.status}: ${json.error ?? JSON.stringify(json)}`);
  return json;
}

let appId = process.env.APP_ID;
let publicKey: string;
if (appId) {
  publicKey = (await api("GET", `/apps/${appId}`)).public_key;
} else {
  const app = await api("POST", "/apps", { name: "Scrapely" });
  ({ id: appId, public_key: publicKey } = app);
}
const a = (path: string) => `/apps/${appId}${path}`;
const create = (path: string, body: unknown) => api("POST", a(path), body, { ok: [409] });

await create("/entitlements", { id: "scrapes", name: "Scrapes", type: "usage" });
await create("/entitlements", { id: "exports", name: "CSV exports", type: "boolean" });
await create("/entitlements", { id: "api_access", name: "API access", type: "boolean" });
await create("/addons", { id: "welcome_call", name: "1:1 welcome call", description: "30 minutes with a scraping expert" });
await create("/addons", { id: "priority_support", name: "Priority support" });

const card = (title: string, description: string, monthly: number, yearly: number | null, featured = false) => ({
  title,
  description,
  type: "subscription",
  monthlyPrice: monthly,
  yearlyPrice: yearly,
  currency: "USD",
  featured,
  benefits: [],
});

const plans: [string, string, unknown, { id: string; max?: number | null }[], boolean?][] = [
  ["free", "Free", null, [{ id: "scrapes", max: 100 }], true],
  ["basic", "Basic", card("Basic", "For side projects", 20, 200), [{ id: "scrapes", max: 1000 }, { id: "exports" }]],
  [
    "pro",
    "Pro",
    card("Pro", "For teams shipping data products", 99, 990, true),
    [{ id: "scrapes", max: 10000 }, { id: "exports" }, { id: "api_access" }],
  ],
  ["team", "Team", card("Team", "Unlimited seats and higher limits", 199, 1990), [{ id: "scrapes", max: 50000 }, { id: "exports" }, { id: "api_access" }]],
];
for (const [id, name, pricingCard, entitlements, isFree] of plans) {
  await create("/plans", { id, name, pricingCard, isFree: !!isFree });
  for (const e of entitlements) await create(`/plans/${id}/entitlements`, e);
}

for (const [id, name] of [["acme", "Acme Labs"], ["globex", "Globex"]]) {
  await create("/namespaces", { id, name, plan: "free" });
}

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  await api("PUT", a("/paypal"), {
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET,
    env: process.env.PAYPAL_ENV ?? "sandbox",
  });
  console.log("PayPal connected.");
} else {
  console.log("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set: skipping PayPal (offers stay drafts).");
}

const offer = {
  id: "5050",
  name: "Half off",
  copy: {
    headline: "Half off Scrapely for 3 months",
    subhead: "Pick a plan. Pro also gets 12,000 scrapes a month.",
    bullets: ["Cancel anytime", "Keep your data if you downgrade"],
  },
  discount: { percent: 50, cycles: 3 },
  intervals: ["month", "year"],
  // `cycles` counts billing periods, so yearly prices get one discounted year.
  plans: [
    { plan_id: "basic", prices: { year: { amount: 100, cycles: 1 } } },
    { plan_id: "pro", prices: { year: { amount: 495, cycles: 1 } }, entitlements: [{ id: "scrapes", max: 12000 }] },
    { plan_id: "team", prices: { year: { amount: 995, cycles: 1 } } },
  ],
  default_plan: "pro",
  bumps: [
    {
      id: "welcome_call",
      label: "Add a 1:1 welcome call",
      description: "30 minutes to set up your first scrapers with an expert.",
      price: { amount: 50 },
      grant: { addons: ["welcome_call"] },
      applies_to: { plans: ["pro", "team"] },
    },
  ],
};
const existing = await api("GET", a(`/offers/${offer.id}`), undefined, { ok: [404] });
if (existing.id) await api("PATCH", a(`/offers/${offer.id}`), offer);
else await api("POST", a("/offers"), offer);

if (process.env.PAYPAL_CLIENT_ID) {
  await api("POST", a(`/offers/${offer.id}/publish`));
  console.log('Offer "5050" published.');
}

// Over-limit calls answer 402 with the half-off upgrade, linking to the demo page.
await api("PATCH", a("/entitlements/scrapes"), { overage: { mode: "block", offer_id: "5050" } });
await api("PATCH", a(""), { checkout_url: DEMO_URL });

console.log(`
App:              ${appId}
Publishable key:  ${publicKey}

Add to offer-app/.env.local:
  DEMO_APP_ID=${appId}
  DEMO_PUBLISHABLE_KEY=${publicKey}

Then open ${DEMO_URL}?offer=5050&ref=partner-x
`);
