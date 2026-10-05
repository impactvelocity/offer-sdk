import sql from "../db/client.ts";
import { getDoc, listDocs } from "../db/docs.ts";
import { ApiError, type Json } from "./http.ts";
import { slugify } from "./slugify.ts";

// Offers are deals on an app's core plans. Each plan entry inherits the plan's
// entitlements and list price (from its pricingCard); the offer can lower the
// price, add entitlements ("extras") and attach one-time bumps. Buying sets the
// account's plan and records the deal on the account (see grants.ts).

export type Interval = "month" | "year" | "once";
export const INTERVALS: Interval[] = ["month", "year", "once"];

// The offer used when none is given or the requested one is unavailable:
// every priced plan at list price.
export const DEFAULT_OFFER_ID = "default";

export type Catalog = { plans: Map<string, Json>; entitlements: Map<string, Json>; addons: Map<string, Json> };

export async function loadCatalog(appId: string): Promise<Catalog> {
  const [plans, entitlements, addons] = await Promise.all([
    listDocs("plans", appId),
    listDocs("entitlements", appId),
    listDocs("addons", appId),
  ]);
  const byId = (docs: Json[]) => new Map(docs.map((d) => [d.id as string, d]));
  return { plans: byId(plans), entitlements: byId(entitlements), addons: byId(addons) };
}

// ─── Durations ─────────────────────────────────────────

const DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;

export const isDuration = (value: unknown): value is string =>
  typeof value === "string" && value !== "P" && DURATION.test(value);

// Adds an ISO 8601 duration like "P6M" or "P1Y2M" to a date.
export function addDuration(from: Date, duration: string): Date {
  const [, y, m, w, d] = duration.match(DURATION) ?? [];
  const out = new Date(from);
  out.setUTCFullYear(out.getUTCFullYear() + Number(y ?? 0));
  out.setUTCMonth(out.getUTCMonth() + Number(m ?? 0));
  out.setUTCDate(out.getUTCDate() + Number(w ?? 0) * 7 + Number(d ?? 0));
  return out;
}

// ─── Prices ────────────────────────────────────────────

const roundMoney = (n: number) => Math.round(n * 100) / 100;
const price = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

// A plan's regular price for an interval, from its pricing card.
export function listPrice(plan: Json, interval: Interval): number | null {
  const card = plan.pricingCard;
  if (!card) return null;
  if (card.type === "one_time") return interval === "once" ? price(card.price) : null;
  if (interval === "month") return price(card.monthlyPrice);
  if (interval === "year") return price(card.yearlyPrice);
  return null;
}

export type EntryPrice = { amount: number; list_price: number | null; cycles: number | null };

// What one plan entry costs for an interval in this offer, or null when the
// offer doesn't sell it for that interval. `cycles` is how many billing
// periods the sale price lasts before the list price; null means it never changes.
export function entryPrice(offer: Json, entry: Json, plan: Json, interval: Interval): EntryPrice | null {
  if (!offerIntervals(offer).includes(interval)) return null;
  const list = listPrice(plan, interval);
  const explicit = entry.prices?.[interval];

  let amount: number;
  let cycles: number | null = null;
  if (explicit) {
    amount = explicit.amount;
    cycles = explicit.cycles ?? null;
  } else if (list === null) {
    return null;
  } else if (offer.discount) {
    const { percent, amount_off } = offer.discount;
    amount = percent !== undefined ? list * (1 - percent / 100) : Math.max(0, list - amount_off);
    cycles = offer.discount.cycles ?? null;
  } else {
    amount = list;
  }

  amount = roundMoney(amount);
  // Intro cycles only mean something for a recurring price that later goes up.
  if (interval === "once" || list === null || amount >= list) cycles = null;
  return { amount, list_price: list, cycles };
}

export const offerIntervals = (offer: Json): Interval[] => offer.intervals ?? INTERVALS;

const bumpApplies = (bump: Json, planId: string, interval: Interval) =>
  (!bump.applies_to?.plans || bump.applies_to.plans.includes(planId)) &&
  (!bump.applies_to?.intervals || bump.applies_to.intervals.includes(interval));

export type Quote = {
  offer_id: string | null;
  offer_name: string | null;
  plan_id: string;
  plan_name: string;
  interval: Interval;
  currency: string;
  price: number;
  list_price: number | null;
  cycles: number | null;
  bumps: { id: string; label: string; amount: number; grant: Json }[];
  setup_fee: number;
  total_today: number;
  renews_at_price: number | null;
  extras: { entitlements: Json[]; addons: string[]; ends: string };
};

