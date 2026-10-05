"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { OfferClient } from "./client";
import type { OfferClientOptions } from "./types";

export interface OfferContextValue {
  client: OfferClient;
}

const OfferContext = createContext<OfferContextValue | null>(null);

export interface OfferProviderProps extends OfferClientOptions {
  children: ReactNode;
  /** Supply a preconfigured client instead of building one from options. */
  client?: OfferClient;
}

export function OfferProvider({ children, client, apiKey, baseUrl, fetch }: OfferProviderProps) {
  const value = useMemo<OfferContextValue>(
    () => ({ client: client ?? new OfferClient({ apiKey, baseUrl, fetch }) }),
    [client, apiKey, baseUrl, fetch],
  );

  return <OfferContext.Provider value={value}>{children}</OfferContext.Provider>;
}

export function useOfferContext(): OfferContextValue {
  const ctx = useContext(OfferContext);
  if (!ctx) throw new Error("useOfferContext must be used within an <OfferProvider>");
  return ctx;
}

export function useOfferClient(): OfferClient {
  return useOfferContext().client;
}
