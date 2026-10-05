"use client";

import { BadgePercent, CircleAlert, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NameIdFields, useNameId } from "@/components/catalog/name-id-fields";
import { PageBody, PageHeader } from "@/components/shell/page";
import { IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useAddons, useApiMutation, useEntitlements, usePlans } from "@/lib/api/hooks";
import type { Addon, Entitlement, Offer, OfferInput, OfferInterval, Plan, PublicOffer } from "@/lib/api/types";
import { cn, formatCurrency } from "@/lib/utils";
import { extrasForLabel, INTERVAL_NAMES } from "./format";
import { OfferPreview } from "./offer-preview";

// ─── Draft state ───────────────────────────────────────
// Form fields are kept as strings while editing and turned into the API's
// offer shape by toInput(). The API validates and prices every change for the
// live preview, so the form never re-implements pricing.

const INTERVALS: OfferInterval[] = ["month", "year", "once"];
const EXTRAS_FOR = ["subscription", "discount", "P3M", "P6M", "P1Y"];

interface PlanDraft {
  plan_id: string;
  prices: Partial<Record<OfferInterval, { amount: string; cycles: string }>>;
  entitlements: { id: string; max: string }[];
  extras_for: string;
}

interface BumpDraft {
  key: string;
  id: string;
  label: string;
  description: string;
  amount: string;
  kind: "addon" | "credits";
  addon: string;
  entitlement: string;
  credits: string;
  plans: string[];
}

interface Draft {
  headline: string;
  subhead: string;
  bullets: string;
  discountKind: "percent" | "amount" | "none";
  discountValue: string;
  cycles: string;
  intervals: OfferInterval[];
  plans: PlanDraft[];
  defaultPlan: string | null;
  bumps: BumpDraft[];
  expiresAt: string;
  maxRedemptions: string;
}

let bumpKeys = 0;
const newKey = () => `bump-${++bumpKeys}`;

// ISO ↔ the local "YYYY-MM-DDTHH:mm" a datetime-local input uses.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromOffer(offer: Offer | null | undefined): Draft {
  if (!offer) {
    return {
      headline: "",
      subhead: "",
      bullets: "",
      discountKind: "percent",
      discountValue: "20",
      cycles: "3",
      intervals: ["month", "year"],
      plans: [],
      defaultPlan: null,
      bumps: [],
      expiresAt: "",
      maxRedemptions: "",
    };
  }
  const d = offer.discount;
  return {
    headline: offer.copy.headline ?? "",
    subhead: offer.copy.subhead ?? "",
    bullets: (offer.copy.bullets ?? []).join("\n"),
    discountKind: !d ? "none" : d.percent !== undefined ? "percent" : "amount",
    discountValue: d ? String(d.percent ?? d.amount_off ?? "") : "",
    cycles: d?.cycles ? String(d.cycles) : "",
    intervals: offer.intervals,
    plans: offer.plans.map((p) => ({
      plan_id: p.plan_id,
      prices: Object.fromEntries(
        Object.entries(p.prices ?? {}).map(([i, v]) => [i, { amount: String(v.amount), cycles: v.cycles ? String(v.cycles) : "" }]),
      ),
      entitlements: p.entitlements.map((e) => ({ id: e.id, max: e.max === null || e.max === undefined ? "" : String(e.max) })),
      extras_for: p.extras_for,
    })),
    defaultPlan: offer.default_plan,
    bumps: offer.bumps.map((b) => ({
      key: newKey(),
      id: b.id,
      label: b.label,
      description: b.description ?? "",
      amount: String(b.price.amount),
      kind: b.grant.credits ? "credits" : "addon",
      addon: b.grant.addons?.[0] ?? "",
      entitlement: b.grant.credits?.entitlement ?? "",
      credits: b.grant.credits ? String(b.grant.credits.amount) : "",
      plans: b.applies_to?.plans ?? [],
    })),
    expiresAt: toLocalInput(offer.expires_at),
    maxRedemptions: offer.max_redemptions ? String(offer.max_redemptions) : "",
  };
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function toInput(draft: Draft, name: string, catalog: Map<string, Entitlement>): OfferInput {
  const value = num(draft.discountValue);
  const cycles = num(draft.cycles);
  const discount =
    draft.discountKind === "none" || value === undefined
      ? null
      : { ...(draft.discountKind === "percent" ? { percent: value } : { amount_off: value }), ...(cycles ? { cycles } : {}) };
  return {
    name: name.trim() || undefined,
    copy: {
      ...(draft.headline.trim() ? { headline: draft.headline.trim() } : {}),
      ...(draft.subhead.trim() ? { subhead: draft.subhead.trim() } : {}),
      bullets: draft.bullets
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean),
    },
    discount,
    intervals: draft.intervals,
    plans: draft.plans.map((p) => {
      const prices = Object.fromEntries(
        Object.entries(p.prices)
          .filter(([i, v]) => draft.intervals.includes(i as OfferInterval) && v.amount.trim() !== "")
          .map(([i, v]) => [i, { amount: Number(v.amount), ...(num(v.cycles) ? { cycles: Number(v.cycles) } : {}) }]),
      );
      return {
        plan_id: p.plan_id,
        ...(Object.keys(prices).length ? { prices } : {}),
        entitlements: p.entitlements
          .filter((e) => e.id)
          .map((e) => (catalog.get(e.id)?.type === "usage" ? { id: e.id, max: num(e.max) ?? null } : { id: e.id })),
        addons: [],
        extras_for: p.extras_for,
      };
    }),
    default_plan: draft.defaultPlan && draft.plans.some((p) => p.plan_id === draft.defaultPlan) ? draft.defaultPlan : null,
    bumps: draft.bumps.map((b) => ({
      id: b.id || b.label,
      label: b.label,
      ...(b.description.trim() ? { description: b.description.trim() } : {}),
      price: { amount: Number(b.amount || 0) },
      grant:
        b.kind === "addon"
          ? { addons: b.addon ? [b.addon] : [] }
          : { credits: { entitlement: b.entitlement, amount: Number(b.credits || 0) } },
      ...(b.plans.length ? { applies_to: { plans: b.plans.filter((id) => draft.plans.some((p) => p.plan_id === id)) } } : {}),
    })),
    expires_at: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
    max_redemptions: num(draft.maxRedemptions) ?? null,
  };
}

