"use client";

import { Offer, OfferProvider, type BumpRenderProps, type PlanRenderProps } from "@/sdk/checkout";
import type { PublicOffer } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * The checkout the buyer would see, rendered with the real checkout SDK
 * components (styled here with dashboard tokens). Interactive, but never
 * starts a payment.
 */
export function OfferPreview({ offer, className }: { offer: PublicOffer; className?: string }) {
  // Remount when the plans or intervals change so the selection starts from the offer's defaults.
  const shape = JSON.stringify([offer.plans.map((p) => p.id), offer.intervals, offer.default_plan, offer.bumps.map((b) => b.id)]);
  return (
    <OfferProvider key={shape} apiUrl="" appId="preview" publishableKey="" initialOffer={offer} account="preview">
      <div className={cn("flex flex-col gap-4 rounded-xl border border-border bg-bg-subtle p-5", className)}>
        <Offer.Headline className="[&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_li]:text-xs [&_li]:text-fg-tertiary [&_p]:mt-1 [&_p]:text-sm [&_p]:text-fg-tertiary [&_ul]:mt-2 [&_ul]:flex [&_ul]:flex-wrap [&_ul]:gap-x-3" />
        <Offer.IntervalToggle className="inline-flex self-start rounded-md bg-bg-muted p-0.5 text-sm [&_button]:h-7 [&_button]:rounded-[5px] [&_button]:px-2.5 [&_button]:text-fg-tertiary [&_button[data-selected]]:bg-bg [&_button[data-selected]]:text-fg [&_button[data-selected]]:shadow-sm" />
        <Offer.Plans className="grid gap-2">
          {(plan) => <Offer.Plan plan={plan}>{(props) => <PreviewPlan {...props} />}</Offer.Plan>}
        </Offer.Plans>
        <Offer.Bumps className="grid gap-2">
          {(bump) => <Offer.Bump bump={bump}>{(props) => <PreviewBump {...props} />}</Offer.Bump>}
        </Offer.Bumps>
        <Offer.Summary className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-border pt-3 text-sm tabular-nums [&_dd]:text-right [&_dd[data-part=renewal]]:col-span-2 [&_dd[data-part=renewal]]:text-left [&_dd[data-part=renewal]]:text-xs [&_dd[data-part=renewal]]:text-fg-tertiary [&_[data-part=total]]:font-semibold [&_dt]:text-fg-secondary" />
        <div className="flex h-10 items-center justify-center rounded-md border border-border bg-bg text-sm font-medium text-fg-tertiary">
          {offer.paypal ? "PayPal button" : "PayPal isn't connected"}
        </div>
      </div>
    </OfferProvider>
  );
}

function PreviewPlan({ plan, selected, select, priceText, listPriceText, renewalText, savings }: PlanRenderProps) {
  return (
    <button
      type="button"
      onClick={select}
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-bg px-3.5 py-3 text-left outline-none transition-colors focus-visible:shadow-[0_0_0_3px_var(--ring)]",
        selected ? "border-accent shadow-[0_0_0_3px_var(--ring)]" : "border-border hover:border-border-strong",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">{plan.name}</span>
        {savings ? <span className="rounded-[5px] bg-tag-green-bg px-1.5 text-xs font-medium text-tag-green-fg">-{savings}%</span> : null}
      </span>
      <span className="flex items-baseline gap-2 tabular-nums">
        {listPriceText ? <s className="text-xs text-fg-tertiary">{listPriceText}</s> : null}
        <span className="text-lg font-semibold text-fg">{priceText}</span>
      </span>
      {renewalText ? <span className="text-xs text-fg-tertiary">{renewalText}</span> : null}
      {plan.extras.map((e) => (
        <span key={e.id} className="text-xs text-success-fg">
          {e.max === null ? `Unlimited ${e.name}` : `${e.max.toLocaleString()} ${e.name}`}
        </span>
      ))}
    </button>
  );
}

function PreviewBump({ bump, selected, toggle, priceText }: BumpRenderProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border border-dashed bg-bg px-3.5 py-2.5 text-sm",
        selected ? "border-solid border-accent" : "border-border-strong",
      )}
    >
      <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={selected} onChange={(e) => toggle(e.target.checked)} />
      <span className="min-w-0">
        <span className="font-medium text-fg">
          {bump.label} <span className="text-accent-fg">{priceText}</span>
        </span>
        {bump.description ? <span className="block text-xs text-fg-tertiary">{bump.description}</span> : null}
      </span>
    </label>
  );
}
