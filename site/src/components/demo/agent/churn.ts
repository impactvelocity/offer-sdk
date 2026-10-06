import { money } from "../state";
import type { TraceStep } from "./trace";

/*
 * Churn save: a Pro customer clicks cancel, and the agent picks a save offer from the ones the
 * guardrails allow, based on who the customer is and why they're leaving. Scripted, not a model:
 * the decision rules below stand in for `/offers/decide`.
 */

export type PersonaId = "power" | "light" | "capped" | "team";
export type Reason = "price" | "unused" | "credits" | "feature" | "competitor";
type Kind = "discount_credits" | "discount" | "credits" | "feature" | "pause" | "downgrade";

export interface Persona {
  id: PersonaId;
  name: string;
  initials: string;
  note: string;
  tenure: number;
  creditsPct: number;
  activeDays: number;
  seats: string;
  /** Months we expect them to stay if saved. */
  expectedMonths: number;
  /** Biggest discount the agent would reach for, before guardrails. */
  idealDiscount: number;
  reason: Reason;
}

export const PRO_PRICE = 29;

export const personas: Persona[] = [
  { id: "power", name: "Maya Chen", initials: "MC", note: "Power user, 14 months on Pro", tenure: 14, creditsPct: 82, activeDays: 26, seats: "2/3", expectedMonths: 14, idealDiscount: 40, reason: "price" },
  { id: "light", name: "Sam Ortiz", initials: "SO", note: "Barely active, 2 months on Pro", tenure: 2, creditsPct: 9, activeDays: 3, seats: "1/3", expectedMonths: 5, idealDiscount: 20, reason: "unused" },
  { id: "capped", name: "Priya Nair", initials: "PN", note: "At the credit limit 3 months running", tenure: 8, creditsPct: 100, activeDays: 29, seats: "1/3", expectedMonths: 12, idealDiscount: 30, reason: "credits" },
  { id: "team", name: "Leo Park", initials: "LP", note: "Team outgrew Pro's 3 seats", tenure: 5, creditsPct: 61, activeDays: 22, seats: "3/3", expectedMonths: 12, idealDiscount: 30, reason: "feature" },
];

export const reasons: { id: Reason; label: string }[] = [
  { id: "price", label: "It's too expensive" },
  { id: "unused", label: "I'm not using it enough" },
  { id: "credits", label: "I keep running out of credits" },
  { id: "feature", label: "It's missing something I need" },
  { id: "competitor", label: "I'm switching to another tool" },
];

export interface Guardrails {
  maxDiscount: "0" | "20" | "40" | "50";
  credits: boolean;
  features: boolean;
  pause: boolean;
  downgrade: boolean;
}

export const defaultGuardrails: Guardrails = { maxDiscount: "40", credits: true, features: true, pause: true, downgrade: true };

export interface SaveOffer {
  id: string;
  kind: Kind;
  headline: string;
  body: string;
  grants: string[];
  price: { now: string; was?: string };
  cta: string;
  rationale: string;
  /** Webhooks fired when the customer accepts. */
  events: TraceStep[];
  /** Monthly revenue kept if they accept. */
  monthly: number;
}

const preferences: Record<Reason, Kind[]> = {
  price: ["discount_credits", "discount", "downgrade", "pause", "credits"],
  unused: ["pause", "downgrade", "discount"],
  credits: ["credits", "discount_credits", "discount"],
  feature: ["feature", "discount", "credits"],
  competitor: ["discount_credits", "discount", "feature", "credits"],
};

const family = (k: Kind) => (k === "discount_credits" ? "discount" : k);

function engagement(p: Persona) {
  return p.activeDays >= 20
    ? `High engagement (${p.activeDays}/30 days active).`
    : p.activeDays <= 5
      ? `Low engagement (${p.activeDays}/30 days active).`
      : `Medium engagement (${p.activeDays}/30 days active).`;
}

