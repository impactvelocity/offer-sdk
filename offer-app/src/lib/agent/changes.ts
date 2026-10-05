import type { Addon, Entitlement, EntitlementRef, Incentive, Plan, PricingCard } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { CatalogKind, CatalogRecord } from "./types";
import type {
  CreateAddonInput,
  CreateEntitlementInput,
  CreateIncentiveInput,
  CreatePlanInput,
  EntitlementLimitInput,
  PricingInput,
  UpdateAddonInput,
  UpdateEntitlementInput,
  UpdateIncentiveInput,
  UpdatePlanInput,
} from "./schemas";

// Pure helpers behind the agent's write tools: apply a tool's input to a record (the
// approval preview) and describe the difference between two versions (the change card).

export interface CatalogLookup {
  entitlements: Map<string, Pick<Entitlement, "id" | "name" | "type">>;
  addons: Map<string, Pick<Addon, "id" | "name">>;
}

export function catalogLookup(entitlements: Entitlement[] = [], addons: Addon[] = []): CatalogLookup {
  return {
    entitlements: new Map(entitlements.map((e) => [e.id, e])),
    addons: new Map(addons.map((a) => [a.id, a])),
  };
}

const defined = <T extends object>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/** The entry the API stores for an entitlement: usage entitlements carry a max (null = unlimited). */
export function entitlementRef(input: EntitlementLimitInput, lookup: CatalogLookup): EntitlementRef {
  return lookup.entitlements.get(input.id)?.type === "boolean" ? { id: input.id } : { id: input.id, max: input.max ?? null };
}

export function applyEntitlementChanges(
  current: EntitlementRef[],
  set: EntitlementLimitInput[] = [],
  remove: string[] = [],
  lookup: CatalogLookup,
): EntitlementRef[] {
  const removed = new Set(remove);
  const out = current.filter((e) => !removed.has(e.id));
  for (const input of set) {
    const entry = entitlementRef(input, lookup);
    const i = out.findIndex((e) => e.id === input.id);
    if (i >= 0) out[i] = entry;
    else out.push(entry);
  }
  return out;
}

export function applyAddonChanges(current: string[], add: string[] = [], remove: string[] = []): string[] {
  const removed = new Set(remove);
  return [...new Set([...current.filter((id) => !removed.has(id)), ...add])];
}

/** Merges pricing input into a card; `null` removes the card, `undefined` keeps it. */
export function applyPricing(card: PricingCard | null | undefined, input: PricingInput | null | undefined, planName: string) {
  if (input === null) return null;
  if (input === undefined) return card ?? null;
  const base: PricingCard = card ?? {
    title: planName,
    description: null,
    benefits: [],
    featured: false,
    type: "subscription",
    monthlyPrice: null,
    yearlyPrice: null,
    price: null,
    currency: "USD",
  };
  const { benefits, currency, ...rest } = input;
  const next: PricingCard = { ...base, ...defined(rest), ...(currency && { currency: currency.toUpperCase() }) };
  if (benefits) {
    const stamp = Date.now().toString(36);
    next.benefits = benefits
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title, i) => base.benefits.find((b) => b.title === title) ?? { id: `b${stamp}${i}`, title });
  }
  return next;
}

export function previewNewPlan(input: CreatePlanInput, appId: string, lookup: CatalogLookup): Plan {
  return {
    id: input.id,
    app_id: appId,
    name: input.name,
    description: input.description ?? null,
    note: null,
    isFree: input.isFree ?? false,
    pricingCard: applyPricing(null, input.pricing, input.name),
    entitlements: applyEntitlementChanges([], input.entitlements, [], lookup),
    addons: applyAddonChanges([], input.addons),
    meta: {},
    created_at: new Date().toISOString(),
  };
}

/** Plan fields to PATCH for an update (everything except entitlements and add-ons). */
export function planPatch(plan: Plan, input: UpdatePlanInput) {
  const { name, description, note, isFree, pricing } = input;
  return defined({
    name,
    description,
    note,
    isFree,
    pricingCard: pricing === undefined ? undefined : applyPricing(plan.pricingCard, pricing, name ?? plan.name),
  });
}

export function previewPlanUpdate(plan: Plan, input: UpdatePlanInput, lookup: CatalogLookup): Plan {
  return {
    ...plan,
    ...planPatch(plan, input),
    entitlements: applyEntitlementChanges(plan.entitlements, input.setEntitlements, input.removeEntitlements, lookup),
    addons: applyAddonChanges(plan.addons, input.addAddons, input.removeAddons),
  };
}

export function previewNewIncentive(input: CreateIncentiveInput, appId: string, lookup: CatalogLookup): Incentive {
  return {
    id: input.id,
    app_id: appId,
    name: input.name,
    description: input.description ?? null,
    entitlements: applyEntitlementChanges([], input.entitlements, [], lookup),
    addons: applyAddonChanges([], input.addons),
    created_at: new Date().toISOString(),
  };
}

export function previewIncentiveUpdate(incentive: Incentive, input: UpdateIncentiveInput, lookup: CatalogLookup): Incentive {
  return {
    ...incentive,
    ...defined({ name: input.name, description: input.description }),
    entitlements: applyEntitlementChanges(incentive.entitlements, input.setEntitlements, input.removeEntitlements, lookup),
    addons: applyAddonChanges(incentive.addons, input.addAddons, input.removeAddons),
  };
}

export function previewNewEntitlement(input: CreateEntitlementInput, appId: string): Entitlement {
  return { ...input, description: input.description ?? null, app_id: appId, created_at: new Date().toISOString() };
}

export function previewNewAddon(input: CreateAddonInput, appId: string): Addon {
  return { ...input, description: input.description ?? null, app_id: appId, created_at: new Date().toISOString() };
}

