export type Interval = "month" | "year" | "once";

export interface OfferPrice {
  amount: number;
  /** The plan's regular price, shown struck through when `amount` is lower. */
  list_price: number | null;
  /** Billing periods at `amount` before `then` applies; null when the price never changes. */
  cycles: number | null;
  then: number | null;
}

export interface OfferPlan {
  id: string;
  name: string;
  description: string | null;
  featured: boolean;
  benefits: { id: string; title: string }[];
  prices: Partial<Record<Interval, OfferPrice>>;
  /** Entitlements the offer adds or raises on top of the plan. */
  extras: { id: string; name: string; max: number | null }[];
  extra_addons: { id: string; name: string }[];
}

export interface OfferBump {
  id: string;
  label: string;
  description: string | null;
  amount: number;
  applies_to: { plans?: string[]; intervals?: Interval[] } | null;
  addons: { id: string; name: string }[];
}

export type Unavailable = "not_found" | "draft" | "archived" | "expired" | "sold_out" | "not_eligible";

/** What `GET /apps/:appId/offers/:offerId/public` returns. */
export interface PublicOffer {
  id: string;
  name: string;
  type: "shareable" | "targeted";
  expires_at: string | null;
  currency: string;
  copy: { headline?: string; subhead?: string; cta?: string; bullets?: string[] };
  intervals: Interval[];
  default_plan: string | null;
  default_interval: Interval | null;
  plans: OfferPlan[];
  bumps: OfferBump[];
  /** Whether this is the offer asked for, the page's fallback, or the app's regular prices. */
  resolved_from: "requested" | "fallback" | "default";
  /** Why the requested offer wasn't used, when it wasn't. */
  requested: { id: string; reason: Unavailable } | null;
  paypal: { client_id: string; env: "sandbox" | "live" } | null;
}

export interface Checkout {
  id: string;
  offer_id: string | null;
  plan_id: string;
  interval: Interval;
  bumps: string[];
  account_id: string | null;
  email: string | null;
  ref: string | null;
  status: "created" | "completed" | "expired" | "failed" | "cancelled";
  currency: string;
  total_today: number;
  paypal: { kind: "subscription" | "order"; id: string } | null;
  approve_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CheckoutConfig {
  /** The Offer API's public URL. */
  apiUrl: string;
  appId: string;
  /** The app's publishable key (`pub_…`). Safe to ship to browsers. */
  publishableKey: string;
  fetch?: typeof fetch;
}
