"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { type CancelFlowContextValue, useCancelFlow } from "./provider";
import type { CancelSession, ConfirmStep, OfferStep, QuestionStep, SaveOffer, TextStep } from "./types";

// Headless pieces of a cancel flow. Each renders plain markup with `data-*`
// attributes for state (data-selected, data-phase, data-kind…) so the app
// styles them; pass `children` as a function to render your own markup.
// The quickest integration is:
//
//   <CancelFlowProvider apiUrl appId token={accountToken}>
//     <CancelFlow.Trigger>Cancel subscription</CancelFlow.Trigger>
//     <CancelFlow.Dialog />
//   </CancelFlowProvider>
//
// What the flow asks and offers is set in the dashboard, not in code.

type ClassName = { className?: string };

const formatDate = (iso: unknown) =>
  typeof iso === "string" ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";

/** A button that opens the flow. */
function Trigger({ className, children = "Cancel subscription" }: ClassName & { children?: ReactNode }) {
  const { open, phase } = useCancelFlow();
  return (
    <button type="button" className={className} data-cancel-trigger="" disabled={phase === "loading"} onClick={() => void open()}>
      {children}
    </button>
  );
}

/** A modal <dialog> that shows the flow while it's open. Escape or the backdrop closes it. */
function Dialog({ className, children }: ClassName & { children?: ReactNode }) {
  const { isOpen, close } = useCancelFlow();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
  return (
    <dialog
      ref={ref}
      className={className}
      data-cancel-dialog=""
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      {isOpen ? (children ?? <Steps />) : null}
    </dialog>
  );
}

/** Renders whichever step is current, then the outcome. */
function Steps({ className }: ClassName) {
  const ctx = useCancelFlow();
  const { phase, session, step } = ctx;
  return (
    <div className={className} data-cancel-flow="" data-phase={phase} data-step-type={step?.type ?? session?.status ?? "loading"}>
      <Close />
      {!session && phase === "loading" ? <p data-cancel-loading="">Loading…</p> : null}
      {step?.type === "question" ? <Question /> : null}
      {step?.type === "text" ? <Text /> : null}
      {step?.type === "offer" ? <Offer /> : null}
      {step?.type === "confirm" ? <Confirm /> : null}
      {session && !step ? <Done /> : null}
      <ErrorMessage />
    </div>
  );
}

