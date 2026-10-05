"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckoutClient } from "./client";
import { availableBumps, initialSelection, normalize, type Selection, type Summary, summarize } from "./state";
import type { Checkout, CheckoutConfig, Interval, OfferBump, PublicOffer } from "./types";

export type CheckoutPhase = "idle" | "starting" | "approving" | "confirming" | "completed" | "failed";

export interface OfferContextValue {
  offer: PublicOffer | null;
  isLoading: boolean;
  error: Error | null;
  selection: Selection;
  summary: Summary | null;
  bumps: OfferBump[];
  selectPlan(planId: string): void;
  setInterval(interval: Interval): void;
  toggleBump(bumpId: string, on?: boolean): void;
  /** The buyer's account id, when the page knows it. */
  account: string | null;
  /** The buyer's email; collected on the page when there is no account. */
  email: string;
  setEmail(email: string): void;
  phase: CheckoutPhase;
  checkout: Checkout | null;
  checkoutError: string | null;
  /** Creates the checkout on the server. Used by <Offer.Checkout>; call it yourself for a custom button. */
  startCheckout(): Promise<Checkout>;
  /** After PayPal approval: confirms payment with the API, retrying while PayPal activates. */
  confirm(): Promise<Checkout | null>;
  /** Sends the buyer to PayPal's own page instead of the popup, and confirms when they return. */
  redirectToPaypal(): Promise<void>;
  cancel(): void;
  fail(error: unknown): void;
  client: CheckoutClient;
}

const OfferContext = createContext<OfferContextValue | null>(null);

export interface OfferProviderProps extends CheckoutConfig {
  /** The offer to sell, e.g. from `?offer=` in the URL. Falls back to `fallback`, then regular prices. */
  offerId?: string | null;
  fallback?: string | null;
  /** Fetched on the server with `getOffer()`, so the page renders with prices. */
  initialOffer?: PublicOffer;
  /** The signed-in buyer's account id. Without it the buyer enters an email. */
  account?: string | null;
  email?: string | null;
  /** Who sent the buyer (affiliate, campaign). Saved on the checkout and in webhooks. */
  refCode?: string | null;
  /** Preselected plan and interval, e.g. from an upgrade link. */
  plan?: string | null;
  interval?: Interval | null;
  onSuccess?(checkout: Checkout): void;
  children: ReactNode;
}

