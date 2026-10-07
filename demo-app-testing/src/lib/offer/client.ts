import "server-only";
import { OfferApiError, OfferClient } from "@offer/sdk";
import { cache } from "react";
import { redirect } from "next/navigation";
import { OFFER_API_URL, offerConfig, type OfferConfig } from "./config";

// Every server-side call to the Offer API goes through the SDK's OfferClient
// (its generic `request`), with a fetch that records each call for the
// "development.log" panel at the bottom of the page.

export interface LogEntry {
  method: string;
  path: string;
  status: number | "ERR";
  ms: number;
  key: "secret" | "public" | "admin" | "none";
}

/** Calls made while rendering this request (React's per-request cache). */
export const requestLog = cache((): LogEntry[] => []);

function keyKind(auth: string | null): LogEntry["key"] {
  if (!auth) return "none";
  if (auth.includes("key_")) return "secret";
  if (auth.includes("pub_")) return "public";
  return "admin";
}

export const loggingFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const started = performance.now();
  const entry: Omit<LogEntry, "status" | "ms"> = {
    method: init?.method ?? "GET",
    path: url.pathname + url.search,
    key: keyKind(new Headers(init?.headers).get("Authorization")),
  };
  try {
    const res = await fetch(input, { ...init, cache: "no-store" });
    requestLog().push({ ...entry, status: res.status, ms: Math.round(performance.now() - started) });
    return res;
  } catch (err) {
    requestLog().push({ ...entry, status: "ERR", ms: Math.round(performance.now() - started) });
    throw err;
  }
};

export const clientFor = (apiKey?: string, fetchImpl: typeof fetch = loggingFetch) =>
  new OfferClient({ baseUrl: OFFER_API_URL, apiKey, fetch: fetchImpl });

export type Body = Record<string, unknown> | unknown[];

/** Thin REST helpers scoped to one app, on top of `OfferClient.request`. */
export function appApi(config: OfferConfig, apiKey = config.secretKey, fetchImpl?: typeof fetch) {
  const client = clientFor(apiKey, fetchImpl);
  const path = (p: string) => `/apps/${encodeURIComponent(config.appId)}${p}`;
  const send = (method: string) => <T = unknown>(p: string, body?: Body) =>
    client.request<T>(path(p), { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    config,
    client,
    get: <T = unknown>(p: string) => client.request<T>(path(p)),
    post: send("POST"),
    put: send("PUT"),
    patch: send("PATCH"),
    del: send("DELETE"),
  };
}

export type AppApi = ReturnType<typeof appApi>;

/** The app's API with its secret key; sends you to /setup when the blog isn't connected yet. */
export async function offerApi(): Promise<AppApi> {
  const config = await offerConfig();
  if (!config) redirect("/setup");
  return appApi(config);
}

export const isStatus = (err: unknown, status: number): err is OfferApiError =>
  err instanceof OfferApiError && err.status === status;

export { OfferApiError };
