import { OfferApiError } from "../client";
import type { Checkout, CheckoutConfig, Interval, PublicOffer } from "./types";

/** Talks to the Offer API's checkout routes with the publishable key. */
export class CheckoutClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CheckoutConfig) {
    this.base = `${config.apiUrl.replace(/\/+$/, "")}/apps/${encodeURIComponent(config.appId)}`;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get appId() {
    return this.config.appId;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.config.publishableKey}`);
    if (init.body) headers.set("Content-Type", "application/json");

    const res = await this.fetchImpl(`${this.base}${path}`, { ...init, headers });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (body as { error?: string } | undefined)?.error ?? `Request failed with status ${res.status}`;
      throw new OfferApiError(res.status, message, body);
    }
    return body as T;
  }

  /**
   * The offer to show: `offerId` if it can be bought, else `fallback`, else the
   * app's regular prices. Never fails for an unknown or expired offer.
   */
  getOffer(
    offerId: string | null | undefined,
    params: { fallback?: string | null; account?: string | null; ref?: string | null } = {},
    init?: RequestInit,
  ): Promise<PublicOffer> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    const qs = query.size ? `?${query}` : "";
    return this.request(`/offers/${encodeURIComponent(offerId || "default")}/public${qs}`, init);
  }

  /** Prices the selection on the server and creates the PayPal subscription or order. */
  startCheckout(
    offerId: string,
    body: {
      plan: string;
      interval: Interval;
      bumps: string[];
      account?: string | null;
      email?: string | null;
      ref?: string | null;
      return_url?: string;
      cancel_url?: string;
    },
  ): Promise<Checkout> {
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null && v !== undefined));
    return this.request(`/offers/${encodeURIComponent(offerId)}/checkout`, { method: "POST", body: JSON.stringify(clean) });
  }

  /** Checks the payment with PayPal and applies it. `status` stays "created" while PayPal is still activating. */
  completeCheckout(checkoutId: string): Promise<Checkout> {
    return this.request(`/checkouts/${encodeURIComponent(checkoutId)}/complete`, { method: "POST" });
  }

  getCheckout(checkoutId: string): Promise<Checkout> {
    return this.request(`/checkouts/${encodeURIComponent(checkoutId)}`);
  }
}

/**
 * Server helper: fetch the offer before rendering (Next.js server components),
 * then pass it to `<OfferProvider initialOffer>` so the page renders with prices.
 */
export function getOffer(
  config: CheckoutConfig & { offerId?: string | null; fallback?: string | null; account?: string | null; ref?: string | null },
  init?: RequestInit,
): Promise<PublicOffer> {
  const { offerId, fallback, account, ref, ...rest } = config;
  return new CheckoutClient(rest).getOffer(offerId, { fallback, account, ref }, { cache: "no-store", ...init });
}