export function previewSimpleUpdate<T extends Entitlement | Addon>(record: T, input: UpdateEntitlementInput | UpdateAddonInput): T {
  return { ...record, ...defined({ name: input.name, description: input.description }) };
}

// ---------------------------------------------------------------------------
// Diffs

export type ChangeOp = "set" | "change" | "add" | "remove";

export interface ChangeRow {
  key: string;
  label: string;
  op: ChangeOp;
  from?: string;
  to?: string;
}

type Field = { key: string; label: string; value: (record: CatalogRecord) => string | null | undefined };

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const yesNo = (v: unknown) => (v ? "Yes" : null);
const card = (r: CatalogRecord) => (r as Plan).pricingCard ?? null;
const money = (field: "monthlyPrice" | "yearlyPrice" | "price") => (r: CatalogRecord) => {
  const c = card(r);
  return c && c[field] != null ? formatCurrency(c[field], c.currency) : null;
};

const FIELDS: Record<CatalogKind, Field[]> = {
  plan: [
    { key: "name", label: "Name", value: (r) => text(r.name) },
    { key: "description", label: "Description", value: (r) => text(r.description) },
    { key: "note", label: "Internal note", value: (r) => text((r as Plan).note) },
    { key: "isFree", label: "Free plan", value: (r) => yesNo((r as Plan).isFree) },
    { key: "card", label: "Pricing card", value: (r) => (card(r) ? "Shown" : null) },
    { key: "type", label: "Billing", value: (r) => (card(r) ? (card(r)!.type === "one_time" ? "One-time" : "Subscription") : null) },
    { key: "monthly", label: "Monthly price", value: money("monthlyPrice") },
    { key: "yearly", label: "Yearly price", value: money("yearlyPrice") },
    { key: "price", label: "One-time price", value: money("price") },
    { key: "title", label: "Card title", value: (r) => text(card(r)?.title) },
    { key: "cardDescription", label: "Card description", value: (r) => text(card(r)?.description) },
    { key: "featured", label: "Featured", value: (r) => yesNo(card(r)?.featured) },
  ],
  entitlement: [
    { key: "name", label: "Name", value: (r) => text(r.name) },
    {
      key: "type",
      label: "Type",
      value: (r) => ((r as Entitlement).type === "boolean" ? "Feature" : (r as Entitlement).type ? "Usage limit" : null),
    },
    { key: "description", label: "Description", value: (r) => text(r.description) },
  ],
  addon: [
    { key: "name", label: "Name", value: (r) => text(r.name) },
    { key: "description", label: "Description", value: (r) => text(r.description) },
  ],
  incentive: [
    { key: "name", label: "Name", value: (r) => text(r.name) },
    { key: "description", label: "Description", value: (r) => text(r.description) },
  ],
};

/** "1,000", "Unlimited" or "Included" (feature entitlements). */
export function formatEntitlementValue(ref: EntitlementRef, lookup: CatalogLookup) {
  if (lookup.entitlements.get(ref.id)?.type === "boolean" || !("max" in ref)) return "Included";
  return ref.max === null || ref.max === undefined ? "Unlimited" : formatNumber(ref.max);
}

function listRows<T>(
  prefix: string,
  before: T[],
  after: T[],
  id: (item: T) => string,
  label: (item: T) => string,
  value: (item: T) => string | undefined,
): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const old = new Map(before.map((item) => [id(item), item]));
  const next = new Map(after.map((item) => [id(item), item]));
  for (const [key, item] of next) {
    const prev = old.get(key);
    if (!prev) rows.push({ key: `${prefix}:${key}`, label: label(item), op: "add", to: value(item) });
    else if (value(prev) !== value(item)) {
      rows.push({ key: `${prefix}:${key}`, label: label(item), op: "change", from: value(prev), to: value(item) });
    }
  }
  for (const [key, item] of old) {
    if (!next.has(key)) rows.push({ key: `${prefix}:${key}`, label: label(item), op: "remove", from: value(item) });
  }
  return rows;
}

/**
 * What changes between two versions of a record. `before: null` describes a new record
 * (every field it sets); the caller handles deletes.
 */
export function diffRecord(kind: CatalogKind, before: CatalogRecord | null, after: CatalogRecord, lookup: CatalogLookup): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (const field of FIELDS[kind]) {
    const from = before ? field.value(before) ?? undefined : undefined;
    const to = field.value(after) ?? undefined;
    if (from === to) continue;
    if (!before) rows.push({ key: field.key, label: field.label, op: "set", to });
    else if (from === undefined) rows.push({ key: field.key, label: field.label, op: "add", to });
    else if (to === undefined) rows.push({ key: field.key, label: field.label, op: "remove", from });
    else rows.push({ key: field.key, label: field.label, op: "change", from, to });
  }

  if (kind === "plan") {
    const benefits = (r: CatalogRecord | null) => card(r ?? ({} as Plan))?.benefits ?? [];
    rows.push(...listRows("benefit", benefits(before), benefits(after), (b) => b.title, () => "Benefit", (b) => b.title));
  }

  if (kind === "plan" || kind === "incentive") {
    const owner = (r: CatalogRecord | null) => r as Plan | Incentive | null;
    rows.push(
      ...listRows(
        "entitlement",
        owner(before)?.entitlements ?? [],
        owner(after)?.entitlements ?? [],
        (e) => e.id,
        (e) => lookup.entitlements.get(e.id)?.name ?? e.id,
        (e) => formatEntitlementValue(e, lookup),
      ),
      ...listRows(
        "addon",
        owner(before)?.addons ?? [],
        owner(after)?.addons ?? [],
        (id) => id,
        () => "Add-on",
        (id) => lookup.addons.get(id)?.name ?? id,
      ),
    );
  }
  return rows;
}
