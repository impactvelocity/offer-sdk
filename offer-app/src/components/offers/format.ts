import type { BadgeColor } from "@/components/ui/badge";
import type { App, Offer, OfferInterval } from "@/lib/api/types";
import { formatCurrency } from "@/lib/utils";

export const INTERVAL_NAMES: Record<OfferInterval, string> = { month: "Monthly", year: "Yearly", once: "Lifetime" };

/** What a buyer would see right now: draft, live, ended, sold out or archived. */
export function offerState(offer: Offer): { label: string; color: BadgeColor; live: boolean } {
  if (offer.status === "draft") return { label: "Draft", color: "gray", live: false };
  if (offer.status === "archived") return { label: "Archived", color: "gray", live: false };
  if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) return { label: "Ended", color: "orange", live: false };
  if (offer.max_redemptions && (offer.redemptions ?? 0) >= offer.max_redemptions) {
    return { label: "Sold out", color: "yellow", live: false };
  }
  return { label: "Live", color: "green", live: true };
}

/** "50% off for 3 cycles", "$5 off", "Custom prices". */
export function discountSummary(offer: Pick<Offer, "discount" | "plans" | "currency">): string {
  const d = offer.discount;
  if (!d) return offer.plans.some((p) => p.prices && Object.keys(p.prices).length) ? "Custom prices" : "List prices";
  const amount = d.percent !== undefined ? `${d.percent}% off` : `${formatCurrency(d.amount_off ?? 0, offer.currency)} off`;
  return d.cycles ? `${amount} for ${d.cycles} ${d.cycles === 1 ? "cycle" : "cycles"}` : amount;
}

export function extrasForLabel(value: string): string {
  if (value === "subscription") return "While subscribed";
  if (value === "discount") return "During the discount";
  const months = value.match(/^P(\d+)M$/)?.[1];
  if (months) return `For ${months} month${months === "1" ? "" : "s"}`;
  const years = value.match(/^P(\d+)Y$/)?.[1];
  return years ? `For ${years} year${years === "1" ? "" : "s"}` : value;
}

/**
 * A link to the app's checkout page selling this offer. Uses the app's own
 * checkout page when it has one, else the dashboard's demo storefront.
 */
export function offerLink(app: Pick<App, "id" | "public_key" | "checkout_url">, offerId: string, ref?: string, origin = "") {
  let url: URL;
  if (app.checkout_url) {
    url = new URL(app.checkout_url);
  } else {
    url = new URL("/demo/checkout", origin || "http://localhost");
    url.searchParams.set("app", app.id);
    url.searchParams.set("key", app.public_key);
  }
  url.searchParams.set("offer", offerId);
  if (ref?.trim()) url.searchParams.set("ref", ref.trim());
  return url.toString();
}

/** A link to the checkout page selling one plan at its list price (the default offer). */
export function planLink(app: Pick<App, "id" | "public_key" | "checkout_url">, planId: string, origin = "") {
  const url = new URL(offerLink(app, "default", undefined, origin));
  url.searchParams.set("plan", planId);
  return url.toString();
}
