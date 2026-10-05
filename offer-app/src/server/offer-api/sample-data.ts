// Sample catalogs used to seed the demo workspace and the "Start with sample data"
// option when creating an app. Everything is created through ordinary API calls, so
// it works against the mock and the hosted API alike. Usage history is generated here
// too: the mock applies it in memory, and `pnpm seed:demo` imports it into the API.
//
// Also imported by scripts/seed-demo.ts under plain Node, so imports must stay type-only.

import type { OfferApiCall } from "./index";

/** The shared demo login. Its password is public on purpose (sign-in page, README). */
export const DEMO_USER = {
  name: "Demo Admin",
  email: "demo@offersdk.dev",
  password: "demo-password",
  workspace: "Acme Labs",
} as const;

export type SampleKind = "saas" | "course";

/** The demo workspace's apps. */
export const DEMO_APPS: { name: string; sample: SampleKind; plan: string }[] = [
  { name: "Notebook AI", sample: "saas", plan: "pro" },
  { name: "Course Hub", sample: "course", plan: "starter" },
];

type Ent = { id: string; name: string; type: "usage" | "boolean"; description?: string };
type PlanSeed = {
  id: string;
  name: string;
  description: string;
  isFree?: boolean;
  note?: string;
  entitlements: Record<string, number | null | true>;
  addons?: string[];
  meta?: Record<string, unknown>;
  privateMetaKeys?: string[];
  pricingCard?: Record<string, unknown>;
};
type IncentiveSeed = { id: string; name: string; description: string; entitlements: Record<string, number | null>; addons?: string[] };

export interface SampleTemplate {
  entitlements: Ent[];
  addons: { id: string; name: string; description?: string }[];
  plans: PlanSeed[];
  incentives: IncentiveSeed[];
  accounts: { count: number; planWeights: Record<string, number>; incentiveRate: number };
}