// Prices a selection from the stored offer. Never trusts amounts from the client.
export function quote(
  offer: Json,
  catalog: Catalog,
  selection: { plan: unknown; interval: unknown; bumps?: unknown },
): Quote {
  const { plan: planId, interval } = selection;
  if (typeof planId !== "string") throw new ApiError(400, "plan is required");
  if (!INTERVALS.includes(interval as Interval)) throw new ApiError(400, "interval must be month, year or once");

  const entry = (offer.plans as Json[]).find((p) => p.plan_id === planId);
  const plan = catalog.plans.get(planId);
  if (!entry || !plan) throw new ApiError(400, `Plan "${planId}" is not in this offer`);

  const p = entryPrice(offer, entry, plan, interval as Interval);
  if (!p) throw new ApiError(400, `Plan "${planId}" has no ${interval} price in this offer`);

  const bumpIds = selection.bumps ?? [];
  if (!Array.isArray(bumpIds) || bumpIds.some((b) => typeof b !== "string")) {
    throw new ApiError(400, "bumps must be an array of bump ids");
  }
  const bumps = [...new Set(bumpIds as string[])].map((id) => {
    const bump = (offer.bumps as Json[] | undefined)?.find((b) => b.id === id);
    if (!bump) throw new ApiError(400, `Bump "${id}" is not in this offer`);
    if (!bumpApplies(bump, planId, interval as Interval)) {
      throw new ApiError(400, `Bump "${id}" isn't available with ${planId} (${interval})`);
    }
    return { id: bump.id, label: bump.label, amount: bump.price.amount, grant: bump.grant };
  });

  const setupFee = roundMoney(bumps.reduce((sum, b) => sum + b.amount, 0));
  return {
    offer_id: offer.id === DEFAULT_OFFER_ID ? null : offer.id,
    offer_name: offer.id === DEFAULT_OFFER_ID ? null : (offer.name ?? offer.id),
    plan_id: planId,
    plan_name: plan.pricingCard?.title ?? plan.name ?? planId,
    interval: interval as Interval,
    currency: offer.currency,
    price: p.amount,
    list_price: p.list_price,
    cycles: p.cycles,
    bumps,
    setup_fee: setupFee,
    total_today: roundMoney(p.amount + setupFee),
    renews_at_price: interval === "once" ? null : p.cycles ? p.list_price : p.amount,
    extras: {
      entitlements: entry.entitlements ?? [],
      addons: [...new Set([...(offer.grant?.addons ?? []), ...(entry.addons ?? [])])] as string[],
      ends: entry.extras_for ?? "subscription",
    },
  };
}

// ─── Default offer ─────────────────────────────────────

export function defaultOffer(appId: string, catalog: Catalog): Json {
  const priced = [...catalog.plans.values()].filter(
    (plan) => !plan.isFree && INTERVALS.some((i) => listPrice(plan, i) !== null),
  );
  return {
    id: DEFAULT_OFFER_ID,
    app_id: appId,
    name: "Regular pricing",
    type: "shareable",
    status: "active",
    currency: priced[0]?.pricingCard?.currency ?? "USD",
    copy: {},
    intervals: INTERVALS.filter((i) => priced.some((plan) => listPrice(plan, i) !== null)),
    plans: priced.map((plan) => ({ plan_id: plan.id })),
    default_plan: priced.find((plan) => plan.pricingCard?.featured)?.id ?? priced[0]?.id ?? null,
    bumps: [],
  };
}

// ─── Availability and resolution ───────────────────────

export type Unavailable = "not_found" | "draft" | "archived" | "expired" | "sold_out" | "not_eligible";

export async function redemptions(appId: string, offerId: string): Promise<number> {
  const [{ count }] = await sql`
    select count(*)::int as count from checkouts
    where app_id = ${appId} and offer_id = ${offerId} and status = 'completed'`;
  return count;
}

// Why an offer can't be bought right now, or null when it can.
export async function unavailableReason(appId: string, offer: Json, accountId?: string | null): Promise<Unavailable | null> {
  if (offer.status === "draft") return "draft";
  if (offer.status === "archived") return "archived";
  if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) return "expired";
  if (offer.type === "targeted" && offer.account_id !== accountId) return "not_eligible";
  if (offer.max_redemptions && (await redemptions(appId, offer.id)) >= offer.max_redemptions) return "sold_out";
  return null;
}

export type Resolution = {
  offer: Json;
  resolved_from: "requested" | "fallback" | "default";
  requested: { id: string; reason: Unavailable } | null;
};