/** Calls the API's draft preview after typing pauses; keeps the last good preview while an edit is invalid. */
function useDraftPreview(appId: string, input: OfferInput | null) {
  const key = input ? JSON.stringify(input) : null;
  const [result, setResult] = useState<{ key: string; offer?: PublicOffer; error?: string }>();
  const [lastGood, setLastGood] = useState<PublicOffer | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    const timer = setTimeout(() => {
      api.offers.previewDraft(appId, JSON.parse(key) as OfferInput).then(
        (offer) => {
          if (!active) return;
          setResult({ key, offer });
          setLastGood(offer);
        },
        (err: unknown) => active && setResult({ key, error: err instanceof Error ? err.message : String(err) }),
      );
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [appId, key]);

  const current = result?.key === key ? result : undefined;
  return { offer: current?.offer ?? lastGood, error: current?.error ?? null, pending: !!key && !current };
}

// ─── Editor ────────────────────────────────────────────

export function OfferEditor({ appId, offer, source }: { appId: string; offer?: Offer | null; source?: Offer | null }) {
  const router = useRouter();
  const editing = Boolean(offer);
  const start = offer ?? source;
  const nameId = useNameId(offer ? { name: offer.name, id: offer.id } : source ? { name: `${source.name} copy` } : undefined);
  const [draft, setDraft] = useState<Draft>(() => fromOffer(start));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const plans = usePlans(appId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const { data: addons = [] } = useAddons(appId);
  const entitlementById = useMemo(() => new Map(entitlements.map((e) => [e.id, e])), [entitlements]);

  const input = draft.plans.length ? toInput(draft, nameId.name, entitlementById) : null;
  const preview = useDraftPreview(appId, input ? { ...input, id: nameId.id || undefined } : null);

  const save = useApiMutation(
    () => {
      const body = toInput(draft, nameId.name, entitlementById);
      return offer ? api.offers.update(appId, offer.id, body) : api.offers.create(appId, { ...body, id: nameId.id });
    },
    {
      success: offer ? "Offer saved" : "Offer created as a draft",
      onSuccess: (saved) => router.push(`/apps/${appId}/offers/${encodeURIComponent(saved.id)}`),
    },
  );

  const canSave = !!nameId.name.trim() && (editing || !!nameId.id) && draft.plans.length > 0 && !preview.error;
  const back = offer ? `/apps/${appId}/offers/${encodeURIComponent(offer.id)}` : `/apps/${appId}/offers`;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Offers", href: `/apps/${appId}/offers`, icon: <BadgePercent /> },
          ...(offer ? [{ label: offer.name, href: back }] : []),
        ]}
        title={offer ? "Edit" : "New offer"}
        actions={
          <>
            <Link href={back} className={buttonVariants()}>
              Cancel
            </Link>
            <Button variant="primary" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
              <Save />
              {offer ? "Save offer" : "Create draft"}
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="mx-auto flex w-full max-w-[1180px] gap-10 px-8 py-8">
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) save.mutate();
            }}
          >
            <Section title="Details" description="How the offer is named in the dashboard and introduced on the checkout page.">
              <div className="flex flex-col gap-4">
                <NameIdFields
                  state={nameId}
                  namePlaceholder="Black Friday"
                  idEditable={!editing}
                  idDescription="Used in checkout links (?offer=…) and API calls."
                />
                <Field label="Headline" hint="(optional)">
                  <Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Half off for 3 months" />
                </Field>
                <Field label="Subhead" hint="(optional)">
                  <Input value={draft.subhead} onChange={(e) => set("subhead", e.target.value)} placeholder="Pick a plan. Cancel anytime." />
                </Field>
                <Field label="Bullets" hint="(one per line)">
                  <Textarea rows={3} value={draft.bullets} onChange={(e) => set("bullets", e.target.value)} placeholder={"Cancel anytime\nKeep your data"} />
                </Field>
              </div>
            </Section>

            <Section
              title="Pricing"
              description="One discount for every plan in the offer. Each plan can override it below."
            >
              <div className="flex flex-col gap-4">
                <Segmented
                  value={draft.discountKind}
                  onValueChange={(v) => set("discountKind", v)}
                  options={[
                    { value: "percent", label: "Percent off" },
                    { value: "amount", label: "Amount off" },
                    { value: "none", label: "No discount" },
                  ]}
                />
                {draft.discountKind !== "none" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={draft.discountKind === "percent" ? "Percent off" : "Amount off"}>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={draft.discountValue}
                        onChange={(e) => set("discountValue", e.target.value)}
                      />
                    </Field>
                    <Field label="For how many payments" description="Then the list price. Empty means it never ends.">
                      <Input type="number" min={1} placeholder="Always" value={draft.cycles} onChange={(e) => set("cycles", e.target.value)} />
                    </Field>
                  </div>
                ) : null}
                <Field label="Billing options" description="Which ways to pay the checkout page offers. Lifetime needs one-time prices.">
                  <div className="flex flex-wrap gap-4">
                    {INTERVALS.map((interval) => (
                      <label key={interval} className="flex items-center gap-2 text-sm text-fg">
                        <Checkbox
                          aria-label={INTERVAL_NAMES[interval]}
                          checked={draft.intervals.includes(interval)}
                          onCheckedChange={(on) =>
                            set(
                              "intervals",
                              INTERVALS.filter((i) => (i === interval ? on : draft.intervals.includes(i))),
                            )
                          }
                        />
                        {INTERVAL_NAMES[interval]}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            <Section
              title="Plans"
              description="Each plan keeps its entitlements and list price. Add extras to give more than the plan does."
            >
              {plans.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <PlansEditor
                  plans={plans.data ?? []}
                  draft={draft}
                  setDraft={setDraft}
                  entitlements={entitlements}
                  preview={preview.offer}
                />
              )}
            </Section>

            <Section
              title="Order bumps"
              description="One-time add-ons offered at checkout, like a setup call or a credit pack."
              actions={
                <Button
                  size="sm"
                  onClick={() =>
                    set("bumps", [
                      ...draft.bumps,
                      { key: newKey(), id: "", label: "", description: "", amount: "", kind: "addon", addon: "", entitlement: "", credits: "", plans: [] },
                    ])
                  }
                >
                  <Plus />
                  Add bump
                </Button>
              }
            >
              <BumpsEditor draft={draft} setDraft={setDraft} addons={addons} entitlements={entitlements} plans={plans.data ?? []} />
            </Section>

            <Section title="Availability" description="When the offer stops taking new buyers. Existing buyers keep their price.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ends" hint="(optional)">
                  <Input type="datetime-local" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
                </Field>
                <Field label="Max sales" hint="(optional)">
                  <Input type="number" min={1} placeholder="Unlimited" value={draft.maxRedemptions} onChange={(e) => set("maxRedemptions", e.target.value)} />
                </Field>
              </div>
            </Section>
            <button type="submit" hidden />
          </form>

          <aside className="sticky top-8 hidden w-[380px] shrink-0 self-start xl:block">
            <PreviewPanel preview={preview} hasPlans={draft.plans.length > 0} />
          </aside>
        </div>
        <div className="border-t border-border px-8 py-6 xl:hidden">
          <PreviewPanel preview={preview} hasPlans={draft.plans.length > 0} />
        </div>
      </PageBody>
    </>
  );
}