export const SAAS_TEMPLATE: SampleTemplate = {
  entitlements: [
    { id: "projects", name: "Projects", type: "usage", description: "Active projects a workspace can create." },
    { id: "ai_credits", name: "AI credits", type: "usage", description: "Credits spent on AI generations each billing period." },
    { id: "seats", name: "Team seats", type: "usage", description: "Members who can be invited to the workspace." },
    { id: "storage_gb", name: "Storage (GB)", type: "usage", description: "File storage across all projects." },
    { id: "export_pdf", name: "PDF export", type: "boolean", description: "Export documents as PDF." },
    { id: "api_access", name: "API access", type: "boolean", description: "Programmatic access with personal tokens." },
    { id: "custom_domain", name: "Custom domain", type: "boolean", description: "Publish pages on your own domain." },
    { id: "priority_support", name: "Priority support", type: "boolean", description: "Same-day responses from the support team." },
    { id: "sso", name: "SSO / SAML", type: "boolean", description: "Single sign-on with Okta, Azure AD and Google." },
  ],
  addons: [
    { id: "ai_boost", name: "AI boost", description: "Faster models and higher rate limits." },
    { id: "extra_storage", name: "Extra storage pack", description: "+500 GB of storage." },
    { id: "white_label", name: "White-label", description: "Remove all product branding." },
  ],
  plans: [
    {
      id: "free",
      name: "Free",
      description: "For individuals trying things out.",
      isFree: true,
      entitlements: { projects: 3, ai_credits: 50, seats: 1, storage_gb: 1, export_pdf: true },
      meta: { badge: "Free", trial_days: 0, upgrade_cta: "Upgrade to Starter" },
      pricingCard: {
        title: "Free",
        description: "Everything you need to get started.",
        type: "subscription",
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: "USD",
        featured: false,
        benefits: [
          { id: "b1", title: "3 projects" },
          { id: "b2", title: "50 AI credits / month" },
          { id: "b3", title: "PDF export" },
        ],
      },
    },
    {
      id: "starter",
      name: "Starter",
      description: "For small teams getting organised.",
      entitlements: { projects: 20, ai_credits: 500, seats: 3, storage_gb: 10, export_pdf: true, api_access: true },
      meta: { badge: "Starter", trial_days: 14, stripe_price_monthly: "price_1Starter", stripe_price_yearly: "price_1StarterY" },
      privateMetaKeys: ["stripe_price_monthly", "stripe_price_yearly"],
      pricingCard: {
        title: "Starter",
        description: "For small teams getting organised.",
        type: "subscription",
        monthlyPrice: 12,
        yearlyPrice: 120,
        currency: "USD",
        featured: false,
        benefits: [
          { id: "b1", title: "20 projects" },
          { id: "b2", title: "500 AI credits / month" },
          { id: "b3", title: "3 team seats" },
          { id: "b4", title: "API access" },
        ],
      },
    },
    {
      id: "pro",
      name: "Pro",
      description: "For growing teams that need more power.",
      entitlements: {
        projects: null,
        ai_credits: 2500,
        seats: 10,
        storage_gb: 100,
        export_pdf: true,
        api_access: true,
        custom_domain: true,
        priority_support: true,
      },
      addons: ["ai_boost"],
      meta: { badge: "Most popular", trial_days: 14, highlight: true, stripe_price_monthly: "price_1Pro", stripe_price_yearly: "price_1ProY" },
      privateMetaKeys: ["stripe_price_monthly", "stripe_price_yearly"],
      pricingCard: {
        title: "Pro",
        description: "For growing teams that need more power.",
        type: "subscription",
        monthlyPrice: 29,
        yearlyPrice: 290,
        currency: "USD",
        featured: true,
        benefits: [
          { id: "b1", title: "Unlimited projects" },
          { id: "b2", title: "2,500 AI credits / month" },
          { id: "b3", title: "10 team seats" },
          { id: "b4", title: "Custom domain" },
          { id: "b5", title: "Priority support" },
        ],
      },
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Security, control and scale for large organisations.",
      note: "Custom contracts. Limits are set per deal; keep the defaults generous.",
      entitlements: {
        projects: null,
        ai_credits: null,
        seats: null,
        storage_gb: 1000,
        export_pdf: true,
        api_access: true,
        custom_domain: true,
        priority_support: true,
        sso: true,
      },
      addons: ["ai_boost", "extra_storage", "white_label"],
      meta: { badge: "Enterprise", sla: "99.9%", sales_contact: "sales@notebook.ai", hubspot_deal_stage: "closedwon" },
      privateMetaKeys: ["hubspot_deal_stage"],
    },
    {
      id: "lifetime",
      name: "Lifetime deal",
      description: "One-time purchase with Pro-level limits.",
      entitlements: { projects: null, ai_credits: 1000, seats: 5, storage_gb: 50, export_pdf: true, api_access: true },
      meta: { badge: "Lifetime", source: "launch" },
      pricingCard: {
        title: "Lifetime",
        description: "Pay once, use forever.",
        type: "one_time",
        price: 199,
        currency: "USD",
        featured: false,
        benefits: [
          { id: "b1", title: "Unlimited projects" },
          { id: "b2", title: "1,000 AI credits / month" },
          { id: "b3", title: "All future updates" },
        ],
      },
    },
  ],
  incentives: [
    {
      id: "beta_tester",
      name: "Beta tester",
      description: "Thanks for helping us test new features early.",
      entitlements: { ai_credits: 5000 },
      addons: ["ai_boost"],
    },
    {
      id: "appsumo_partner",
      name: "AppSumo partner",
      description: "Partner deal: unlimited projects and 5 seats on any plan.",
      entitlements: { projects: null, seats: 5 },
    },
    {
      id: "black_friday_2026",
      name: "Black Friday 2026",
      description: "Double AI credits and storage through December.",
      entitlements: { ai_credits: 1000, storage_gb: 50 },
    },
    {
      id: "win_back",
      name: "Win-back offer",
      description: "Extra credits for lapsed free users who come back.",
      entitlements: { ai_credits: 200 },
    },
  ],
  accounts: {
    count: 64,
    planWeights: { free: 0.46, starter: 0.24, pro: 0.18, enterprise: 0.05, lifetime: 0.07 },
    incentiveRate: 0.18,
  },
};