// The requested offer if it can be bought, else the fallback, else the app's
// regular prices. `requested` explains why the first choice was skipped.
export async function resolveOffer(
  appId: string,
  catalog: Catalog,
  id: string | null,
  opts: { fallback?: string | null; account?: string | null } = {},
): Promise<Resolution> {
  let requested: Resolution["requested"] = null;

  const tryOffer = async (offerId: string) => {
    if (offerId === DEFAULT_OFFER_ID) return defaultOffer(appId, catalog);
    const offer = await getDoc("offers", appId, offerId);
    const reason = offer ? await unavailableReason(appId, offer, opts.account) : "not_found";
    if (reason) {
      requested ??= { id: offerId, reason };
      return null;
    }
    return offer;
  };

  if (id) {
    const offer = await tryOffer(id);
    if (offer) return { offer, resolved_from: id === DEFAULT_OFFER_ID ? "default" : "requested", requested };
  }
  if (opts.fallback && opts.fallback !== id) {
    const offer = await tryOffer(opts.fallback);
    if (offer) return { offer, resolved_from: "fallback", requested };
  }
  return { offer: defaultOffer(appId, catalog), resolved_from: "default", requested };
}

// ─── Public view ───────────────────────────────────────

// What the SDK renders. Leaves out internal fields (PayPal ids, account id, source).
export function publicOffer(offer: Json, catalog: Catalog, resolution?: Omit<Resolution, "offer">) {
  const plans = (offer.plans as Json[])
    .map((entry) => {
      const plan = catalog.plans.get(entry.plan_id);
      if (!plan) return null;
      const card = plan.pricingCard ?? {};
      const prices: Partial<Record<Interval, Json>> = {};
      for (const interval of offerIntervals(offer)) {
        const p = entryPrice(offer, entry, plan, interval);
        if (p) prices[interval] = { ...p, then: p.cycles ? p.list_price : null };
      }
      return {
        id: plan.id as string,
        name: card.title ?? plan.name ?? plan.id,
        description: card.description ?? plan.description ?? null,
        featured: !!card.featured,
        benefits: card.benefits ?? [],
        prices,
        extras: (entry.entitlements ?? []).map((e: Json) => ({
          id: e.id,
          name: catalog.entitlements.get(e.id)?.name ?? e.id,
          max: e.max ?? null,
        })),
        extra_addons: (entry.addons ?? []).map((id: string) => ({ id, name: catalog.addons.get(id)?.name ?? id })),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && Object.keys(p.prices).length > 0);

  const intervals = offerIntervals(offer).filter((i) => plans.some((p) => p.prices[i]));

  return {
    id: offer.id,
    name: offer.name ?? offer.id,
    type: offer.type,
    expires_at: offer.expires_at ?? null,
    currency: offer.currency,
    copy: offer.copy ?? {},
    intervals,
    default_plan: offer.default_plan ?? plans.find((p) => p.featured)?.id ?? plans[0]?.id ?? null,
    default_interval: intervals.includes("month") ? "month" : (intervals[0] ?? null),
    plans,
    bumps: (offer.bumps ?? []).map((b: Json) => ({
      id: b.id,
      label: b.label,
      description: b.description ?? null,
      amount: b.price.amount,
      applies_to: b.applies_to ?? null,
      addons: (b.grant?.addons ?? []).map((id: string) => ({ id, name: catalog.addons.get(id)?.name ?? id })),
    })),
    ...(resolution ? { resolved_from: resolution.resolved_from, requested: resolution.requested } : {}),
  };
}

// ─── Validation ────────────────────────────────────────

const fail = (message: string): never => {
  throw new ApiError(400, message);
};

const isObject = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const positiveInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
const nonNegative = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) fail(`${field} must be an array of strings`);
  return [...new Set(value as string[])];
}

function addonList(value: unknown, field: string, catalog: Catalog): string[] {
  const ids = stringList(value, field);
  for (const id of ids) if (!catalog.addons.has(id)) fail(`Addon "${id}" not found`);
  return ids;
}

function entitlementRefs(value: unknown, field: string, catalog: Catalog): Json[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return (value as unknown[]).map((ref) => {
    if (!isObject(ref) || typeof ref.id !== "string") fail(`${field} items need an id`);
    const r = ref as Json;
    const entitlement = catalog.entitlements.get(r.id);
    if (!entitlement) fail(`Entitlement "${r.id}" not found`);
    if (entitlement!.type !== "usage") return { id: r.id };
    if (r.max !== undefined && r.max !== null && !nonNegative(r.max)) fail(`${field}: max for "${r.id}" must be a number`);
    return { id: r.id, max: r.max ?? null };
  });
}

