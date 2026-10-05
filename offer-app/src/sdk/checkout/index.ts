// Checkout SDK: a separate entry point so apps that only check entitlements
// never load PayPal. Design one checkout page, then sell any offer on it by id:
//
//   <OfferProvider apiUrl appId publishableKey offerId={searchParams.offer} refCode={searchParams.ref}>
//     <Offer.Headline /> <Offer.IntervalToggle />
//     <Offer.Plans>{(plan) => <Offer.Plan plan={plan} />}</Offer.Plans>
//     <Offer.Bumps>{(bump) => <Offer.Bump bump={bump} />}</Offer.Bumps>
//     <Offer.Summary /> <Offer.Email /> <Offer.Checkout onSuccess={…} />
//   </OfferProvider>
export { CheckoutClient, getOffer } from "./client";
export { Offer, type BumpRenderProps, type PlanRenderProps } from "./components";
export { OfferProvider, useOffer, type CheckoutPhase, type OfferContextValue, type OfferProviderProps } from "./provider";
export {
  availableBumps,
  formatMoney,
  INTERVAL_LABELS,
  initialSelection,
  normalize,
  planPrice,
  plansFor,
  priceLabel,
  renewalLabel,
  savings,
  summarize,
  type Selection,
  type Summary,
} from "./state";
export type { Checkout, CheckoutConfig, Interval, OfferBump, OfferPlan, OfferPrice, PublicOffer, Unavailable } from "./types";