export const COURSE_TEMPLATE: SampleTemplate = {
  entitlements: [
    { id: "module_basics", name: "Fundamentals modules", type: "boolean" },
    { id: "module_advanced", name: "Advanced modules", type: "boolean" },
    { id: "community", name: "Community access", type: "boolean" },
    { id: "live_sessions", name: "Live Q&A sessions", type: "usage", description: "Live sessions a student can book." },
    { id: "downloads", name: "Resource downloads", type: "usage" },
  ],
  addons: [{ id: "certificate", name: "Completion certificate" }],
  plans: [
    {
      id: "preview",
      name: "Free preview",
      description: "First two lessons, free.",
      isFree: true,
      entitlements: { module_basics: true, downloads: 5 },
    },
    {
      id: "core",
      name: "Core course",
      description: "The full fundamentals track.",
      entitlements: { module_basics: true, community: true, downloads: 50, live_sessions: 2 },
      pricingCard: { title: "Core", type: "one_time", price: 149, currency: "USD", benefits: [{ id: "b1", title: "Fundamentals track" }] },
    },
    {
      id: "all_access",
      name: "All access",
      description: "Every module, live sessions and the certificate.",
      entitlements: { module_basics: true, module_advanced: true, community: true, downloads: null, live_sessions: 8 },
      addons: ["certificate"],
      pricingCard: {
        title: "All access",
        type: "one_time",
        price: 349,
        currency: "USD",
        featured: true,
        benefits: [
          { id: "b1", title: "Every module" },
          { id: "b2", title: "8 live sessions" },
        ],
      },
    },
  ],
  incentives: [
    {
      id: "cohort_bonus",
      name: "Cohort bonus",
      description: "Extra live sessions for the autumn cohort.",
      entitlements: { live_sessions: 12 },
    },
  ],
  accounts: { count: 18, planWeights: { preview: 0.4, core: 0.35, all_access: 0.25 }, incentiveRate: 0.15 },
};

const FIRST = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Katherine", "Dennis", "Barbara", "Ken", "Radia", "Guido", "Frances", "Tim", "Hedy", "Vint", "Sophie", "John", "Anita", "Bjarne", "Lynn", "Jean", "Edsger", "Shafi", "Leslie"];
const LAST = ["Lovelace", "Hopper", "Torvalds", "Hamilton", "Turing", "Johnson", "Ritchie", "Liskov", "Thompson", "Perlman", "van Rossum", "Allen", "Berners-Lee", "Lamarr", "Cerf", "Wilson", "McCarthy", "Borg", "Stroustrup", "Conway", "Sammet", "Dijkstra", "Goldwasser", "Lamport"];
const COMPANIES = ["Northwind", "Globex", "Initech", "Umbrella Labs", "Hooli", "Stark Studio", "Wayne Analytics", "Acme Robotics", "Soylent", "Vandelay Imports", "Pied Piper", "Aperture", "Cyberdyne", "Tyrell", "Wonka Works", "Oscorp", "Massive Dynamic", "Gringotts", "Monarch", "Blue Sun", "Duff Media", "Prestige Worldwide", "Sterling Cooper", "Dunder Mifflin", "Bluth Company", "Los Pollos", "Nakatomi", "Weyland Labs", "Virtucon", "Rekall", "Gekko & Co", "Planet Express", "Krusty Krab", "Bubba Gump", "Ollivanders", "Paper Street", "Spacely Sprockets", "Cogswell Cogs", "Wernham Hogg", "Hanso Foundation"];