function makeOffer(kind: Kind, p: Persona, g: Guardrails, reason: Reason): SaveOffer | null {
  const max = Number(g.maxDiscount);
  const pct = Math.min(p.idealDiscount, max);
  const cap = pct < p.idealDiscount ? ` (capped by your ${max}% guardrail)` : "";
  const bonus = p.id === "capped" ? 5000 : 2000;
  const first = p.name.split(" ")[0];
  const id = `offer_${p.id.slice(0, 2)}${kind.slice(0, 3)}${pct}`;

  switch (kind) {
    case "discount_credits":
    case "discount": {
      if (!pct || (kind === "discount_credits" && !g.credits)) return null;
      const now = Math.round(PRO_PRICE * (100 - pct)) / 100;
      const plus = kind === "discount_credits";
      return {
        id,
        kind,
        headline: `Stay on Pro for ${money(now)}/mo, ${first}`,
        body:
          p.activeDays >= 20
            ? `You've written with AI on ${p.activeDays} of the last 30 days, so we'd hate for you to lose Pro. Keep it at ${pct}% off for the next 3 months${plus ? `, plus ${bonus.toLocaleString("en-US")} bonus credits` : ""}.`
            : `Keep everything in Pro at ${pct}% off for the next 3 months. You can still cancel any time.`,
        grants: [`${pct}% off for 3 months`, ...(plus ? [`+${bonus.toLocaleString("en-US")} AI credits`] : [])],
        price: { now: `${money(now)}/mo`, was: `${money(PRO_PRICE)}/mo` },
        cta: `Keep Pro for ${money(now)}/mo`,
        rationale: `${engagement(p)} ${reason === "competitor" ? "They're comparing prices with another tool" : "Price is the barrier"}, so lead with ${pct}% off${cap}${plus ? ", and add bonus credits so staying feels generous rather than cheap" : ""}.`,
        events: [
          { kind: "event", tag: "HOOK", text: "incentive.applied", status: `${pct}% off · 3 cycles`, tone: "info" },
          ...(plus ? [{ kind: "event", tag: "HOOK", text: "addon.granted", status: `credit_pack +${bonus}`, tone: "info" } as const] : []),
        ],
        monthly: now,
      };
    }
    case "credits":
      if (!g.credits) return null;
      return {
        id,
        kind,
        headline: `Here are ${bonus.toLocaleString("en-US")} more credits, on us`,
        body:
          p.creditsPct >= 100
            ? `You've hit your credit limit 3 months in a row. That's our limit getting in your way, not you. Take ${bonus.toLocaleString("en-US")} credits free and keep Pro at the same price.`
            : `Take ${bonus.toLocaleString("en-US")} extra AI credits free this month and keep Pro at the same price.`,
        grants: [`+${bonus.toLocaleString("en-US")} AI credits`, "Pro price unchanged"],
        price: { now: `${money(PRO_PRICE)}/mo` },
        cta: "Add the credits",
        rationale: `${engagement(p)} They're blocked by the credit limit, not the price. Credits cost us little and remove the barrier, with no discount needed.`,
        events: [{ kind: "event", tag: "HOOK", text: "addon.granted", status: `credit_pack +${bonus}`, tone: "info" }],
        monthly: PRO_PRICE,
      };
    case "feature":
      if (!g.features) return null;
      return {
        id,
        kind,
        headline: "Try Team free for 30 days",
        body:
          p.id === "team"
            ? "Two of your invites were blocked by Pro's 3-seat limit. Unlock 10 seats and custom domains for 30 days, free, then decide."
            : "Unlock 10 seats, custom domains and 20,000 credits for 30 days, free, then decide.",
        grants: ["10 seats for 30 days", "Custom domains", `Still ${money(PRO_PRICE)}/mo`],
        price: { now: `${money(PRO_PRICE)}/mo` },
        cta: "Unlock Team features",
        rationale: `${engagement(p)} They need more than Pro allows. A 30-day Team unlock shows the value before asking for more money, and it's a natural path to an upgrade.`,
        events: [
          { kind: "event", tag: "HOOK", text: "entitlement.granted", status: "seats=10 · 30d", tone: "info" },
          { kind: "event", tag: "HOOK", text: "entitlement.granted", status: "custom_domains · 30d", tone: "info" },
        ],
        monthly: PRO_PRICE,
      };
    case "pause":
      if (!g.pause) return null;
      return {
        id,
        kind,
        headline: "Pause instead of canceling",
        body: `You've opened Acme Docs on ${p.activeDays} of the last 30 days. Pause for 2 months, keep every doc, and pay nothing until you're back.`,
        grants: ["2 months at $0", "Docs and settings kept"],
        price: { now: "$0 for 2 months", was: `${money(PRO_PRICE)}/mo` },
        cta: "Pause for 2 months",
        rationale: `${engagement(p)} A discount won't fix low usage. A pause keeps the account and payment method, costs nothing, and most paused accounts resume.`,
        events: [{ kind: "event", tag: "HOOK", text: "subscription.paused", status: "resumes Jan 5", tone: "info" }],
        monthly: PRO_PRICE * 0.5,
      };
    case "downgrade":
      if (!g.downgrade) return null;
      return {
        id,
        kind,
        headline: "Switch to Starter for $9/mo",
        body: "Keep your docs and 500 AI credits a month for a third of the price. Move back to Pro whenever you need it.",
        grants: ["Starter · $9/mo", "500 AI credits / month"],
        price: { now: "$9/mo", was: `${money(PRO_PRICE)}/mo` },
        cta: "Switch to Starter",
        rationale: `${engagement(p)} They don't use enough of Pro to justify the price. A cheaper plan keeps them paying instead of leaving.`,
        events: [{ kind: "event", tag: "HOOK", text: "subscription.updated", status: "pro → starter", tone: "info" }],
        monthly: 9,
      };
  }
}

