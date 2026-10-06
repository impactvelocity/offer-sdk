import { money } from "../state";
import type { TraceStep } from "./trace";

/*
 * Dynamic checkout: one checkout page, composed per visitor. The agent reads where the visitor
 * came from and what we know about them, then picks the plan, billing interval, discount, order
 * bump and copy, all inside the guardrails. The control variant is the static page.
 */

export type VisitorId = "partner" | "ad" | "returning" | "bf";
export type CheckoutPlan = "starter" | "pro" | "team";
export type Interval = "month" | "year";
export type BumpId = "templates" | "call" | "credits";

export interface Visitor {
  id: VisitorId;
  label: string;
  note: string;
  query: string;
  context: string;
  history: { tool: string; args: string; result: string };
}

export const visitors: Visitor[] = [
  {
    id: "partner",
    label: "Partner link",
    note: "offer.to/sarah · first visit",
    query: "?ref=sarah",
    context: "ref=sarah · mobile · first visit",
    history: { tool: "get_partner", args: '"sarah"', result: "@sarahbuilds · creator audience · deal: 30% × 3 months" },
  },
  {
    id: "ad",
    label: "Search ad",
    note: '"cheap ai doc editor"',
    query: "?utm_source=google&utm_term=cheap+ai+docs",
    context: 'utm_source=google · term "cheap ai doc editor" · desktop',
    history: { tool: "get_segment", args: '"paid_search"', result: "price-sensitive · 62% pick the cheapest plan" },
  },
  {
    id: "returning",
    label: "Returning trial",
    note: "Trial ended 2 days ago · 4 invites",
    query: "?acct=acct_88",
    context: "acct_88 · 3rd pricing visit this week",
    history: { tool: "get_account", args: "acct_88", result: "Pro trial ended 2d ago · invited 4 teammates · 41 docs" },
  },
  {
    id: "bf",
    label: "Black Friday email",
    note: "On Free for 18 months",
    query: "?utm_campaign=bf",
    context: "utm_campaign=bf · email click · desktop",
    history: { tool: "get_account", args: "acct_17", result: "Free · 18 months · active 19/30 days · hits credit cap monthly" },
  },
];

export const checkoutPlans: Record<CheckoutPlan, { name: string; month: number; year: number; blurb: string }> = {
  starter: { name: "Starter", month: 9, year: 90, blurb: "500 AI credits · 1 seat" },
  pro: { name: "Pro", month: 29, year: 290, blurb: "5,000 AI credits · 3 seats · PDF export" },
  team: { name: "Team", month: 79, year: 790, blurb: "20,000 AI credits · 10 seats · custom domains" },
};

export const bumps: Record<BumpId, { name: string; price: number; blurb: string }> = {
  templates: { name: "Creator template pack", price: 19, blurb: "60 ready-made templates for posts, newsletters and scripts." },
  call: { name: "Team onboarding call", price: 50, blurb: "45 minutes with our team to set up your workspace." },
  credits: { name: "+2,000 AI credits", price: 10, blurb: "A one-time top-up that never expires." },
};

export interface Guardrails {
  maxDiscount: "0" | "20" | "30" | "50";
  bumps: Record<BumpId, boolean>;
}

export const defaultGuardrails: Guardrails = { maxDiscount: "30", bumps: { templates: true, call: true, credits: true } };

export interface Page {
  id: string;
  headline: string;
  sub: string;
  badge?: string;
  plan: CheckoutPlan;
  interval: Interval;
  /** Percent off the first 3 months (monthly) or first year (yearly). */
  discount: number;
  bump: BumpId | null;
  rationale: string;
}

export const controlPage: Page = {
  id: "pro_default",
  headline: "Choose your plan",
  sub: "Simple pricing for everyone. Cancel anytime.",
  plan: "pro",
  interval: "month",
  discount: 0,
  bump: "templates",
  rationale: "",
};

const recipes: Record<
  VisitorId,
  { plan: CheckoutPlan; interval: Interval; ideal: number; bumps: BumpId[]; why: string; copy: (pct: number) => { headline: string; sub: string; badge?: string } }