function intervalPrice(value: unknown, field: string): Json {
  if (!isObject(value) || !nonNegative(value.amount)) fail(`${field}.amount must be a number`);
  const v = value as Json;
  if (v.cycles !== undefined && v.cycles !== null && !positiveInt(v.cycles)) fail(`${field}.cycles must be a positive integer`);
  return { amount: roundMoney(v.amount), ...(v.cycles ? { cycles: v.cycles } : {}) };
}

const COPY_FIELDS = ["headline", "subhead", "cta"] as const;

function copyBlock(value: unknown): Json {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) fail("copy must be an object");
  const v = value as Json;
  const out: Json = {};
  for (const key of COPY_FIELDS) {
    if (v[key] === undefined) continue;
    if (typeof v[key] !== "string") fail(`copy.${key} must be a string`);
    out[key] = v[key];
  }
  if (v.bullets !== undefined) out.bullets = stringList(v.bullets, "copy.bullets");
  return out;
}

// Checks and normalises the editable fields of an offer. Every plan, entitlement
// and addon id must already be in the catalog: offers only unlock things the
// app already checks.
export async function validateOffer(input: Json, catalog: Catalog): Promise<Json> {
  const out: Json = {};

  out.name = input.name === undefined ? undefined : String(input.name);
  out.copy = copyBlock(input.copy);

  if (input.discount !== undefined && input.discount !== null) {
    if (!isObject(input.discount)) fail("discount must be an object");
    const { percent, amount_off, cycles } = input.discount;
    if ((percent === undefined) === (amount_off === undefined)) fail("discount needs either percent or amount_off");
    if (percent !== undefined && !(typeof percent === "number" && percent > 0 && percent <= 100)) {
      fail("discount.percent must be between 0 and 100");
    }
    if (amount_off !== undefined && !(nonNegative(amount_off) && amount_off > 0)) fail("discount.amount_off must be positive");
    if (cycles !== undefined && cycles !== null && !positiveInt(cycles)) fail("discount.cycles must be a positive integer");
    out.discount = { ...(percent !== undefined ? { percent } : { amount_off }), ...(cycles ? { cycles } : {}) };
  } else {
    out.discount = null;
  }

  if (input.intervals !== undefined) {
    const intervals = stringList(input.intervals, "intervals");
    if (!intervals.length || intervals.some((i) => !INTERVALS.includes(i as Interval))) {
      fail("intervals must list month, year and/or once");
    }
    out.intervals = INTERVALS.filter((i) => intervals.includes(i));
  } else {
    out.intervals = INTERVALS;
  }

  if (!Array.isArray(input.plans) || !input.plans.length) fail("plans must list at least one plan");
  const seen = new Set<string>();
  out.plans = (input.plans as unknown[]).map((raw, i) => {
    const entry = typeof raw === "string" ? { plan_id: raw } : raw;
    if (!isObject(entry) || typeof entry.plan_id !== "string") fail(`plans[${i}].plan_id is required`);
    const e = entry as Json;
    if (!catalog.plans.has(e.plan_id)) fail(`Plan "${e.plan_id}" not found`);
    if (seen.has(e.plan_id)) fail(`Plan "${e.plan_id}" is listed twice`);
    seen.add(e.plan_id);

    const prices: Json = {};
    if (e.prices !== undefined) {
      if (!isObject(e.prices)) fail(`plans[${i}].prices must be an object`);
      for (const [interval, value] of Object.entries(e.prices as Json)) {
        if (!INTERVALS.includes(interval as Interval)) fail(`plans[${i}].prices: unknown interval "${interval}"`);
        prices[interval] = intervalPrice(value, `plans[${i}].prices.${interval}`);
      }
    }

    const extrasFor = e.extras_for ?? "subscription";
    if (extrasFor !== "subscription" && extrasFor !== "discount" && !isDuration(extrasFor)) {
      fail(`plans[${i}].extras_for must be "subscription", "discount" or a duration like "P6M"`);
    }

    return {
      plan_id: e.plan_id,
      ...(Object.keys(prices).length ? { prices } : {}),
      entitlements: entitlementRefs(e.entitlements, `plans[${i}].entitlements`, catalog),
      addons: addonList(e.addons, `plans[${i}].addons`, catalog),
      extras_for: extrasFor,
    };
  });

  out.currency = typeof input.currency === "string" ? input.currency.toUpperCase() : undefined;
  if (out.currency !== undefined && !/^[A-Z]{3}$/.test(out.currency)) fail("currency must be an ISO 4217 code");
  out.currency ??= catalog.plans.get(out.plans[0].plan_id)?.pricingCard?.currency ?? "USD";

  // Every plan entry has to be sellable for at least one interval.
  for (const entry of out.plans) {
    const plan = catalog.plans.get(entry.plan_id)!;
    if (!out.intervals.some((i: Interval) => entryPrice(out, entry, plan, i))) {
      fail(`Plan "${entry.plan_id}" has no price for this offer's intervals. Give it a pricing card or set a price in the offer.`);
    }
  }

  if (input.default_plan !== undefined && input.default_plan !== null) {
    if (!seen.has(input.default_plan)) fail("default_plan must be one of the offer's plans");
    out.default_plan = input.default_plan;
  } else {
    out.default_plan = null;
  }

  if (input.bumps !== undefined && !Array.isArray(input.bumps)) fail("bumps must be an array");
  const bumpIds = new Set<string>();
  out.bumps = ((input.bumps ?? []) as unknown[]).map((raw, i) => {
    if (!isObject(raw)) fail(`bumps[${i}] must be an object`);
    const b = raw as Json;
    const id = slugify(String(b.id ?? b.label ?? ""));
    if (!id) fail(`bumps[${i}].id is required`);
    if (bumpIds.has(id)) fail(`Bump "${id}" is listed twice`);
    bumpIds.add(id);
    if (typeof b.label !== "string" || !b.label) fail(`bumps[${i}].label is required`);
    if (!isObject(b.price) || !nonNegative(b.price.amount) || b.price.amount <= 0) fail(`bumps[${i}].price.amount must be positive`);

    const grant = isObject(b.grant) ? b.grant : fail(`bumps[${i}].grant is required`);
    const addons = addonList(grant.addons, `bumps[${i}].grant.addons`, catalog);
    let credits: Json | undefined;
    if (grant.credits !== undefined) {
      const c = grant.credits;
      if (!isObject(c) || typeof c.entitlement !== "string" || !positiveInt(c.amount)) {
        fail(`bumps[${i}].grant.credits needs an entitlement and a positive integer amount`);
      }
      const entitlement = catalog.entitlements.get(c.entitlement);
      if (!entitlement) fail(`Entitlement "${c.entitlement}" not found`);
      if (entitlement!.type !== "usage") fail(`Credits need a usage entitlement; "${c.entitlement}" is not one`);
      credits = { entitlement: c.entitlement, amount: c.amount };
    }
    if (!addons.length && !credits) fail(`bumps[${i}].grant must give addons or credits`);

    let appliesTo: Json | null = null;
    if (b.applies_to !== undefined && b.applies_to !== null) {
      if (!isObject(b.applies_to)) fail(`bumps[${i}].applies_to must be an object`);
      appliesTo = {};
      if (b.applies_to.plans !== undefined) {
        appliesTo.plans = stringList(b.applies_to.plans, `bumps[${i}].applies_to.plans`);
        for (const p of appliesTo.plans) if (!seen.has(p)) fail(`bumps[${i}].applies_to: "${p}" is not in this offer`);
      }
      if (b.applies_to.intervals !== undefined) {
        appliesTo.intervals = stringList(b.applies_to.intervals, `bumps[${i}].applies_to.intervals`);
        for (const v of appliesTo.intervals) if (!INTERVALS.includes(v as Interval)) fail(`bumps[${i}].applies_to: unknown interval "${v}"`);
      }
    }

    return {
      id,
      label: b.label,
      ...(typeof b.description === "string" ? { description: b.description } : {}),
      price: { amount: roundMoney(b.price.amount) },
      grant: { ...(addons.length ? { addons } : {}), ...(credits ? { credits } : {}) },
      ...(appliesTo ? { applies_to: appliesTo } : {}),
    };
  });

  out.grant = input.grant ? { addons: addonList((input.grant as Json).addons, "grant.addons", catalog) } : { addons: [] };

  if (input.expires_at !== undefined && input.expires_at !== null) {
    if (typeof input.expires_at !== "string" || Number.isNaN(Date.parse(input.expires_at))) {
      fail("expires_at must be an ISO 8601 date");
    }
    out.expires_at = new Date(input.expires_at).toISOString();
  } else {
    out.expires_at = null;
  }

  if (input.max_redemptions !== undefined && input.max_redemptions !== null && !positiveInt(input.max_redemptions)) {
    fail("max_redemptions must be a positive integer");
  }
  out.max_redemptions = input.max_redemptions ?? null;

  return out;
}