/** Small deterministic PRNG so the sample data looks the same on every boot. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T extends string>(weights: Record<T, number>, r: number): T {
  let acc = 0;
  const entries = Object.entries(weights) as [T, number][];
  for (const [key, w] of entries) {
    acc += w;
    if (r <= acc) return key;
  }
  return entries[entries.length - 1][0];
}

export interface SeededAccount {
  id: string;
  plan: string;
  incentive: string | null;
  createdAt: Date;
}

/** Creates the catalog and accounts for one app. Returns the accounts so callers can add usage history. */
export async function seedSampleApp(call: OfferApiCall, appId: string, template: SampleTemplate, seed = 7) {
  const base = `/apps/${appId}`;
  const random = rng(seed);

  for (const e of template.entitlements) await call("POST", `${base}/entitlements`, e);
  for (const a of template.addons) await call("POST", `${base}/addons`, a);

  for (const p of template.plans) {
    await call("POST", `${base}/plans`, {
      id: p.id,
      name: p.name,
      description: p.description,
      isFree: p.isFree ?? false,
      note: p.note ?? null,
      pricingCard: p.pricingCard ?? null,
    });
    for (const [id, max] of Object.entries(p.entitlements)) {
      await call("POST", `${base}/plans/${p.id}/entitlements`, max === true ? { id } : { id, max });
    }
    for (const id of p.addons ?? []) await call("POST", `${base}/plans/${p.id}/addons`, { id });
    if (p.meta) await call("PATCH", `${base}/plans/${p.id}/meta`, p.meta);
    if (p.privateMetaKeys) await call("PATCH", `${base}/plans/${p.id}`, { privateMetaKeys: p.privateMetaKeys });
  }

  for (const i of template.incentives) {
    await call("POST", `${base}/incentives`, { id: i.id, name: i.name, description: i.description });
    for (const [id, max] of Object.entries(i.entitlements)) {
      await call("POST", `${base}/incentives/${i.id}/entitlements`, { id, max });
    }
    for (const id of i.addons ?? []) await call("POST", `${base}/incentives/${i.id}/addons`, { id });
  }

  const accounts: SeededAccount[] = [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const companies = [...COMPANIES].sort(() => random() - 0.5);
  for (let n = 0; n < template.accounts.count; n++) {
    const isTeam = companies.length > 0 && random() < 0.45;
    let name: string;
    let id: string;
    if (isTeam) {
      name = companies.pop()!;
      id = `team_${name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "")}`;
    } else {
      do name = `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]}`;
      while (usedNames.has(name));
      do id = `usr_${Math.floor(random() * 90_000 + 10_000)}`;
      while (usedIds.has(id));
    }
    usedNames.add(name);
    usedIds.add(id);

    const plan = weighted(template.accounts.planWeights, random());
    const incentive =
      random() < template.accounts.incentiveRate
        ? template.incentives[Math.floor(random() * template.incentives.length)]?.id ?? null
        : null;
    await call("POST", `${base}/namespaces`, { id, name, plan, incentive });
    accounts.push({ id, plan, incentive, createdAt: sampleSignupDate(random) });
  }

  return { accounts, random };
}

/** Spreads sign-ups over the last ~6 months, denser recently (at least a few days old). */
export function sampleSignupDate(random: () => number, now = Date.now()) {
  const daysAgo = 3 + Math.floor(Math.pow(random(), 1.6) * 177);
  return new Date(now - daysAgo * 86_400_000);
}

export interface SampleUsageEvent {
  namespace_id: string;
  entitlement_id: string;
  operation: "add" | "remove" | "amount";
  amount: number;
  created_at: string;
}

/**
 * Months of usage for seeded accounts, so analytics have shape: most accounts sit well
 * inside their limits, a few run hot so the UI shows warnings. Events come grouped by
 * account and entitlement, oldest first within each group.
 */
export function sampleUsageHistory(
  template: SampleTemplate,
  accounts: SeededAccount[],
  random: () => number,
  now = Date.now(),
): SampleUsageEvent[] {
  const usageIds = template.entitlements.filter((e) => e.type === "usage").map((e) => e.id);
  const events: SampleUsageEvent[] = [];

  for (const account of accounts) {
    const start = account.createdAt.getTime();
    // Newer accounts have had less time to use things.
    const age = Math.min(1, (now - start) / (60 * 86_400_000));

    for (const entitlementId of usageIds) {
      const max = effectiveMax(template, account, entitlementId);
      if (max === undefined) continue;
      const r = random();
      const ratio = r < 0.12 ? 0.92 + random() * 0.12 : r < 0.3 ? 0.65 + random() * 0.25 : random() * 0.6;
      const target = Math.max(1, Math.round((max === null ? 40 + random() * 900 : max * ratio) * (0.3 + 0.7 * age)));

      const chunky = entitlementId === "ai_credits" || entitlementId === "downloads" || entitlementId === "storage_gb";
      const steps: { op: SampleUsageEvent["operation"]; amount: number }[] = [];
      let total = 0;
      while (total < target) {
        const amount = chunky ? Math.min(target - total, Math.ceil(random() * Math.max(3, target / 18))) : 1;
        steps.push({ op: chunky ? "amount" : "add", amount });
        total += amount;
        // Occasional deletes (e.g. a project archived) followed by a re-add.
        if (!chunky && random() < 0.06 && total > 1) {
          steps.push({ op: "remove", amount: -1 }, { op: "add", amount: 1 });
        }
      }

      const span = now - start;
      const times = steps.map(() => start + Math.pow(random(), 0.75) * span).sort((a, b) => a - b);
      steps.forEach((s, i) =>
        events.push({
          namespace_id: account.id,
          entitlement_id: entitlementId,
          operation: s.op,
          amount: s.amount,
          created_at: new Date(times[i]).toISOString(),
        }),
      );
    }
  }
  return events;
}

/** Effective max for an entitlement on an account (incentive overrides the plan), or undefined if not granted. */
export function effectiveMax(template: SampleTemplate, account: SeededAccount, entitlementId: string) {
  const incentive = template.incentives.find((i) => i.id === account.incentive);
  if (incentive && entitlementId in incentive.entitlements) return incentive.entitlements[entitlementId];
  const plan = template.plans.find((p) => p.id === account.plan);
  if (!plan || !(entitlementId in plan.entitlements)) return undefined;
  const max = plan.entitlements[entitlementId];
  return max === true ? undefined : max;
}