function PreviewPanel({ preview, hasPlans }: { preview: ReturnType<typeof useDraftPreview>; hasPlans: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Checkout preview</h3>
        {preview.pending ? <span className="text-xs text-fg-tertiary">Updating…</span> : null}
      </div>
      {preview.error ? (
        <p className="flex gap-2 rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {preview.error}
        </p>
      ) : null}
      {!hasPlans ? (
        <p className="rounded-xl border border-dashed border-border-strong px-5 py-10 text-center text-sm text-fg-tertiary">
          Add a plan to see the checkout.
        </p>
      ) : preview.offer ? (
        <OfferPreview offer={preview.offer} className={cn(preview.error && "opacity-60")} />
      ) : (
        <Skeleton className="h-80" />
      )}
      <p className="text-xs text-fg-tertiary">Built with the checkout SDK&apos;s components, priced by the API.</p>
    </div>
  );
}

// ─── Plans ─────────────────────────────────────────────

function cardPrice(plan: Plan, interval: OfferInterval): number | null {
  const card = plan.pricingCard;
  if (!card) return null;
  if (card.type === "one_time") return interval === "once" ? (card.price ?? null) : null;
  return interval === "month" ? (card.monthlyPrice ?? null) : interval === "year" ? (card.yearlyPrice ?? null) : null;
}

