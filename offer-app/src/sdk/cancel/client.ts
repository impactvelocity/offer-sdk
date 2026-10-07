import { OfferApiError } from "../client";
import type { CancelConfig, CancelSession, CancelTransport } from "./types";

/** Talks to the Offer API's cancel-session routes with an account token. */
export class CancelClient implements CancelTransport {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CancelConfig) {
    this.base = `${config.apiUrl.replace(/\/+$/, "")}/apps/${encodeURIComponent(config.appId)}/cancel-sessions`;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request(path: string, body?: unknown): Promise<CancelSession> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (json as { error?: string } | undefined)?.error ?? `Request failed with status ${res.status}`;
      throw new OfferApiError(res.status, message, json);
    }
    return json as CancelSession;
  }

  /** Starts a session on the app's active flow, or on `flow`. */
  start(flow?: string | null) {
    return this.request("", flow ? { flow } : {});
  }

  get(sessionId: string) {
    return this.request(`/${encodeURIComponent(sessionId)}`);
  }

  answer(sessionId: string, body: { step: string; answer?: string | null; text?: string | null }) {
    return this.request(`/${encodeURIComponent(sessionId)}/answer`, body);
  }

  back(sessionId: string) {
    return this.request(`/${encodeURIComponent(sessionId)}/back`, {});
  }

  decline(sessionId: string) {
    return this.request(`/${encodeURIComponent(sessionId)}/decline`, {});
  }

  /** Discounts and downgrades come back with `approve_url` (PayPal). */
  accept(sessionId: string, urls: { return_url?: string; cancel_url?: string } = {}) {
    return this.request(`/${encodeURIComponent(sessionId)}/accept`, urls);
  }

  cancel(sessionId: string) {
    return this.request(`/${encodeURIComponent(sessionId)}/cancel`, {});
  }

  close(sessionId: string) {
    return this.request(`/${encodeURIComponent(sessionId)}/close`, {});
  }
}
