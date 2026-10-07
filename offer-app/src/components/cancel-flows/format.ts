import type { BadgeColor } from "@/components/ui/badge";
import type { CancelSessionRecord, SaveOfferKind, SaveOfferSpec } from "@/lib/api/types";

export const KIND_LABELS: Record<SaveOfferKind, string> = {
  discount: "Discount",
  pause: "Pause",
  downgrade: "Downgrade",
  incentive: "Incentive",
};

export const KIND_DESCRIPTIONS: Record<SaveOfferKind, string> = {
  discount: "A lower price for a few payments. The customer approves it on PayPal.",
  pause: "Stop billing for a few months, then resume on the same plan.",
  downgrade: "Move to a cheaper plan. The customer approves it on PayPal.",
  incentive: "Extra features or limits for a while, at no change in price.",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function specSummary(spec: SaveOfferSpec, names: { plan?: (id: string) => string; incentive?: (id: string) => string } = {}) {
  switch (spec.kind) {
    case "discount":
      return `${spec.percent}% off for ${plural(spec.cycles, "payment")}`;
    case "pause":
      return `Pause for ${plural(spec.months, "month")}`;
    case "downgrade":
      return `Switch to ${names.plan?.(spec.plan) ?? spec.plan}`;
    case "incentive":
      return `${names.incentive?.(spec.incentive) ?? spec.incentive} for ${plural(spec.months, "month")}`;
  }
}

export const OUTCOMES: Record<CancelSessionRecord["status"], { label: string; color: BadgeColor }> = {
  open: { label: "In progress", color: "blue" },
  saved: { label: "Saved", color: "green" },
  cancelled: { label: "Cancelled", color: "red" },
  abandoned: { label: "Closed", color: "gray" },
};

export const percent = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${Math.round(n * 100)}%`);