> = {
  partner: {
    plan: "pro",
    interval: "month",
    ideal: 30,
    bumps: ["templates", "credits", "call"],
    why: "Partner traffic converts best on the partner's own pick, so lead with Pro, keep the partner's deal, and bump the template pack her creator audience buys most.",
    copy: (pct) => ({
      headline: pct ? `Pro at ${pct}% off, picked by @sarahbuilds` : "The writing kit @sarahbuilds uses",
      sub: pct ? `Her audience gets ${pct}% off Pro for 3 months. Write, publish and repurpose with AI.` : "Write, publish and repurpose with AI, the same setup Sarah uses.",
      badge: "Recommended by @sarahbuilds",
    }),
  },
  ad: {
    plan: "starter",
    interval: "month",
    ideal: 0,
    bumps: ["credits", "templates"],
    why: "The search term signals price sensitivity. Lead with the lowest price instead of a discount, show Pro one step up, and offer a small credit top-up to lift order value.",
    copy: () => ({ headline: "Write with AI from $9/mo", sub: "Start small and upgrade when you outgrow it. Cancel anytime." }),
  },
  returning: {
    plan: "team",
    interval: "year",
    ideal: 20,
    bumps: ["call", "templates"],
    why: "They invited 4 teammates during the trial, more than Pro's 3 seats, so recommend Team. Yearly suits a team decision, and an onboarding call helps the rollout.",
    copy: (pct) => ({
      headline: "Bring your team of 4 onto Team",
      sub: pct ? `Your trial workspace and 41 docs are still here. Get ${pct}% off your first year.` : "Your trial workspace and 41 docs are still here. Pick up where you left off.",
    }),
  },
  bf: {
    plan: "pro",
    interval: "year",
    ideal: 50,
    bumps: ["credits", "templates"],
    why: "Long-time Free user who hits the credit cap every month. A big yearly Black Friday deal converts this segment and locks in 12 months; a credit top-up matches their pain.",
    copy: (pct) => ({
      headline: pct ? `Black Friday: Pro at ${pct}% off for a year` : "Black Friday: Pro, billed yearly",
      sub: "You've been on Free for 18 months and hit the credit cap every month. Pro gives you 10× the credits.",
    }),
  },
};

export function compose(v: Visitor, g: Guardrails): Page {
  const r = recipes[v.id];
  const max = Number(g.maxDiscount);
  const pct = Math.min(r.ideal, max);
  const bump = r.bumps.find((b) => g.bumps[b]) ?? null;
  const cap = r.ideal && pct < r.ideal ? (pct ? ` Discount capped at your ${max}% guardrail.` : " Discounts are off, so lead on value instead.") : "";
  return {
    id: `offer_auto_${v.id}${pct ? `_${pct}` : ""}`,
    ...r.copy(pct),
    plan: r.plan,
    interval: r.interval,
    discount: pct,
    bump,
    rationale: r.why + cap + (bump || !r.bumps.length ? "" : " No bump is allowed, so skip it."),
  };
}

export function price(plan: CheckoutPlan, interval: Interval, discount: number) {
  const base = checkoutPlans[plan][interval];
  return { base, now: Math.round(base * (100 - discount)) / 100 };
}

export function composeSteps(v: Visitor, g: Guardrails, page: Page): TraceStep[] {
  const allowed = (Object.keys(g.bumps) as BumpId[]).filter((b) => g.bumps[b]);
  const plan = checkoutPlans[page.plan];
  return [
    { kind: "event", tag: "GET", text: `/checkout${v.query}`, status: "page view", tone: "info" },
    { kind: "event", tag: "POST", text: '/offers/decide { trigger: "checkout" }', status: "streaming", tone: "info" },
    { kind: "tool", name: "get_visitor_context", args: "", result: v.context },
    { kind: "tool", name: v.history.tool, args: v.history.args, result: v.history.result },
    { kind: "tool", name: "get_policy", args: "checkout", result: `discount ≤ ${g.maxDiscount}% · bumps: ${allowed.join(", ") || "none"}` },
    { kind: "think", text: page.rationale },
    {
      kind: "tool",
      name: "compose_offer",
      args: `${page.plan}, ${page.interval}`,
      result: `${page.id} · ${plan.name} ${page.interval === "year" ? "yearly" : "monthly"}${page.discount ? ` · ${page.discount}% off` : ""}${page.bump ? ` · bump: ${page.bump}` : ""}`,
    },
    { kind: "think", text: "Writing the headline for this visitor…" },
  ];
}

export function purchaseSteps(v: Visitor | null, page: Page, plan: CheckoutPlan, interval: Interval, bump: BumpId | null, total: number): TraceStep[] {
  return [
    { kind: "event", tag: "POST", text: "/checkout/orders", status: `201 · ${money(total)}`, tone: "ok" },
    { kind: "event", tag: "HOOK", text: "payment.captured", status: "PayPal", tone: "ok" },
    { kind: "event", tag: "HOOK", text: "subscription.created", status: `${plan} · ${interval}ly`, tone: "info" },
    ...(bump ? [{ kind: "event", tag: "HOOK", text: "addon.granted", status: bump, tone: "info" } as const] : []),
    ...(v?.id === "partner" ? [{ kind: "event", tag: "HOOK", text: "partner.credited", status: "@sarahbuilds", tone: "info" } as const] : []),
    { kind: "done", text: `Converted on ${page.id === controlPage.id ? "the control page" : page.id}` },
  ];
}
