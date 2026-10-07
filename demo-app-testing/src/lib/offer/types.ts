// Shapes the Offer API returns, as far as the blog reads them.

export interface Namespace {
  id: string;
  name?: string;
  plan: string;
  incentive: string | null;
  incentive_expires_at?: string | null;
  addons?: string[];
  subscription?: Subscription | null;
  created_at: string;
}

export interface Subscription {
  provider: string;
  provider_id: string;
  status: string;
  plan_id?: string;
  interval: "month" | "year" | "once";
  price: number;
  offer_id?: string | null;
  offer_name?: string | null;
  renews_at?: string | null;
}

export interface PlanEntitlement {
  id: string;
  name: string;
  type: "usage" | "boolean";
  usage: number;
  max: number | null;
  left: number | null;
  can: boolean;
}

export interface NamespacePlan {
  plan: { id: string; name: string; description: string | null; isFree: boolean; meta: Record<string, unknown> };
  incentive: string | null;
  offer: string | null;
  addons: string[];
  entitlements: PlanEntitlement[];
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  isFree: boolean;
  pricingCard: { title: string; monthlyPrice?: number; yearlyPrice?: number; currency?: string; featured?: boolean } | null;
  entitlements: { id: string; max?: number | null }[];
  addons: string[];
}

export interface Entitlement {
  id: string;
  type: "usage" | "boolean";
  name: string;
  description?: string;
  overage?: { mode: "allow" | "block"; offer_id?: string } | null;
}

export interface Addon {
  id: string;
  name: string;
  description?: string;
}

export interface Incentive {
  id: string;
  name: string;
  description?: string;
  entitlements: { id: string; max?: number | null }[];
  addons: string[];
}

export interface OfferDoc {
  id: string;
  name: string;
  type: "shareable" | "targeted";
  account_id?: string;
  status: "draft" | "active" | "archived";
  source: string;
  discount: { percent?: number; amount_off?: number; cycles?: number } | null;
  plans: { plan_id: string }[];
  bumps: { id: string; label: string }[];
  redemptions?: number;
  availability?: string;
  expires_at: string | null;
  created_at: string;
}

export interface LimitReached {
  error: "limit_reached";
  message: string;
  entitlement: { id: string; name: string; usage: number; max: number };
  offer: {
    id: string;
    name: string | null;
    plan: { id: string; name: string };
    interval: string;
    price: number;
    currency: string;
    new_limit: number | null;
    checkout_url: string | null;
  } | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  description?: string | null;
}

export interface Delivery {
  id: string;
  event_id: string;
  event_type?: string;
  status: string;
  attempts: number;
  response_status?: number | null;
  created_at: string;
}
