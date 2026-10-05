export interface Offer {
  id: string;
  title: string;
  description: string;
  active: boolean;
}

export interface OfferClientOptions {
  /** Publishable key identifying the site/project. */
  apiKey?: string;
  /** Base URL of the deployed offer-app. Defaults to same origin. */
  baseUrl?: string;
  /** Custom fetch implementation (tests, SSR, polyfills). */
  fetch?: typeof fetch;
}