/** The current question and its answers. */
function Question({
  className,
  children,
}: ClassName & { children?: (step: QuestionStep, ctx: CancelFlowContextValue) => ReactNode }) {
  const ctx = useCancelFlow();
  const { step, choice, choose, text, setText, submit, phase } = ctx;
  if (step?.type !== "question") return null;
  if (children) return <>{children(step, ctx)}</>;
  const picked = step.answers.find((a) => a.id === choice);
  return (
    <form
      className={className}
      data-cancel-step="question"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Progress />
      <h2>{step.title}</h2>
      {step.description ? <p>{step.description}</p> : null}
      <div role="radiogroup" aria-label={step.title} data-cancel-answers="">
        {step.answers.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={choice === a.id}
            data-selected={choice === a.id || undefined}
            onClick={() => choose(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {picked?.text ? (
        <textarea
          data-cancel-text=""
          rows={3}
          maxLength={1000}
          placeholder="Tell us a bit more (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : null}
      <div data-cancel-actions="">
        <Back />
        <button type="submit" data-cancel-primary="" disabled={!choice || phase === "working"}>
          Continue
        </button>
      </div>
    </form>
  );
}

/** A free-text step. */
function Text({ className, children }: ClassName & { children?: (step: TextStep, ctx: CancelFlowContextValue) => ReactNode }) {
  const ctx = useCancelFlow();
  const { step, text, setText, submit, phase } = ctx;
  if (step?.type !== "text") return null;
  if (children) return <>{children(step, ctx)}</>;
  return (
    <form
      className={className}
      data-cancel-step="text"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Progress />
      <h2>{step.title}</h2>
      {step.description ? <p>{step.description}</p> : null}
      <textarea
        data-cancel-text=""
        rows={4}
        maxLength={1000}
        placeholder={step.placeholder ?? undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div data-cancel-actions="">
        <Back />
        <button type="submit" data-cancel-primary="" disabled={(step.required && !text.trim()) || phase === "working"}>
          Continue
        </button>
      </div>
    </form>
  );
}

/** One line about what the offer gives, from its numbers. */
export function offerSummary(offer: SaveOffer): string {
  const d = offer.details;
  const money = (n = 0) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency ?? "USD", minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  switch (offer.kind) {
    case "discount":
      return `${money(d.price)}/${d.interval} for ${d.cycles} ${d.interval}${d.cycles === 1 ? "" : "s"}, then ${money(d.regular_price)}`;
    case "pause":
      return `No charges until ${formatDate(d.resume_at)}`;
    case "downgrade":
      return `${d.plan_name}: ${money(d.price)}/${d.interval} instead of ${money(d.regular_price)}`;
    case "incentive":
      return `${d.incentive_name} free for ${d.months} month${d.months === 1 ? "" : "s"}`;
  }
}

/** The save offer, with accept and decline. */
function Offer({
  className,
  children,
}: ClassName & { children?: (offer: SaveOffer, step: OfferStep, ctx: CancelFlowContextValue) => ReactNode }) {
  const ctx = useCancelFlow();
  const { step, offer, accept, decline, phase } = ctx;
  if (step?.type !== "offer" || !offer) return null;
  if (children) return <>{children(offer, step, ctx)}</>;
  const busy = phase === "working" || phase === "redirecting";
  return (
    <div className={className} data-cancel-step="offer" data-kind={offer.kind} data-source={offer.source}>
      <Progress />
      {step.title ? <p data-cancel-eyebrow="">{step.title}</p> : null}
      <h2>{offer.headline}</h2>
      <p>{offer.body}</p>
      <p data-cancel-offer-summary="">{offerSummary(offer)}</p>
      {offer.kind === "discount" || offer.kind === "downgrade" ? (
        <p data-cancel-note="">You&apos;ll confirm the new price on PayPal.</p>
      ) : null}
      <div data-cancel-actions="">
        <button type="button" data-cancel-primary="" disabled={busy} onClick={() => void accept()}>
          {phase === "redirecting" ? "Opening PayPal…" : offer.cta}
        </button>
        <button type="button" data-cancel-secondary="" disabled={busy} onClick={() => void decline()}>
          {step.decline_label ?? "No thanks, continue cancelling"}
        </button>
      </div>
      <Back />
    </div>
  );
}

/** The last step: cancel for real. */
function Confirm({
  className,
  children,
}: ClassName & { children?: (step: ConfirmStep, ctx: CancelFlowContextValue) => ReactNode }) {
  const ctx = useCancelFlow();
  const { step, confirmCancel, close, phase } = ctx;
  if (step?.type !== "confirm") return null;
  if (children) return <>{children(step, ctx)}</>;
  return (
    <div className={className} data-cancel-step="confirm">
      <Progress />
      <h2>{step.title}</h2>
      {step.description ? <p>{step.description}</p> : null}
      <div data-cancel-actions="">
        <button type="button" data-cancel-danger="" disabled={phase === "working"} onClick={() => void confirmCancel()}>
          {step.cta ?? "Cancel subscription"}
        </button>
        <button type="button" data-cancel-secondary="" onClick={close}>
          Keep my subscription
        </button>
      </div>
      <Back />
    </div>
  );
}

function doneCopy(session: CancelSession): { title: string; body: string } {
  if (session.status === "cancelled") {
    return { title: "Your subscription is cancelled", body: "Thanks for giving us a try. You can come back any time." };
  }
  const offer = session.offer;
  const d = offer?.details ?? {};
  switch (offer?.kind) {
    case "pause":
      return { title: "Your subscription is paused", body: `Billing restarts on ${formatDate(d.resume_at)}. Your account and data stay as they are.` };
    case "discount":
    case "downgrade":
      return session.approve_url
        ? { title: "One more step", body: "Approve the new price on PayPal to finish." }
        : { title: "Thanks for staying", body: "Your new price applies from your next bill." };
    case "incentive":
      return { title: "It's yours", body: `${d.incentive_name} is on your account until ${formatDate(d.ends_at)}.` };
    default:
      return { title: "Thanks for staying", body: "" };
  }
}

/** What happened: saved (with the offer) or cancelled. */
function Done({ className, children }: ClassName & { children?: (session: CancelSession, ctx: CancelFlowContextValue) => ReactNode }) {
  const ctx = useCancelFlow();
  const { session, close } = ctx;
  if (!session || session.step) return null;
  if (children) return <>{children(session, ctx)}</>;
  const copy = doneCopy(session);
  return (
    <div className={className} data-cancel-step="done" data-status={session.status}>
      <h2>{copy.title}</h2>
      {copy.body ? <p>{copy.body}</p> : null}
      <div data-cancel-actions="">
        {session.approve_url ? (
          <a data-cancel-primary="" href={session.approve_url}>
            Approve on PayPal
          </a>
        ) : null}
        <button type="button" data-cancel-secondary="" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}

/** "Step 2 of 3". */
function Progress({ className }: ClassName) {
  const { session } = useCancelFlow();
  if (!session?.step) return null;
  const { index, total } = session.progress;
  return (
    <div className={className} data-cancel-progress="" aria-label={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-done={i < index || undefined} data-current={i === index || undefined} />
      ))}
    </div>
  );
}

function Back({ className, children = "Back" }: ClassName & { children?: ReactNode }) {
  const { session, back, phase } = useCancelFlow();
  if (!session?.can_go_back) return null;
  return (
    <button type="button" className={className} data-cancel-back="" disabled={phase === "working"} onClick={() => void back()}>
      {children}
    </button>
  );
}

function Close({ className, children = "×" }: ClassName & { children?: ReactNode }) {
  const { close } = useCancelFlow();
  return (
    <button type="button" className={className} data-cancel-close="" aria-label="Close" onClick={close}>
      {children}
    </button>
  );
}

function ErrorMessage({ className }: ClassName) {
  const { error } = useCancelFlow();
  if (!error) return null;
  return (
    <p className={className} data-cancel-error="" role="alert">
      {error}
    </p>
  );
}

export const CancelFlow = {
  Trigger,
  Dialog,
  Steps,
  Question,
  Text,
  Offer,
  Confirm,
  Done,
  Progress,
  Back,
  Close,
  Error: ErrorMessage,
};
