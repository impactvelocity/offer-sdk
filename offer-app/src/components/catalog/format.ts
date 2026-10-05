import type { PricingCard } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function formatLimit(max: number | null | undefined) {
  return max === null || max === undefined ? "Unlimited" : formatNumber(max);
}

/** "$29/mo", "$199 once", "Free" or null when there's no pricing card. */
export function formatPrice(card: PricingCard | null | undefined, isFree?: boolean): string | null {
  if (!card) return isFree ? "Free" : null;
  if (card.type === "one_time") return card.price != null ? `${formatCurrency(card.price, card.currency)} once` : null;
  if (card.monthlyPrice != null) return card.monthlyPrice === 0 ? "Free" : `${formatCurrency(card.monthlyPrice, card.currency)}/mo`;
  if (card.yearlyPrice != null) return `${formatCurrency(card.yearlyPrice, card.currency)}/yr`;
  return isFree ? "Free" : null;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF", "SEK", "NOK", "DKK", "NZD", "SGD", "ZAR"];
