import type { Offer, OfferClientOptions } from "./types";

/** Empty string = same origin (used by the hosted app). External sites pass the deployed URL. */
export const DEFAULT_BASE_URL = "";

export class OfferApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "OfferApiError";
  }
}

export class OfferClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OfferClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const body: unknown = await res.json().catch(() => undefined);

    if (!res.ok) {
      const message =
        (body as { error?: string } | undefined)?.error ?? `Request failed with status ${res.status}`;
      throw new OfferApiError(res.status, message, body);
    }

    return body as T;
  }

  async listOffers(init?: RequestInit): Promise<Offer[]> {
    const { data } = await this.request<{ data: Offer[] }>("/api/v1/offers", init);
    return data;
  }

  async getOffer(id: string, init?: RequestInit): Promise<Offer> {
    const { data } = await this.request<{ data: Offer }>(`/api/v1/offers/${encodeURIComponent(id)}`, init);
    return data;
  }
}