function PlansEditor({
  plans,
  draft,
  setDraft,
  entitlements,
  preview,
}: {
  plans: Plan[];
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  entitlements: Entitlement[];
  preview: PublicOffer | null;
}) {
  const paid = plans.filter((p) => !p.isFree);
  if (!paid.length) {
    return <p className="text-sm text-fg-tertiary">Create a paid plan with a pricing card first.</p>;
  }

  const updatePlan = (planId: string, fn: (p: PlanDraft) => PlanDraft) =>
    setDraft((d) => ({ ...d, plans: d.plans.map((p) => (p.plan_id === planId ? fn(p) : p)) }));

  const toggle = (planId: string, on: boolean) =>
    setDraft((d) => {
      // Keep the catalog's order so the checkout lists plans the way the pricing page does.
      const next = on
        ? paid
            .map((p) => p.id)
            .filter((id) => id === planId || d.plans.some((x) => x.plan_id === id))
            .map((id) => d.plans.find((x) => x.plan_id === id) ?? { plan_id: id, prices: {}, entitlements: [], extras_for: "subscription" })
        : d.plans.filter((p) => p.plan_id !== planId);
      return { ...d, plans: next, defaultPlan: d.defaultPlan && next.some((p) => p.plan_id === d.defaultPlan) ? d.defaultPlan : null };
    });

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {paid.map((plan) => {
        const entry = draft.plans.find((p) => p.plan_id === plan.id);
        const shown = preview?.plans.find((p) => p.id === plan.id);
        return (
          <div key={plan.id} className="border-b border-border last:border-b-0">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-bg-subtle">
              <Checkbox aria-label={`Include ${plan.name}`} checked={!!entry} onCheckedChange={(on) => toggle(plan.id, on)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{plan.name}</span>
                <span className="block text-xs text-fg-tertiary">
                  {INTERVALS.map((i) => [i, cardPrice(plan, i)] as const)
                    .filter(([, v]) => v !== null)
                    .map(([i, v]) => `${formatCurrency(v)} ${INTERVAL_NAMES[i].toLowerCase()}`)
                    .join(" · ") || "No list price"}
                </span>
              </span>
              {entry ? (
                draft.defaultPlan === plan.id ? (
                  <span className="text-xs font-medium text-accent-fg">Preselected</span>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      setDraft((d) => ({ ...d, defaultPlan: plan.id }));
                    }}
                  >
                    Preselect
                  </Button>
                )
              ) : null}
            </label>
            {entry ? (
              <div className="flex flex-col gap-4 border-t border-border bg-bg-subtle px-4 py-4 pl-11">
                <div className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">Price</span>
                  {draft.intervals.map((interval) => {
                    const list = cardPrice(plan, interval);
                    const sale = shown?.prices[interval];
                    const override = entry.prices[interval] ?? { amount: "", cycles: "" };
                    if (list === null && !override.amount) {
                      return (
                        <div key={interval} className="flex items-center gap-3 text-sm">
                          <span className="w-20 text-fg-secondary">{INTERVAL_NAMES[interval]}</span>
                          <span className="text-fg-tertiary">No list price.</span>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => updatePlan(plan.id, (p) => ({ ...p, prices: { ...p.prices, [interval]: { amount: "0", cycles: "" } } }))}
                          >
                            Set a price
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div key={interval} className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="w-20 text-fg-secondary">{INTERVAL_NAMES[interval]}</span>
                        <span className="w-16 text-fg-tertiary tabular-nums">{list !== null ? <s>{formatCurrency(list)}</s> : "—"}</span>
                        <Input
                          size="sm"
                          type="number"
                          min={0}
                          step="any"
                          className="w-24"
                          aria-label={`${plan.name} ${interval} price`}
                          placeholder={sale ? String(sale.amount) : ""}
                          value={override.amount}
                          onChange={(e) =>
                            updatePlan(plan.id, (p) => ({ ...p, prices: { ...p.prices, [interval]: { ...override, amount: e.target.value } } }))
                          }
                        />
                        {interval !== "once" ? (
                          <>
                            <span className="text-fg-tertiary">for</span>
                            <Input
                              size="sm"
                              type="number"
                              min={1}
                              className="w-20"
                              aria-label={`${plan.name} ${interval} discounted payments`}
                              placeholder={sale?.cycles ? String(sale.cycles) : "all"}
                              value={override.cycles}
                              onChange={(e) =>
                                updatePlan(plan.id, (p) => ({ ...p, prices: { ...p.prices, [interval]: { ...override, cycles: e.target.value } } }))
                              }
                            />
                            <span className="text-fg-tertiary">payments</span>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                  <span className="text-xs text-fg-tertiary">Leave a price empty to use the offer&apos;s discount (shown in grey).</span>
                </div>

                <div className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">Extras</span>
                  {entry.entitlements.map((e, index) => {
                    const ent = entitlements.find((x) => x.id === e.id);
                    const planMax = plan.entitlements.find((x) => x.id === e.id)?.max;
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <Select
                          size="sm"
                          className="w-48"
                          aria-label="Entitlement"
                          value={e.id || null}
                          onValueChange={(id) =>
                            updatePlan(plan.id, (p) => ({
                              ...p,
                              entitlements: p.entitlements.map((x, i) => (i === index ? { ...x, id } : x)),
                            }))
                          }
                          options={entitlements.map((x) => ({ value: x.id, label: x.name }))}
                        />
                        {ent?.type === "usage" ? (
                          <>
                            <Input
                              size="sm"
                              type="number"
                              min={0}
                              className="w-28"
                              aria-label="Limit"
                              placeholder="Unlimited"
                              value={e.max}
                              onChange={(ev) =>
                                updatePlan(plan.id, (p) => ({
                                  ...p,
                                  entitlements: p.entitlements.map((x, i) => (i === index ? { ...x, max: ev.target.value } : x)),
                                }))
                              }
                            />
                            <span className="text-xs text-fg-tertiary">
                              {planMax === undefined ? "not in plan" : `plan: ${planMax === null ? "unlimited" : planMax.toLocaleString()}`}
                            </span>
                          </>
                        ) : ent ? (
                          <span className="text-xs text-fg-tertiary">Included with this offer</span>
                        ) : null}
                        <Button
                          size="xs"
                          variant="ghost"
                          icon
                          aria-label="Remove extra"
                          onClick={() => updatePlan(plan.id, (p) => ({ ...p, entitlements: p.entitlements.filter((_, i) => i !== index) }))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      onClick={() => updatePlan(plan.id, (p) => ({ ...p, entitlements: [...p.entitlements, { id: "", max: "" }] }))}
                    >
                      <Plus />
                      Add extra
                    </Button>
                    {entry.entitlements.length ? (
                      <Select
                        size="sm"
                        className="w-48"
                        aria-label="Extras last"
                        value={entry.extras_for}
                        onValueChange={(v) => updatePlan(plan.id, (p) => ({ ...p, extras_for: v }))}
                        options={EXTRAS_FOR.map((v) => ({ value: v, label: extrasForLabel(v) }))}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bumps ─────────────────────────────────────────────

function BumpsEditor({
  draft,
  setDraft,
  addons,
  entitlements,
  plans,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  addons: Addon[];
  entitlements: Entitlement[];
  plans: Plan[];
}) {
  if (!draft.bumps.length) {
    return <p className="text-sm text-fg-tertiary">No bumps. Add one to offer something extra at checkout.</p>;
  }
  const update = (key: string, patch: Partial<BumpDraft>) =>
    setDraft((d) => ({ ...d, bumps: d.bumps.map((b) => (b.key === key ? { ...b, ...patch } : b)) }));
  const included = draft.plans.map((p) => plans.find((x) => x.id === p.plan_id)).filter((p): p is Plan => !!p);

  return (
    <div className="flex flex-col gap-3">
      {draft.bumps.map((bump) => (
        <div key={bump.key} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Field label="Label" className="flex-1">
              <Input value={bump.label} onChange={(e) => update(bump.key, { label: e.target.value })} placeholder="Add a 1:1 welcome call" />
            </Field>
            <Field label="Price" className="w-28">
              <Input type="number" min={0} step="any" value={bump.amount} onChange={(e) => update(bump.key, { amount: e.target.value })} />
            </Field>
            <Button
              variant="ghost"
              icon
              className="mt-6"
              aria-label="Remove bump"
              onClick={() => setDraft((d) => ({ ...d, bumps: d.bumps.filter((b) => b.key !== bump.key) }))}
            >
              <Trash2 />
            </Button>
          </div>
          <Field label="Description" hint="(optional)">
            <Input value={bump.description} onChange={(e) => update(bump.key, { description: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Gives">
              <Segmented
                value={bump.kind}
                onValueChange={(kind) => update(bump.key, { kind })}
                options={[
                  { value: "addon", label: "An add-on" },
                  { value: "credits", label: "Credits" },
                ]}
              />
            </Field>
            {bump.kind === "addon" ? (
              <Select
                className="w-56"
                aria-label="Add-on"
                placeholder={addons.length ? "Choose an add-on" : "Create an add-on first"}
                value={bump.addon || null}
                onValueChange={(addon) => update(bump.key, { addon })}
                options={addons.map((a) => ({ value: a.id, label: a.name }))}
              />
            ) : (
              <>
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  aria-label="Credits"
                  placeholder="5000"
                  value={bump.credits}
                  onChange={(e) => update(bump.key, { credits: e.target.value })}
                />
                <Select
                  className="w-48"
                  aria-label="Entitlement"
                  placeholder="Of…"
                  value={bump.entitlement || null}
                  onValueChange={(entitlement) => update(bump.key, { entitlement })}
                  options={entitlements.filter((e) => e.type === "usage").map((e) => ({ value: e.id, label: e.name }))}
                />
              </>
            )}
          </div>
          {included.length > 1 ? (
            <Field label="Shown with" description="No selection means every plan.">
              <div className="flex flex-wrap gap-4">
                {included.map((plan) => (
                  <label key={plan.id} className="flex items-center gap-2 text-sm text-fg">
                    <Checkbox
                      aria-label={`Show with ${plan.name}`}
                      checked={bump.plans.includes(plan.id)}
                      onCheckedChange={(on) =>
                        update(bump.key, { plans: on ? [...bump.plans, plan.id] : bump.plans.filter((p) => p !== plan.id) })
                      }
                    />
                    {plan.name}
                  </label>
                ))}
              </div>
            </Field>
          ) : null}
          {bump.id ? (
            <span className="text-xs text-fg-tertiary">
              ID <IdTag>{bump.id}</IdTag>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function EditorSkeleton({ crumbs }: { crumbs: ReactNode }) {
  return (
    <>
      <PageHeader title={crumbs} />
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    </>
  );
}
