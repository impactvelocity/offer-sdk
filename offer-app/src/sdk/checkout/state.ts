import type { Interval, OfferBump, OfferPlan, OfferPrice, PublicOffer } from "./types";

// Pure selection and pricing logic behind <OfferProvider>. The server prices
// every checkout again; this only drives what the page shows.

export interface Selection {
  plan: string | null;
  interval: Interval | null;
  bumps: string[];
}

export const INTERVAL_LABELS: Record<Interval, string> = { month: "Monthly", year: "Yearly", once: "Lifetime" };

export function planPrice(offer: PublicOffer, planId: string | null, interval: Interval | null): OfferPrice | null {
  if (!planId || !interval) return null;
  return offer.plans.find((p) => p.id === planId)?.prices[interval] ?? null;
}

/** Plans sold for an interval, in the offer's order. */
export const plansFor = (offer: PublicOffer, interval: Interval | null): OfferPlan[] =>
  interval ? offer.plans.filter((p) => p.prices[interval]) : [];

const bumpApplies = (bump: OfferBump, plan: string | null, interval: Interval | null) =>
  (!bump.applies_to?.plans || (!!plan && bump.applies_to.plans.includes(plan))) &&
  (!bump.applies_to?.intervals || (!!interval && bump.applies_to.intervals.includes(interval)));

/** Bumps that can be added to the current plan and interval. */
export const availableBumps = (offer: PublicOffer, sel: Selection): OfferBump[] =>
  offer.bumps.filter((b) => bumpApplies(b, sel.plan, sel.interval));

/** Keeps the selection valid: a plan sold for the interval, and only bumps that apply. */
export function normalize(offer: PublicOffer, sel: Selection): Selection {
  const interval = sel.interval && offer.intervals.includes(sel.interval) ? sel.interval : (offer.default_interval ?? offer.intervals[0] ?? null);
  const plans = plansFor(offer, interval);
  const plan = plans.some((p) => p.id === sel.plan)
    ? sel.plan
    : (plans.find((p) => p.id === offer.default_plan)?.id ?? plans[0]?.id ?? null);
  const allowed = new Set(availableBumps(offer, { plan, interval, bumps: [] }).map((b) => b.id));
  return { plan, interval, bumps: sel.bumps.filter((b) => allowed.has(b)) };
}

export const initialSelection = (offer: PublicOffer, preferred: Partial<Selection> = {}): Selection =>
  normalize(offer, { plan: preferred.plan ?? null, interval: preferred.interval ?? null, bumps: preferred.bumps ?? [] });

export interface Summary {
  plan: OfferPlan | null;
  interval: Interval | null;
  price: OfferPrice | null;
  bumps: OfferBump[];
  /** Charged when the buyer approves: the first period plus one-time bumps. */
  totalToday: number;
  /** The recurring charge after the discounted cycles, when it changes. */
  renewal: { amount: number; afterCycles: number } | null;
  ready: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function summarize(offer: PublicOffer, sel: Selection): Summary {
  const plan = offer.plans.find((p) => p.id === sel.plan) ?? null;
  const price = planPrice(offer, sel.plan, sel.interval);
  const bumps = availableBumps(offer, sel).filter((b) => sel.bumps.includes(b.id));
  const totalToday = round((price?.amount ?? 0) + bumps.reduce((sum, b) => sum + b.amount, 0));
  return {
    plan,
    interval: sel.interval,
    price,
    bumps,
    totalToday,
    renewal: price?.cycles && price.then !== null ? { amount: price.then, afterCycles: price.cycles } : null,
    ready: !!plan && !!price && totalToday > 0,
  };
}

// ─── Formatting ────────────────────────────────────────

export function formatMoney(amount: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

const PER: Record<Interval, string> = { month: "/mo", year: "/yr", once: "" };

/** "$10/mo", "$299". */
export const priceLabel = (amount: number, interval: Interval, currency: string) =>
  `${formatMoney(amount, currency)}${PER[interval]}`;

/** "for 3 months, then $20/mo", or null when the price never changes. */
export function renewalLabel(price: OfferPrice, interval: Interval, currency: string): string | null {
  if (!price.cycles || price.then === null || interval === "once") return null;
  const unit = interval === "year" ? "year" : "month";
  return `for ${price.cycles} ${unit}${price.cycles > 1 ? "s" : ""}, then ${priceLabel(price.then, interval, currency)}`;
}

/** Percent off the list price, rounded to a whole percent, or null. */
export function savings(price: OfferPrice): number | null {
  if (price.list_price === null || price.list_price <= 0 || price.amount >= price.list_price) return null;
  return Math.round((1 - price.amount / price.list_price) * 100);
}