/** Up to two offers (main, then a fallback after "No thanks"), best first. */
export function decide(p: Persona, reason: Reason, g: Guardrails): SaveOffer[] {
  let kinds = preferences[reason];
  if (p.activeDays <= 5) {
    // Low-usage customers don't need credits, and a cheaper plan beats a discount.
    kinds = reason === "price" ? ["downgrade", "pause", "discount"] : kinds.filter((k) => k !== "discount_credits" && k !== "credits");
  }
  const out: SaveOffer[] = [];
  for (const k of kinds) {
    if (out.some((o) => family(o.kind) === family(k))) continue;
    const offer = makeOffer(k, p, g, reason);
    if (offer) out.push(offer);
    if (out.length === 2) break;
  }
  return out;
}

export function policyLine(g: Guardrails) {
  const yes = (b: boolean) => (b ? "✓" : "✗");
  return `discount ≤ ${g.maxDiscount}% · credits ${yes(g.credits)} · features ${yes(g.features)} · pause ${yes(g.pause)} · downgrade ${yes(g.downgrade)}`;
}

/** What the agent does between the cancel click and the offer appearing. */
export function decideSteps(p: Persona, reason: Reason, g: Guardrails, offers: SaveOffer[]): TraceStep[] {
  const label = reasons.find((r) => r.id === reason)!.label;
  const [main, fallback] = offers;
  return [
    { kind: "event", tag: "POST", text: `/offers/decide { trigger: "cancel" }`, status: "streaming", tone: "info" },
    { kind: "tool", name: "get_account", args: "acct_42", result: `${p.name} · Pro ${money(PRO_PRICE)}/mo · ${p.tenure} months · LTV ${money(p.tenure * PRO_PRICE)}` },
    { kind: "tool", name: "get_usage", args: "acct_42, 30d", result: `ai_credits ${p.creditsPct}% · active ${p.activeDays}/30 days · seats ${p.seats}` },
    { kind: "tool", name: "get_policy", args: "cancel_save", result: policyLine(g) },
    main
      ? { kind: "think", text: `Customer said "${label}". ${main.rationale}` }
      : { kind: "think", text: `Customer said "${label}". Nothing inside your guardrails fits this customer, so don't make an offer. Let them cancel cleanly and try a win-back later.` },
    ...(main
      ? ([
          {
            kind: "tool",
            name: "create_offer",
            args: `${main.kind}${fallback ? `, fallback: ${fallback.kind}` : ""}`,
            result: `${main.id} · expires in 48h`,
          },
          { kind: "think", text: "Writing the copy for this customer…" },
        ] satisfies TraceStep[])
      : []),
  ];
}