const STORAGE_KEY = "offer-checkout:pending";
const CONFIRM_ATTEMPTS = 20;
const CONFIRM_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function OfferProvider({
  apiUrl,
  appId,
  publishableKey,
  fetch,
  offerId,
  fallback,
  initialOffer,
  account = null,
  email: initialEmail,
  refCode,
  plan,
  interval,
  onSuccess,
  children,
}: OfferProviderProps) {
  const client = useMemo(
    () => new CheckoutClient({ apiUrl, appId, publishableKey, fetch }),
    [apiUrl, appId, publishableKey, fetch],
  );

  // Offers fetched in the browser, keyed by what was asked for (loading is derived, not stored).
  const fetchKey = JSON.stringify([offerId ?? null, fallback ?? null, account, refCode ?? null]);
  const [fetched, setFetched] = useState<{ key: string; offer?: PublicOffer; error?: Error }>();
  const current = fetched?.key === fetchKey ? fetched : undefined;
  const offer = initialOffer ?? current?.offer ?? null;
  const isLoading = !initialOffer && !current;
  const error = initialOffer ? null : (current?.error ?? null);

  const [selection, setSelection] = useState<Selection>(() =>
    initialOffer ? initialSelection(initialOffer, { plan, interval }) : { plan: plan ?? null, interval: interval ?? null, bumps: [] },
  );
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Callbacks handed to PayPal outlive renders; they read the latest state here.
  const latest = useRef({ offer, selection, email, checkout });
  const onSuccessRef = useRef(onSuccess);
  useLayoutEffect(() => {
    latest.current = { offer, selection, email, checkout };
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (initialOffer) return;
    const controller = new AbortController();
    client.getOffer(offerId, { fallback, account, ref: refCode }, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return;
        setFetched({ key: fetchKey, offer: data });
        setSelection((sel) => initialSelection(data, { plan: sel.plan, interval: sel.interval }));
      },
      (err: unknown) => {
        if (!controller.signal.aborted) setFetched({ key: fetchKey, error: err instanceof Error ? err : new Error(message(err)) });
      },
    );
    return () => controller.abort();
  }, [client, initialOffer, fetchKey, offerId, fallback, account, refCode]);

  const update = useCallback((fn: (sel: Selection) => Selection) => {
    setSelection((sel) => (latest.current.offer ? normalize(latest.current.offer, fn(sel)) : fn(sel)));
  }, []);

  const selectPlan = useCallback((planId: string) => update((sel) => ({ ...sel, plan: planId })), [update]);
  const setInterval = useCallback((next: Interval) => update((sel) => ({ ...sel, interval: next })), [update]);
  const toggleBump = useCallback(
    (bumpId: string, on?: boolean) =>
      update((sel) => {
        const has = sel.bumps.includes(bumpId);
        const want = on ?? !has;
        return { ...sel, bumps: want ? (has ? sel.bumps : [...sel.bumps, bumpId]) : sel.bumps.filter((b) => b !== bumpId) };
      }),
    [update],
  );

  const startCheckout = useCallback(
    async (urls: { return_url?: string; cancel_url?: string } = {}) => {
      const { offer: current, selection: sel, email: currentEmail } = latest.current;
      if (!current || !sel.plan || !sel.interval) throw new Error("Pick a plan first");
      if (!account && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
        const err = new Error("Enter your email to continue");
        setCheckoutError(err.message);
        throw err;
      }
      setPhase("starting");
      setCheckoutError(null);
      try {
        const row = await client.startCheckout(current.id, {
          plan: sel.plan,
          interval: sel.interval,
          bumps: sel.bumps,
          account,
          email: account ? null : currentEmail,
          ref: refCode,
          ...urls,
        });
        setCheckout(row);
        latest.current.checkout = row;
        setPhase("approving");
        return row;
      } catch (err) {
        setPhase("failed");
        setCheckoutError(message(err));
        throw err;
      }
    },
    [client, account, refCode],
  );

  const confirmById = useCallback(
    async (checkoutId: string) => {
      setPhase("confirming");
      try {
        for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
          const row = await client.completeCheckout(checkoutId);
          setCheckout(row);
          if (row.status === "completed") {
            setPhase("completed");
            onSuccessRef.current?.(row);
            return row;
          }
          if (row.status !== "created") throw new Error("The payment didn't go through");
          await sleep(CONFIRM_DELAY_MS);
        }
        throw new Error("PayPal is still processing the payment. Refresh in a minute to check again.");
      } catch (err) {
        setPhase("failed");
        setCheckoutError(message(err));
        return null;
      }
    },
    [client],
  );

  const confirm = useCallback(async () => {
    const current = latest.current.checkout;
    return current ? confirmById(current.id) : null;
  }, [confirmById]);

  // Redirect flow: remember the checkout, send the buyer to PayPal, confirm on return.
  const redirectToPaypal = useCallback(async () => {
    const back = new URL(window.location.href);
    back.searchParams.set("offer_checkout", "return");
    const cancelled = new URL(window.location.href);
    cancelled.searchParams.set("offer_checkout", "cancel");
    const row = await startCheckout({ return_url: back.toString(), cancel_url: cancelled.toString() });
    if (!row.approve_url) throw new Error("PayPal didn't return an approval link");
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ appId, checkoutId: row.id }));
    } catch {
      // Storage blocked: the PayPal webhook still applies the purchase.
    }
    window.location.assign(row.approve_url);
  }, [appId, startCheckout]);

  // Back from PayPal's page: confirm the checkout saved before leaving. Runs in
  // a timer so a StrictMode double effect doesn't consume the return twice.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const outcome = params.get("offer_checkout");
      if (!outcome) return;
      let pending: { appId: string; checkoutId: string } | null = null;
      try {
        pending = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        pending = null;
      }
      params.delete("offer_checkout");
      for (const key of ["token", "subscription_id", "ba_token", "PayerID"]) params.delete(key);
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
      if (outcome === "return" && pending?.appId === appId) void confirmById(pending.checkoutId);
    }, 0);
    return () => clearTimeout(timer);
  }, [appId, confirmById]);

  const cancel = useCallback(() => {
    setPhase("idle");
    setCheckoutError(null);
  }, []);
  const fail = useCallback((err: unknown) => {
    setPhase("failed");
    setCheckoutError(message(err) || "PayPal couldn't complete the payment");
  }, []);

  const value = useMemo<OfferContextValue>(
    () => ({
      offer,
      isLoading,
      error,
      selection,
      summary: offer ? summarize(offer, selection) : null,
      bumps: offer ? availableBumps(offer, selection) : [],
      selectPlan,
      setInterval,
      toggleBump,
      account,
      email,
      setEmail,
      phase,
      checkout,
      checkoutError,
      startCheckout: () => startCheckout(),
      confirm,
      redirectToPaypal,
      cancel,
      fail,
      client,
    }),
    [
      offer,
      isLoading,
      error,
      selection,
      selectPlan,
      setInterval,
      toggleBump,
      account,
      email,
      phase,
      checkout,
      checkoutError,
      startCheckout,
      confirm,
      redirectToPaypal,
      cancel,
      fail,
      client,
    ],
  );

  return <OfferContext.Provider value={value}>{children}</OfferContext.Provider>;
}

/** Everything <OfferProvider> knows, for building a fully custom checkout. */
export function useOffer(): OfferContextValue {
  const ctx = useContext(OfferContext);
  if (!ctx) throw new Error("useOffer must be used within an <OfferProvider> from the checkout SDK");
  return ctx;
}
