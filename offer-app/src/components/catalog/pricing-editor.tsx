"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { Plan, PricingCard, PricingType } from "@/lib/api/types";
import { cn, formatCurrency } from "@/lib/utils";
import { CURRENCIES } from "./format";
import { PricingResponseSheet } from "./pricing-response-sheet";

type Draft = {
  title: string;
  description: string;
  type: PricingType;
  currency: string;
  monthlyPrice: string;
  yearlyPrice: string;
  price: string;
  featured: boolean;
  benefits: { id: string; title: string }[];
};

const toDraft = (plan: Plan): Draft => {
  const c = plan.pricingCard;
  return {
    title: c?.title ?? plan.name,
    description: c?.description ?? plan.description ?? "",
    type: c?.type ?? "subscription",
    currency: c?.currency ?? "USD",
    monthlyPrice: c?.monthlyPrice != null ? String(c.monthlyPrice) : "",
    yearlyPrice: c?.yearlyPrice != null ? String(c.yearlyPrice) : "",
    price: c?.price != null ? String(c.price) : "",
    featured: c?.featured ?? false,
    benefits: c?.benefits?.length ? c.benefits : [],
  };
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Free plans keep their card copy; prices are zeroed so clients render "Free". */
function toCard(d: Draft, free: boolean): PricingCard {
  return {
    title: d.title.trim(),
    description: d.description.trim() || null,
    type: d.type,
    currency: d.currency,
    featured: d.featured,
    benefits: d.benefits.filter((b) => b.title.trim()).map((b) => ({ id: b.id, title: b.title.trim() })),
    ...(d.type === "subscription"
      ? { monthlyPrice: free ? 0 : num(d.monthlyPrice), yearlyPrice: free ? 0 : num(d.yearlyPrice) }
      : { price: free ? 0 : num(d.price) }),
  };
}

export function PricingEditor({ appId, plan }: { appId: string; plan: Plan }) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan));
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  // Re-sync when the saved card changes (e.g. after save or an edit elsewhere).
  const savedKey = JSON.stringify(plan.pricingCard ?? null);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setDraft(toDraft(plan));
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const free = plan.isFree ?? false;
  const card = useMemo(() => toCard(draft, free), [draft, free]);
  // Compare against the stored card as-is, so marking a priced card free shows it needs saving.
  const dirty = JSON.stringify(card) !== JSON.stringify(plan.pricingCard ? toCard(toDraft(plan), false) : null);
  const invalidPrice =
    !free && [draft.monthlyPrice, draft.yearlyPrice, draft.price].some((v) => v.trim() !== "" && !(Number(v) >= 0));

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onBenefitDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft((d) => {
      const from = d.benefits.findIndex((b) => b.id === active.id);
      const to = d.benefits.findIndex((b) => b.id === over.id);
      return from < 0 || to < 0 ? d : { ...d, benefits: arrayMove(d.benefits, from, to) };
    });
  };

  const save = useApiMutation(() => api.plans.update(appId, plan.id, { pricingCard: card }), {
    success: "Pricing card saved",
  });
  const setFree = useApiMutation((isFree: boolean) => api.plans.update(appId, plan.id, { isFree }), {
    success: (_, isFree) => (isFree ? `${plan.name} is now free` : `${plan.name} is now paid`),
  });
  const removeCard = useApiMutation(() => api.plans.update(appId, plan.id, { pricingCard: null }), {
    success: "Pricing card removed",
  });

  const previewPrice = free
    ? 0
    : card.type === "one_time"
      ? card.price
      : billing === "monthly"
        ? card.monthlyPrice
        : card.yearlyPrice;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <label className="flex items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-sm font-semibold text-fg">Free plan</span>
              <span className="mt-0.5 block text-sm text-fg-tertiary">
                Accounts on this plan don&apos;t pay. It shows as Free on your pricing page and is never offered as a paid upgrade.
              </span>
            </span>
            <Switch checked={free} disabled={setFree.isPending} onCheckedChange={(v) => setFree.mutate(v)} />
          </label>
        </Card>
        <Card className="@container">
          <CardHeader
            title="Pricing card"
            actions={plan.pricingCard ? <Badge color="green" dot>Published</Badge> : <Badge>Not set</Badge>}
          />
          <div className="flex flex-col gap-5 p-5">
            <div className={cn("grid grid-cols-1 gap-4", !free && "@md:grid-cols-2")}>
              <Field label="Title">
                <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              {free ? null : (
                <Field label="Pricing">
                  <Segmented
                    value={draft.type}
                    onValueChange={(v) => set("type", v)}
                    options={[
                      { value: "subscription", label: "Subscription" },
                      { value: "one_time", label: "One-time" },
                    ]}
                    className="h-8 w-full [&>*]:flex-1"
                  />
                </Field>
              )}
            </div>
            <Field label="Description" hint="(optional)">
              <Textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            {free ? null : (
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-3">
                <Field label="Currency">
                  <Select
                    value={draft.currency}
                    onValueChange={(v) => set("currency", v)}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                {draft.type === "subscription" ? (
                  <>
                    <Field label="Monthly price">
                      <Input inputMode="decimal" value={draft.monthlyPrice} onChange={(e) => set("monthlyPrice", e.target.value)} placeholder="29" />
                    </Field>
                    <Field label="Yearly price">
                      <Input inputMode="decimal" value={draft.yearlyPrice} onChange={(e) => set("yearlyPrice", e.target.value)} placeholder="290" />
                    </Field>
                  </>
                ) : (
                  <Field label="Price" className="@lg:col-span-2">
                    <Input inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="199" />
                  </Field>
                )}
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-fg">Featured</span>
                <span className="block text-xs text-fg-tertiary">Highlight this plan on your pricing page.</span>
              </span>
              <Switch checked={draft.featured} onCheckedChange={(v) => set("featured", v)} />
            </label>
            <Field label="Benefits">
              <div className="flex flex-col gap-1.5">
                <DndContext
                  id={dndId}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={onBenefitDragEnd}
                >
                  <SortableContext items={draft.benefits.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1.5">
                      {draft.benefits.map((b, i) => (
                        <SortableBenefit
                          key={b.id}
                          benefit={b}
                          onChange={(title) =>
                            set(
                              "benefits",
                              draft.benefits.map((x, j) => (j === i ? { ...x, title } : x)),
                            )
                          }
                          onRemove={() => set("benefits", draft.benefits.filter((_, j) => j !== i))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => set("benefits", [...draft.benefits, { id: `b${Date.now().toString(36)}`, title: "" }])}
                >
                  <Plus />
                  Add benefit
                </Button>
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-bg-subtle px-5 py-3">
            {plan.pricingCard ? (
              <Button
                variant="danger-ghost"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Remove pricing card?",
                      description: `${plan.name} will no longer appear in GET /plans/pricing.`,
                      confirmLabel: "Remove",
                    })
                  )
                    removeCard.mutate();
                }}
              >
                <Trash2 />
                Remove card
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {dirty ? (
                <Button onClick={() => setDraft(toDraft(plan))} disabled={save.isPending}>
                  Discard
                </Button>
              ) : null}
              <Button
                variant="primary"
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={!draft.title.trim() || invalidPrice || (!dirty && Boolean(plan.pricingCard))}
              >
                {plan.pricingCard ? "Save changes" : "Publish pricing card"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-7 items-center justify-between">
          <span className="text-xs font-medium text-fg-tertiary">Preview</span>
          {card.type === "subscription" && !free ? (
            <Segmented
              size="xs"
              value={billing}
              onValueChange={setBilling}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
          ) : null}
        </div>
        <div
          className={cn(
            "rounded-xl border bg-bg p-5 shadow-sm",
            card.featured ? "border-accent shadow-[0_0_0_1px_var(--accent),var(--shadow-md)]" : "border-border",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-semibold">{card.title || "Untitled"}</span>
            {card.featured ? <Badge color="blue">Popular</Badge> : null}
          </div>
          {card.description ? <p className="mt-1 text-sm text-fg-tertiary">{card.description}</p> : null}
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-display text-3xl font-semibold tabular">
              {previewPrice == null || Number.isNaN(previewPrice) ? "—" : previewPrice === 0 ? "Free" : formatCurrency(previewPrice, card.currency)}
            </span>
            {previewPrice ? (
              <span className="text-sm text-fg-tertiary">
                {card.type === "one_time" ? "one-time" : billing === "monthly" ? "/ month" : "/ year"}
              </span>
            ) : null}
          </div>
          <div className={cn("mt-4 flex h-8 items-center justify-center rounded-md text-sm font-medium", card.featured ? "bg-accent text-white" : "border border-border-strong text-fg")}>
            Choose {card.title || "plan"}
          </div>
          {card.benefits.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {card.benefits.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-sm text-fg-secondary">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {b.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <PricingResponseSheet appId={appId} plan={plan} dirty={dirty} />
      </div>
    </div>
  );
}

function SortableBenefit({
  benefit,
  onChange,
  onRemove,
}: {
  benefit: { id: string; title: string };
  onChange: (title: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: benefit.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex items-center gap-1.5 rounded-md bg-bg",
        isDragging && "z-10 opacity-90 shadow-md ring-1 ring-border",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Reorder ${benefit.title || "benefit"}`}
        className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-fg-placeholder outline-none hover:text-fg-tertiary focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <Input size="sm" value={benefit.title} placeholder="e.g. Unlimited projects" onChange={(e) => onChange(e.target.value)} />
      <Button icon size="sm" variant="ghost" aria-label="Remove benefit" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}
