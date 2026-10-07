"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CancelClient } from "./client";
import type { CancelConfig, CancelSession, CancelStep, CancelTransport, SaveOffer } from "./types";

export type CancelPhase = "idle" | "loading" | "ready" | "working" | "redirecting";

export interface CancelFlowContextValue {
  isOpen: boolean;
  phase: CancelPhase;
  session: CancelSession | null;
  step: CancelStep | null;
  offer: SaveOffer | null;
  error: string | null;
  /** The answer picked on the current question step, and its optional detail. */
  choice: string | null;
  text: string;
  choose(answerId: string): void;
  setText(text: string): void;
  /** Opens the flow, starting a session if there isn't one running. */
  open(): Promise<void>;
  /** Closes the flow; an unfinished session counts as abandoned. */
  close(): void;
  /** Sends the current question's choice (or text step's text) and moves on. */
  submit(): Promise<void>;
  back(): Promise<void>;
  /** Accepts the save offer. Discounts and downgrades then open PayPal to approve the new price. */
  accept(): Promise<void>;
  decline(): Promise<void>;
  /** The confirm step: actually cancels. */
  confirmCancel(): Promise<void>;
}

const CancelFlowContext = createContext<CancelFlowContextValue | null>(null);

export interface CancelFlowProviderProps extends Partial<CancelConfig> {
  /** A specific flow; defaults to the app's active one. */
  flow?: string | null;
  /** Replaces the API client, e.g. to preview a flow without a session. */
  transport?: CancelTransport;
  /** Where PayPal sends the customer after approving a new price. Defaults to this page. */
  returnUrl?: string;
  /** How to open PayPal's approval page: this tab (default), a new tab, or not at all (read `session.approve_url`). */
  paypal?: "redirect" | "new-tab" | "manual";
  onSaved?(session: CancelSession): void;
  onCancelled?(session: CancelSession): void;
  onClose?(session: CancelSession | null): void;
  children: ReactNode;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function CancelFlowProvider({
  apiUrl,
  appId,
  token,
  fetch,
  flow,
  transport,
  returnUrl,
  paypal = "redirect",
  onSaved,
  onCancelled,
  onClose,
  children,
}: CancelFlowProviderProps) {
  const client = useMemo<CancelTransport>(() => {
    if (transport) return transport;
    if (!apiUrl || !appId || !token) throw new Error("CancelFlowProvider needs apiUrl, appId and token (or a transport)");
    return new CancelClient({ apiUrl, appId, token, fetch });
  }, [transport, apiUrl, appId, token, fetch]);

  const [isOpen, setOpen] = useState(false);
  const [phase, setPhase] = useState<CancelPhase>("idle");
  const [session, setSession] = useState<CancelSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");

  const callbacks = useRef({ onSaved, onCancelled, onClose });
  const current = useRef(session);
  useLayoutEffect(() => {
    callbacks.current = { onSaved, onCancelled, onClose };
    current.current = session;
  });

  // Runs one call, keeping the choice/text when the step didn't change.
  const run = useCallback(async (fn: () => Promise<CancelSession>, busy: CancelPhase = "working") => {
    setPhase(busy);
    setError(null);
    try {
      const next = await fn();
      if (next.step?.id !== current.current?.step?.id) {
        setChoice(null);
        setText("");
      }
      current.current = next;
      setSession(next);
      setPhase("ready");
      return next;
    } catch (err) {
      setError(message(err));
      setPhase(current.current ? "ready" : "idle");
      return null;
    }
  }, []);

  const open = useCallback(async () => {
    setOpen(true);
    if (current.current?.status === "open") return;
    current.current = null;
    setSession(null);
    await run(() => client.start(flow), "loading");
  }, [client, flow, run]);

  const close = useCallback(() => {
    const s = current.current;
    setOpen(false);
    if (s?.status === "open") client.close(s.id).catch(() => {});
    callbacks.current.onClose?.(s);
    current.current = null;
    setSession(null);
    setPhase("idle");
    setError(null);
  }, [client]);

  const withSession = useCallback(
    (fn: (s: CancelSession) => Promise<CancelSession>) => {
      const s = current.current;
      return s ? run(() => fn(s)) : Promise.resolve(null);
    },
    [run],
  );

  const submit = useCallback(async () => {
    const step = current.current?.step;
    if (!step || (step.type !== "question" && step.type !== "text")) return;
    if (step.type === "question" && !choice) {
      setError("Pick an answer to continue");
      return;
    }
    await withSession((s) =>
      client.answer(s.id, { step: step.id, answer: step.type === "question" ? choice : null, text: text.trim() || null }),
    );
  }, [client, choice, text, withSession]);

  const accept = useCallback(async () => {
    const back = returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined);
    const next = await withSession((s) => client.accept(s.id, back ? { return_url: back, cancel_url: back } : {}));
    if (!next) return;
    callbacks.current.onSaved?.(next);
    if (next.approve_url && paypal !== "manual" && typeof window !== "undefined") {
      if (paypal === "new-tab") window.open(next.approve_url, "_blank", "noopener");
      else {
        setPhase("redirecting");
        window.location.assign(next.approve_url);
      }
    }
  }, [client, paypal, returnUrl, withSession]);

  const confirmCancel = useCallback(async () => {
    const next = await withSession((s) => client.cancel(s.id));
    if (next) callbacks.current.onCancelled?.(next);
  }, [client, withSession]);

  const back = useCallback(async () => void (await withSession((s) => client.back(s.id))), [client, withSession]);
  const decline = useCallback(async () => void (await withSession((s) => client.decline(s.id))), [client, withSession]);
  const choose = useCallback((answerId: string) => {
    setChoice(answerId);
    setError(null);
  }, []);

  const value: CancelFlowContextValue = {
    isOpen,
    phase,
    session,
    step: session?.step ?? null,
    offer: session?.offer ?? null,
    error,
    choice,
    text,
    choose,
    setText,
    open,
    close,
    submit,
    back,
    accept,
    decline,
    confirmCancel,
  };

  return <CancelFlowContext.Provider value={value}>{children}</CancelFlowContext.Provider>;
}

export function useCancelFlow(): CancelFlowContextValue {
  const ctx = useContext(CancelFlowContext);
  if (!ctx) throw new Error("useCancelFlow must be used inside <CancelFlowProvider>");
  return ctx;
}
