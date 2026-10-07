import { getDoc, listDocs } from "../db/docs.ts";
import { ApiError, type Json } from "./http.ts";
import { addDuration, listPrice } from "./offers.ts";
import { MAX_PAUSE_MONTHS } from "./pauses.ts";
import { monthly } from "./plan-changes.ts";

// A cancel flow is what a customer goes through after pressing "Cancel" in an
// app: questions (why are you leaving?), then a save offer, then a final
// confirmation. The SDK renders it; this file validates flows, walks their
// steps and turns offer specs into concrete offers for one account.

export const OFFER_KINDS = ["discount", "pause", "downgrade", "incentive"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export type OfferSpec =
  | { kind: "discount"; percent: number; cycles: number; copy?: Copy }
  | { kind: "pause"; months: number; copy?: Copy }
  | { kind: "downgrade"; plan: string; copy?: Copy }
  | { kind: "incentive"; incentive: string; months: number; copy?: Copy };

export type Copy = { headline?: string; body?: string; cta?: string };

export type Guardrails = {
  kinds: OfferKind[];
  max_discount_percent: number;
  max_discount_cycles: number;
  max_pause_months: number;
  max_incentive_months: number;
  /** Incentives the model may offer. Empty: none. */
  incentives: string[];
  /** Plans the model may move the account down to. Empty: any cheaper plan. */
  downgrade_plans: string[];
  /** Brand voice and anything else the model should know. */
  instructions: string;
};

export type Answer = { id: string; label: string; next?: string | null; text?: boolean };

export type Step =
  | { id: string; type: "question"; title: string; description?: string; answers: Answer[]; next?: string | null }
  | { id: string; type: "text"; title: string; description?: string; placeholder?: string; required?: boolean; next?: string | null }
  | {
      id: string;
      type: "offer";
      title?: string;
      dynamic: boolean;
      guardrails: Guardrails;
      default: OfferSpec | null;
      by_answer: Record<string, OfferSpec | null>;
      decline_label?: string;
      next?: string | null;
    }
  | { id: string; type: "confirm"; title: string; description?: string; cta?: string };

export const DEFAULT_GUARDRAILS: Guardrails = {
  kinds: [...OFFER_KINDS],
  max_discount_percent: 50,
  max_discount_cycles: 3,
  max_pause_months: 3,
  max_incentive_months: 3,
  incentives: [],
  downgrade_plans: [],
  instructions: "",
};

// What a new flow starts with: the common reasons people leave and a save
// offer for the two that money or time can fix.
export function templateSteps(): Step[] {
  return [
    {
      id: "reason",
      type: "question",
      title: "Why are you cancelling?",
      description: "Your answer helps us improve. It only takes a second.",
      answers: [
        { id: "too_expensive", label: "It's too expensive" },
        { id: "not_using", label: "I'm not using it enough" },
        { id: "missing_feature", label: "It's missing something I need", text: true },
        { id: "switching", label: "I'm switching to another tool", text: true },
        { id: "temporary", label: "I only needed it for a short project" },
        { id: "other", label: "Something else", text: true },
      ],
    },
    {
      id: "save",
      type: "offer",
      title: "Before you go",
      dynamic: false,
      guardrails: { ...DEFAULT_GUARDRAILS },
      default: null,
      by_answer: {
        too_expensive: { kind: "discount", percent: 30, cycles: 3 },
        not_using: { kind: "pause", months: 2 },
        temporary: { kind: "pause", months: 3 },
      },
      decline_label: "No thanks, continue cancelling",
    },
    {
      id: "confirm",
      type: "confirm",
      title: "Cancel your subscription?",
      description: "Billing stops now and your account moves to the free plan. You can subscribe again any time.",
      cta: "Cancel subscription",
    },
  ];
}

// ─── Validation ────────────────────────────────────────

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const isObject = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optStr = (v: unknown, max: number) => str(v, max) || undefined;
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

type Catalog = { plans: Set<string>; incentives: Set<string> };

export async function loadFlowCatalog(appId: string): Promise<Catalog> {
  const [plans, incentives] = await Promise.all([listDocs("plans", appId), listDocs("incentives", appId)]);
  return { plans: new Set(plans.map((p) => p.id)), incentives: new Set(incentives.map((i) => i.id)) };
}

function copyOf(v: unknown): Copy | undefined {
  if (!isObject(v)) return undefined;
  const copy = { headline: optStr(v.headline, 120), body: optStr(v.body, 500), cta: optStr(v.cta, 60) };
  return Object.values(copy).some(Boolean) ? JSON.parse(JSON.stringify(copy)) : undefined;
}

function offerSpec(v: unknown, where: string, catalog: Catalog): OfferSpec | null {
  if (v === null || v === undefined) return null;
  const fail = (msg: string): never => {
    throw new ApiError(400, `${where}: ${msg}`);
  };
  if (!isObject(v)) fail("must be an object or null");
  const s = v as Json;
  const copy = copyOf(s.copy);
  switch (s.kind) {
    case "discount":
      if (!int(s.percent, 1, 90)) fail("percent must be an integer from 1 to 90");
      if (!int(s.cycles, 1, 24)) fail("cycles must be an integer from 1 to 24");
      return { kind: "discount", percent: s.percent, cycles: s.cycles, copy };
    case "pause":
      if (!int(s.months, 1, MAX_PAUSE_MONTHS)) fail(`months must be an integer from 1 to ${MAX_PAUSE_MONTHS}`);
      return { kind: "pause", months: s.months, copy };
    case "downgrade":
      if (typeof s.plan !== "string" || !catalog.plans.has(s.plan)) fail(`plan "${s.plan}" not found`);
      return { kind: "downgrade", plan: s.plan, copy };
    case "incentive":
      if (typeof s.incentive !== "string" || !catalog.incentives.has(s.incentive)) fail(`incentive "${s.incentive}" not found`);
      if (!int(s.months, 1, 24)) fail("months must be an integer from 1 to 24");
      return { kind: "incentive", incentive: s.incentive, months: s.months, copy };
    default:
      return fail(`kind must be one of ${OFFER_KINDS.join(", ")}`);
  }
}

function guardrails(v: unknown, where: string, catalog: Catalog): Guardrails {
  const g = isObject(v) ? v : {};
  const fail = (msg: string): never => {
    throw new ApiError(400, `${where}.guardrails: ${msg}`);
  };
  const out: Guardrails = { ...DEFAULT_GUARDRAILS, ...g } as Guardrails;
  if (!Array.isArray(out.kinds) || !out.kinds.every((k) => (OFFER_KINDS as readonly string[]).includes(k))) {
    fail(`kinds must be a list of ${OFFER_KINDS.join(", ")}`);
  }
  if (!int(out.max_discount_percent, 1, 90)) fail("max_discount_percent must be from 1 to 90");
  if (!int(out.max_discount_cycles, 1, 24)) fail("max_discount_cycles must be from 1 to 24");
  if (!int(out.max_pause_months, 1, MAX_PAUSE_MONTHS)) fail(`max_pause_months must be from 1 to ${MAX_PAUSE_MONTHS}`);
  if (!int(out.max_incentive_months, 1, 24)) fail("max_incentive_months must be from 1 to 24");
  for (const id of out.incentives ?? []) if (!catalog.incentives.has(id)) fail(`incentive "${id}" not found`);
  for (const id of out.downgrade_plans ?? []) if (!catalog.plans.has(id)) fail(`plan "${id}" not found`);
  return {
    kinds: [...new Set(out.kinds)],
    max_discount_percent: out.max_discount_percent,
    max_discount_cycles: out.max_discount_cycles,
    max_pause_months: out.max_pause_months,
    max_incentive_months: out.max_incentive_months,
    incentives: [...new Set(out.incentives ?? [])],
    downgrade_plans: [...new Set(out.downgrade_plans ?? [])],
    instructions: str(out.instructions, 2000),
  };
}

// Checks and normalizes a flow's steps. Every `next` must point at a step, and
// the flow must end in exactly one confirm step.
export function validateSteps(input: unknown, catalog: Catalog): Step[] {
  if (!Array.isArray(input) || !input.length) throw new ApiError(400, "steps must be a non-empty list");
  if (input.length > 20) throw new ApiError(400, "A flow can have at most 20 steps");

  const steps: Step[] = input.map((raw, i): Step => {
    const where = `steps[${i}]`;
    if (!isObject(raw)) throw new ApiError(400, `${where} must be an object`);
    const id = raw.id ?? `step_${i + 1}`;
    if (typeof id !== "string" || !ID.test(id)) throw new ApiError(400, `${where}.id must be lowercase letters, digits, - or _`);
    const next = raw.next ?? null;
    const title = str(raw.title, 200);
    const description = optStr(raw.description, 1000);
    switch (raw.type) {
      case "question": {
        if (!title) throw new ApiError(400, `${where}.title is required`);
        if (!Array.isArray(raw.answers) || raw.answers.length < 2 || raw.answers.length > 12) {
          throw new ApiError(400, `${where}.answers must have 2 to 12 answers`);
        }
        const answers = raw.answers.map((a: unknown, j: number): Answer => {
          if (!isObject(a)) throw new ApiError(400, `${where}.answers[${j}] must be an object`);
          if (typeof a.id !== "string" || !ID.test(a.id)) throw new ApiError(400, `${where}.answers[${j}].id is invalid`);
          const label = str(a.label, 200);
          if (!label) throw new ApiError(400, `${where}.answers[${j}].label is required`);
          return { id: a.id, label, next: a.next ?? null, ...(a.text ? { text: true } : {}) };
        });
        if (new Set(answers.map((a: Answer) => a.id)).size !== answers.length) {
          throw new ApiError(400, `${where}.answers ids must be unique`);
        }
        return { id, type: "question", title, description, answers, next };
      }
      case "text":
        if (!title) throw new ApiError(400, `${where}.title is required`);
        return { id, type: "text", title, description, placeholder: optStr(raw.placeholder, 200), required: !!raw.required, next };
      case "offer": {
        const byAnswer: Record<string, OfferSpec | null> = {};
        for (const [answer, spec] of Object.entries(isObject(raw.by_answer) ? raw.by_answer : {})) {
          byAnswer[answer] = offerSpec(spec, `${where}.by_answer.${answer}`, catalog);
        }
        return {
          id,
          type: "offer",
          title: optStr(raw.title, 200),
          dynamic: !!raw.dynamic,
          guardrails: guardrails(raw.guardrails, where, catalog),
          default: offerSpec(raw.default, `${where}.default`, catalog),
          by_answer: byAnswer,
          decline_label: optStr(raw.decline_label, 80),
          next,
        };
      }
      case "confirm":
        if (!title) throw new ApiError(400, `${where}.title is required`);
        return { id, type: "confirm", title, description, cta: optStr(raw.cta, 60) };
      default:
        throw new ApiError(400, `${where}.type must be question, text, offer or confirm`);
    }
  });

  const ids = new Set(steps.map((s) => s.id));
  if (ids.size !== steps.length) throw new ApiError(400, "Step ids must be unique");
  if (steps.filter((s) => s.type === "confirm").length !== 1) throw new ApiError(400, "A flow needs exactly one confirm step");
  if (steps.filter((s) => s.type === "offer").length > 1) throw new ApiError(400, "A flow can have at most one offer step");
  const checkNext = (next: string | null | undefined, where: string) => {
    if (next && !ids.has(next)) throw new ApiError(400, `${where} points at unknown step "${next}"`);
  };
  steps.forEach((s, i) => {
    if (s.type !== "confirm") checkNext(s.next, `steps[${i}].next`);
    if (s.type === "question") s.answers.forEach((a, j) => checkNext(a.next, `steps[${i}].answers[${j}].next`));
  });
  return steps;
}

// ─── Walking a flow ────────────────────────────────────

export function findStep(flow: Json, id: string | null): Step | null {
  return (flow.steps as Step[]).find((s) => s.id === id) ?? null;
}

// Where a step leads: the chosen answer's `next`, then the step's, then the
// step after it. The confirm step is always the end.
export function nextStepId(flow: Json, step: Step, answerId?: string | null): string | null {
  if (step.type === "confirm") return null;
  const answer = step.type === "question" ? step.answers.find((a) => a.id === answerId) : null;
  const explicit = answer?.next ?? step.next;
  if (explicit) return explicit;
  const steps = flow.steps as Step[];
  return steps[steps.findIndex((s) => s.id === step.id) + 1]?.id ?? steps.find((s) => s.type === "confirm")!.id;
}

// The flow as the SDK sees it: no offer configuration or guardrails.
export function publicStep(step: Step) {
  switch (step.type) {
    case "question":
      return {
        id: step.id,
        type: step.type,
        title: step.title,
        description: step.description ?? null,
        answers: step.answers.map((a) => ({ id: a.id, label: a.label, text: !!a.text })),
      };
    case "text":
      return {
        id: step.id,
        type: step.type,
        title: step.title,
        description: step.description ?? null,
        placeholder: step.placeholder ?? null,
        required: !!step.required,
      };
    case "offer":
      return { id: step.id, type: step.type, title: step.title ?? null, decline_label: step.decline_label ?? null };
    case "confirm":
      return { id: step.id, type: step.type, title: step.title, description: step.description ?? null, cta: step.cta ?? null };
  }
}

// ─── The account, as offers see it ────────────────────

export type AccountSnapshot = {
  id: string;
  name: string | null;
  plan: string;
  plan_name: string;
  created_at: string | null;
  subscription: {
    provider: string | null;
    status: string;
    interval: string;
    price: number;
    currency: string;
    renews_at: string | null;
    payments: number;
    offer_name: string | null;
  } | null;
  /** Monthly revenue at stake. */
  monthly_value: number;
  /** Whether PayPal-backed offers (discount, pause, downgrade) can apply. */
  billing_offers: boolean;
};

export async function accountSnapshot(appId: string, account: Json): Promise<AccountSnapshot> {
  const plan = await getDoc("plans", appId, account.plan);
  const sub = account.subscription;
  const price = sub ? (sub.renews_at_price ?? sub.price ?? 0) : 0;
  const billing = !!sub && sub.provider === "paypal" && sub.status === "active" && sub.interval !== "once";
  return {
    id: account.id,
    name: account.name ?? null,
    plan: account.plan,
    plan_name: plan?.name ?? account.plan,
    created_at: account.created_at ?? null,
    subscription: sub
      ? {
          provider: sub.provider ?? null,
          status: sub.status,
          interval: sub.interval,
          price,
          currency: sub.currency ?? "USD",
          renews_at: sub.renews_at ?? null,
          payments: sub.payments ?? 0,
          offer_name: sub.offer_name ?? null,
        }
      : null,
    monthly_value: sub && sub.status === "active" && sub.interval !== "once" ? Math.round(monthly(price, sub.interval) * 100) / 100 : 0,
    billing_offers: billing,
  };
}

// ─── Offers ────────────────────────────────────────────

export type PresentedOffer = {
  kind: OfferKind;
  source: "static" | "dynamic";
  details: Json;
  headline: string;
  body: string;
  cta: string;
  /** Why the model picked it (dynamic offers; dashboard only). */
  reasoning?: string | null;
  status: "shown" | "accepted" | "declined";
  result?: Json;
};

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export type OfferContext = {
  account: AccountSnapshot;
  plans: Json[];
  incentives: Json[];
};

// Cheaper plans the account could move to, priced for its billing interval.
export function downgradeOptions(ctx: OfferContext, allowed: string[] = []) {
  const sub = ctx.account.subscription;
  if (!sub || !ctx.account.billing_offers) return [];
  const interval = sub.interval === "year" ? "year" : "month";
  return ctx.plans
    .filter((p) => p.id !== ctx.account.plan && !p.isFree && (!allowed.length || allowed.includes(p.id)))
    .map((p) => ({ id: p.id as string, name: (p.name ?? p.id) as string, price: listPrice(p, interval) }))
    .filter((p): p is { id: string; name: string; price: number } => p.price !== null && p.price < sub.price)
    .sort((a, b) => b.price - a.price);
}

// Fills in the numbers and default copy for an offer spec, or returns null when
// it can't apply to this account (no PayPal subscription, plan not cheaper…).
export function presentOffer(spec: OfferSpec, ctx: OfferContext, source: PresentedOffer["source"]): PresentedOffer | null {
  const { account } = ctx;
  const sub = account.subscription;
  const per = sub?.interval === "year" ? "year" : "month";
  const currency = sub?.currency ?? "USD";
  let details: Json;
  let copy: Required<Copy>;

  switch (spec.kind) {
    case "discount": {
      if (!account.billing_offers || !sub) return null;
      const price = Math.round(sub.price * (1 - spec.percent / 100) * 100) / 100;
      details = { percent: spec.percent, cycles: spec.cycles, price, regular_price: sub.price, currency, interval: per };
      copy = {
        headline: `Stay for ${spec.percent}% less`,
        body: `Keep ${account.plan_name} for ${money(price, currency)}/${per} instead of ${money(sub.price, currency)} for your next ${plural(spec.cycles, per === "year" ? "year" : "month")}. Then it's ${money(sub.price, currency)}/${per} again.`,
        cta: `Stay for ${money(price, currency)}/${per}`,
      };
      break;
    }
    case "pause": {
      if (!account.billing_offers) return null;
      const resumeAt = addDuration(new Date(), `P${spec.months}M`).toISOString();
      details = { months: spec.months, resume_at: resumeAt };
      copy = {
        headline: `Pause for ${plural(spec.months, "month")} instead`,
        body: `We'll stop billing you and keep your account and data. Your ${account.plan_name} plan comes back on ${new Date(resumeAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, or you can resume earlier.`,
        cta: `Pause for ${plural(spec.months, "month")}`,
      };
      break;
    }
    case "downgrade": {
      const option = downgradeOptions(ctx).find((p) => p.id === spec.plan);
      if (!option || !sub) return null;
      details = { plan: option.id, plan_name: option.name, price: option.price, regular_price: sub.price, currency, interval: per };
      copy = {
        headline: `Switch to ${option.name} for ${money(option.price, currency)}/${per}`,
        body: `Keep your account on a smaller plan instead of losing it. You can upgrade again whenever you need more.`,
        cta: `Switch to ${option.name}`,
      };
      break;
    }
    case "incentive": {
      const incentive = ctx.incentives.find((i) => i.id === spec.incentive);
      if (!incentive) return null;
      details = {
        incentive: incentive.id,
        incentive_name: incentive.name ?? incentive.id,
        description: incentive.description ?? null,
        months: spec.months,
        ends_at: addDuration(new Date(), `P${spec.months}M`).toISOString(),
      };
      copy = {
        headline: `Get ${incentive.name ?? "a bonus"} on us`,
        body: `${incentive.description ? `${incentive.description}. ` : ""}Free for ${plural(spec.months, "month")}, no change to what you pay.`,
        cta: "Claim it and stay",
      };
      break;
    }
  }
  return {
    kind: spec.kind,
    source,
    details,
    headline: spec.copy?.headline || copy.headline,
    body: spec.copy?.body || copy.body,
    cta: spec.copy?.cta || copy.cta,
    status: "shown",
  };
}

// The static offer for a session: the first answer (in step order) that has
// one in `by_answer`, else the step's default.
export function staticSpec(step: Extract<Step, { type: "offer" }>, answerIds: string[]): OfferSpec | null {
  for (const id of answerIds) if (id in step.by_answer) return step.by_answer[id];
  return step.default;
}

// The offer without dashboard-only fields.
export function publicOffer(offer: PresentedOffer | null) {
  if (!offer) return null;
  const { reasoning: _, ...rest } = offer;
  return rest;
}
