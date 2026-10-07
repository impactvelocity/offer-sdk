import Anthropic from "@anthropic-ai/sdk";
import {
  downgradeOptions,
  type Guardrails,
  type OfferContext,
  type OfferKind,
  type OfferSpec,
  presentOffer,
  type PresentedOffer,
} from "./cancel-flows.ts";

// Dynamic save offers: Claude reads why this customer is leaving and what
// their account looks like, then picks one offer within the flow's guardrails
// and writes its copy. The guardrails are enforced here, not trusted to the
// model: kinds, caps, plans and incentives are all re-checked, and anything
// out of bounds is clamped or dropped. Without ANTHROPIC_API_KEY, or when the
// call fails, the flow falls back to its static offer.

const MODEL = process.env.DECIDE_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.DECIDE_TIMEOUT_MS ?? 20_000);

let client: Anthropic | null = null;
export const decideEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export type DecideInput = {
  appName: string;
  guardrails: Guardrails;
  context: OfferContext;
  /** Usage of each entitlement against its limit. */
  usage: { name: string; usage: number; max: number | null }[];
  answers: { question: string; answer: string | null; text: string | null }[];
};

export type Decision = { offer: PresentedOffer | null; skipped?: string };

const SYSTEM = `You choose one retention offer for a customer who is about to cancel a SaaS subscription, and write its copy.

Pick the offer that answers their actual reason for leaving:
- Price is the problem: a discount, or a cheaper plan if they use little of what they pay for.
- Not using it right now, seasonal or project-based work: a pause.
- Missing a feature or not getting enough value: an incentive (extra features or limits) if one fits; otherwise a discount.
- Switching to a competitor, or a reason no offer can fix (closing the business, bad experience): kind "none". Respect the decision.

Prefer the smallest offer likely to keep them; don't open with the maximum discount. Long-standing customers with real usage are worth more.

Copy: write to the customer in second person, plainly and warmly, with no pressure, guilt or fake urgency. Mention their reason only if it reads naturally. Headline under 60 characters, body one or two sentences, cta a short button label that names the offer. Never promise anything the offer doesn't give. Don't state prices; the app shows them.

Only use the offer kinds, plans and incentives listed as available. Fields that don't apply to the chosen kind are 0 or "".`;

function schema(kinds: OfferKind[], plans: string[], incentives: string[]) {
  const ids = (list: string[]) => (list.length ? { type: "string", enum: [...list, ""] } : { type: "string", enum: [""] });
  return {
    type: "object",
    properties: {
      reasoning: { type: "string", description: "One or two sentences on why this offer, for the app's team." },
      kind: { type: "string", enum: [...kinds, "none"] },
      percent: { type: "integer", description: "discount: percent off" },
      cycles: { type: "integer", description: "discount: number of billing periods" },
      months: { type: "integer", description: "pause or incentive: number of months" },
      plan: { ...ids(plans), description: "downgrade: plan id" },
      incentive: { ...ids(incentives), description: "incentive: incentive id" },
      headline: { type: "string" },
      body: { type: "string" },
      cta: { type: "string" },
    },
    required: ["reasoning", "kind", "percent", "cycles", "months", "plan", "incentive", "headline", "body", "cta"],
    additionalProperties: false,
  };
}

const clamp = (n: unknown, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(typeof n === "number" && Number.isFinite(n) ? n : min)));

export async function decideOffer(input: DecideInput): Promise<Decision> {
  if (!decideEnabled()) return { offer: null, skipped: "ANTHROPIC_API_KEY is not set" };
  const { guardrails: g, context } = input;
  const { account } = context;

  // What can actually apply to this account.
  const plans = g.kinds.includes("downgrade") ? downgradeOptions(context, g.downgrade_plans) : [];
  const incentives = g.kinds.includes("incentive") ? context.incentives.filter((i) => g.incentives.includes(i.id)) : [];
  const kinds = g.kinds.filter((k) => {
    if (k === "discount" || k === "pause") return account.billing_offers;
    if (k === "downgrade") return plans.length > 0;
    return incentives.length > 0;
  });
  if (!kinds.length) return { offer: null, skipped: "No offer kind applies to this account" };

  const sub = account.subscription;
  const tenureMonths = account.created_at
    ? Math.max(0, Math.round((Date.now() - new Date(account.created_at).getTime()) / (30.4 * 24 * 3600 * 1000)))
    : null;
  const prompt = {
    app: input.appName,
    customer: {
      plan: account.plan_name,
      price: sub ? `${sub.price} ${sub.currency} per ${sub.interval}` : "free",
      payments_made: sub?.payments ?? 0,
      customer_for_months: tenureMonths,
      bought_through_offer: sub?.offer_name ?? null,
      usage: input.usage.map((u) => ({ feature: u.name, used: u.usage, limit: u.max })),
    },
    why_they_are_leaving: input.answers,
    available: {
      kinds,
      ...(kinds.includes("discount") ? { discount: { max_percent: g.max_discount_percent, max_cycles: g.max_discount_cycles } } : {}),
      ...(kinds.includes("pause") ? { pause: { max_months: g.max_pause_months } } : {}),
      ...(kinds.includes("downgrade") ? { downgrade_plans: plans.map((p) => ({ id: p.id, name: p.name, price: p.price })) } : {}),
      ...(kinds.includes("incentive")
        ? {
            incentives: incentives.map((i) => ({ id: i.id, name: i.name, description: i.description ?? null })),
            incentive_max_months: g.max_incentive_months,
          }
        : {}),
    },
    ...(g.instructions ? { instructions_from_the_app_team: g.instructions } : {}),
  };

  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  let raw: string;
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: schema(kinds, plans.map((p) => p.id), incentives.map((i) => i.id)) },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(prompt, null, 2) }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return { offer: null, skipped: `Model stopped: ${response.stop_reason}` };
    }
    raw = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (err) {
    console.error("decide offer:", err);
    return { offer: null, skipped: err instanceof Anthropic.APIError ? `Claude API error ${err.status}` : "Claude API call failed" };
  }

  let out: Record<string, any>;
  try {
    out = JSON.parse(raw);
  } catch {
    return { offer: null, skipped: "Model returned invalid JSON" };
  }
  if (out.kind === "none") return { offer: null, skipped: out.reasoning || "Model chose no offer" };

  let spec: OfferSpec | null = null;
  const copy = { headline: String(out.headline ?? "").slice(0, 120), body: String(out.body ?? "").slice(0, 500), cta: String(out.cta ?? "").slice(0, 60) };
  if (out.kind === "discount" && kinds.includes("discount")) {
    spec = { kind: "discount", percent: clamp(out.percent, 5, g.max_discount_percent), cycles: clamp(out.cycles, 1, g.max_discount_cycles), copy };
  } else if (out.kind === "pause" && kinds.includes("pause")) {
    spec = { kind: "pause", months: clamp(out.months, 1, g.max_pause_months), copy };
  } else if (out.kind === "downgrade" && plans.some((p) => p.id === out.plan)) {
    spec = { kind: "downgrade", plan: out.plan, copy };
  } else if (out.kind === "incentive" && incentives.some((i) => i.id === out.incentive)) {
    spec = { kind: "incentive", incentive: out.incentive, months: clamp(out.months, 1, g.max_incentive_months), copy };
  }
  if (!spec) return { offer: null, skipped: `Model picked an unavailable offer (${out.kind})` };

  const offer = presentOffer(spec, context, "dynamic");
  return offer ? { offer: { ...offer, reasoning: String(out.reasoning ?? "").slice(0, 600) } } : { offer: null, skipped: "Offer does not apply" };
}
