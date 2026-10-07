"use client";

import { ArrowLeft, Check, HeartHandshake, Loader2, LogOut, MailCheck, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppWindow, ChoiceCard, Control, Panel, Segmented, SwitchRow } from "../controls";
import { ControlsDrawer } from "../controls-drawer";
import { money } from "../state";
import {
  PRO_PRICE,
  decide,
  decideSteps,
  defaultGuardrails,
  personas,
  reasons,
  type Guardrails,
  type Persona,
  type PersonaId,
  type Reason,
  type SaveOffer,
} from "./churn";
import { TracePanel, Typewriter, useTrace } from "./trace";

type Flow =
  | { step: "account" }
  | { step: "survey"; reason: Reason }
  | { step: "thinking"; reason: Reason }
  | { step: "offer"; reason: Reason; offers: SaveOffer[]; index: number }
  | { step: "saved"; offer: SaveOffer }
  | { step: "canceled" };

export function ChurnDemo() {
  const [personaId, setPersonaId] = useState<PersonaId>("power");
  const [guardrails, setGuardrails] = useState<Guardrails>(defaultGuardrails);
  const [flow, setFlow] = useState<Flow>({ step: "account" });
  const trace = useTrace();
  const persona = personas.find((p) => p.id === personaId)!;

  const openSurvey = () => {
    trace.clear();
    trace.push({ kind: "event", tag: "SDK", text: "<CancelFlow /> opened", status: "acct_42", tone: "info" });
    setFlow({ step: "survey", reason: persona.reason });
  };

  const runDecide = (reason: Reason, g: Guardrails, reset = false) => {
    const offers = decide(persona, reason, g);
    setFlow({ step: "thinking", reason });
    trace.play(decideSteps(persona, reason, g, offers), () => (offers.length ? setFlow({ step: "offer", reason, offers, index: 0 }) : cancel()), {
      reset,
    });
  };

  const cancel = () => {
    setFlow({ step: "canceled" });
    trace.play([
      { kind: "event", tag: "HOOK", text: "subscription.canceled", status: "ends Nov 5", tone: "err" },
      { kind: "tool", name: "schedule_workflow", args: '"win_back", in: "30d"', result: "Render workflow · emails acct_42 on Dec 5" },
    ]);
  };

  const accept = (offer: SaveOffer) => {
    setFlow({ step: "saved", offer });
    trace.play([
      { kind: "event", tag: "POST", text: `/offers/${offer.id}/accept`, status: "201", tone: "ok" },
      ...offer.events,
      { kind: "done", text: `Saved. ${money(Math.round(offer.monthly * persona.expectedMonths))} projected revenue kept` },
    ]);
  };

  const decline = () => {
    if (flow.step !== "offer") return;
    const fallback = flow.offers[flow.index + 1];
    const current = flow.offers[flow.index]!;
    if (!fallback) {
      trace.push({ kind: "event", tag: "HOOK", text: "offer.declined", status: current.id, tone: "warn" });
      return cancel();
    }
    setFlow({ step: "thinking", reason: flow.reason });
    trace.push({ kind: "event", tag: "HOOK", text: "offer.declined", status: current.id, tone: "warn" });
    trace.play([{ kind: "think", text: `Main offer declined. Falling back to "${fallback.headline}".` }], () =>
      setFlow({ ...flow, index: flow.index + 1 }),
    );
  };

  const choosePersona = (id: PersonaId) => {
    setPersonaId(id);
    setFlow({ step: "account" });
    trace.clear();
  };

  // Changing a guardrail mid-flow re-runs the agent, so you can watch the offer change.
  const setGuardrail = <K extends keyof Guardrails>(key: K, value: Guardrails[K]) => {
    const g = { ...guardrails, [key]: value };
    setGuardrails(g);
    if (flow.step === "thinking" || flow.step === "offer") runDecide(flow.reason, g, true);
  };

  const reset = () => {
    setFlow({ step: "account" });
    setGuardrails(defaultGuardrails);
    trace.clear();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_300px]">
      <ControlsDrawer
        title="Customer and guardrails"
        summary={`${persona.name} · ${guardrails.maxDiscount === "0" ? "no discounts" : `up to ${guardrails.maxDiscount}% off`}`}
        className="lg:row-span-2 xl:row-span-1"
      >
        <Panel title="Customer">
          {personas.map((p) => (
            <ChoiceCard key={p.id} selected={p.id === personaId} onClick={() => choosePersona(p.id)} title={p.name} note={p.note} avatar={p.initials} />
          ))}
        </Panel>
        <Panel title="Guardrails">
          <p className="px-1 pb-1.5 text-2xs text-fg-muted">Max discount</p>
          <Segmented
            label="Max discount"
            value={guardrails.maxDiscount}
            options={(["0", "20", "40", "50"] as const).map((v) => ({ value: v, label: v === "0" ? "None" : `${v}%` }))}
            onChange={(v) => setGuardrail("maxDiscount", v)}
          />
          <div className="pt-1.5">
            <SwitchRow label="Bonus credits" checked={guardrails.credits} onChange={(v) => setGuardrail("credits", v)} />
            <SwitchRow label="Feature unlocks" checked={guardrails.features} onChange={(v) => setGuardrail("features", v)} />
            <SwitchRow label="Pause subscription" checked={guardrails.pause} onChange={(v) => setGuardrail("pause", v)} />
            <SwitchRow label="Downgrade" checked={guardrails.downgrade} onChange={(v) => setGuardrail("downgrade", v)} />
          </div>
        </Panel>
        <Panel title="Trigger">
          <Control icon={<LogOut />} onClick={openSurvey} disabled={flow.step === "thinking"}>
            Customer clicks cancel
          </Control>
          <Control icon={<RotateCcw />} onClick={reset}>
            Reset
          </Control>
        </Panel>
      </ControlsDrawer>

      <AppWindow url="app.acmedocs.dev/settings/billing" className="h-[560px]">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <span className="flex items-center gap-2 font-display text-sm font-semibold">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand text-[11px] text-accent-contrast">A</span>
            <span className="hidden sm:inline">Acme Docs</span>
          </span>
          <Badge color={flow.step === "saved" && flow.offer.kind === "downgrade" ? "gray" : "brand"}>
            {flow.step === "saved" && flow.offer.kind === "downgrade" ? "Starter" : "Pro"}
          </Badge>
          {flow.step === "canceled" ? <Badge color="orange">Canceling</Badge> : null}
          <span
            key={persona.id}
            className="demo-flash ml-auto inline-flex size-7 items-center justify-center rounded-full bg-bg-active text-2xs font-medium text-fg-secondary"
          >
            {persona.initials}
          </span>
        </div>
        {/* Keyed by customer too, so picking someone new reloads the page: back to the top, faded in, bars refilled. */}
        <div key={persona.id} className="min-h-0 flex-1 overflow-y-auto bg-canvas/40 p-4 sm:p-6">
          <div key={flow.step + ("index" in flow ? flow.index : "")} className="feature-in mx-auto max-w-md">
            {flow.step === "account" ? (
              <Account persona={persona} onCancel={openSurvey} />
            ) : flow.step === "survey" ? (
              <Survey
                reason={flow.reason}
                onReason={(reason) => setFlow({ step: "survey", reason })}
                onBack={() => {
                  setFlow({ step: "account" });
                  trace.clear();
                }}
                onContinue={() => runDecide(flow.reason, guardrails)}
              />
            ) : flow.step === "thinking" ? (
              <Thinking />
            ) : flow.step === "offer" ? (
              <OfferCard offer={flow.offers[flow.index]!} fallback={flow.index > 0} onAccept={accept} onDecline={decline} />
            ) : flow.step === "saved" ? (
              <Saved offer={flow.offer} onBack={() => setFlow({ step: "account" })} />
            ) : (
              <Canceled onRestart={reset} />
            )}
          </div>
        </div>
      </AppWindow>

      <TracePanel
        steps={trace.steps}
        running={trace.running}
        className="h-80 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:h-[560px]"
        idle={
          <>
            Click <span className="text-fg">Cancel subscription</span> in the app. The agent reads the account, checks your
            guardrails and picks a save offer.
          </>
        }
      />
    </div>
  );
}

function Account({ persona, onCancel }: { persona: Persona; onCancel: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-semibold">Billing</h3>
      <section className="rounded-lg border border-border bg-bg p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Pro plan</p>
          <p className="text-sm tabular">{money(PRO_PRICE)}/mo</p>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          Member for {persona.tenure} months · paid with PayPal · renews Nov 5
        </p>
        <div className="mt-4 space-y-3">
          <Meter label="AI credits" pct={persona.creditsPct} value={`${persona.creditsPct}%`} />
          <Meter label="Days active (30d)" pct={(persona.activeDays / 30) * 100} value={`${persona.activeDays}/30`} />
          <Meter label="Seats" pct={(Number(persona.seats[0]) / 3) * 100} value={persona.seats} />
        </div>
      </section>
      <section className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-4">
        <div>
          <p className="text-sm font-medium">Cancel subscription</p>
          <p className="text-xs text-fg-muted">You keep Pro until the end of the period.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 shrink-0 rounded-md px-3 text-xs font-medium text-danger-fg ring-1 ring-danger/40 ring-inset hover:bg-danger-subtle"
        >
          Cancel subscription
        </button>
      </section>
    </div>
  );
}

function Meter({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-fg-tertiary">{label}</span>
        <span className="text-fg-secondary tabular">{value}</span>
      </div>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-bg-active">
        <span className={cn("demo-grow block h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand")} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
    </div>
  );
}

function Survey({
  reason,
  onReason,
  onBack,
  onContinue,
}: {
  reason: Reason;
  onReason: (r: Reason) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-5">
      <h3 className="font-display text-lg font-semibold">Sorry to see you go</h3>
      <p className="mt-1 text-xs text-fg-muted">What&apos;s the main reason you&apos;re canceling?</p>
      <div role="radiogroup" className="mt-4 space-y-1.5">
        {reasons.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => onReason(r.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              reason === r.id ? "border-accent/60 bg-accent-subtle/50 text-fg" : "border-border text-fg-secondary hover:bg-bg-hover",
            )}
          >
            <span className={cn("inline-flex size-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-border-strong", reason === r.id && "ring-accent")}>
              {reason === r.id ? <span className="size-1.5 rounded-full bg-accent" /> : null}
            </span>
            {r.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Never mind
        </button>
        <button type="button" onClick={onContinue} className="h-8 rounded-md bg-bg-active px-3 text-xs font-medium text-fg ring-1 ring-border-strong ring-inset hover:bg-bg-hover">
          Continue
        </button>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="rounded-xl border border-border bg-bg p-5">
      <p className="flex items-center gap-2 text-sm text-fg-secondary">
        <Loader2 className="size-4 animate-spin text-accent-fg" />
        Finding the best option for you…
      </p>
      <div className="mt-5 space-y-2.5" aria-hidden>
        {["w-3/4", "w-full", "w-5/6", "w-1/2"].map((w) => (
          <span key={w} className={cn("block h-3 animate-pulse rounded bg-bg-active", w)} />
        ))}
        <span className="mt-4 block h-9 animate-pulse rounded-md bg-bg-active" />
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  fallback,
  onAccept,
  onDecline,
}: {
  offer: SaveOffer;
  fallback: boolean;
  onAccept: (o: SaveOffer) => void;
  onDecline: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-bg-elevated shadow-lg">
      <div className="relative p-5">
        <div className="absolute inset-x-0 top-0 -z-10 h-24 bg-brand-glow" aria-hidden />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-medium text-accent-fg">
          <Sparkles className="size-3" />
          {fallback ? "One more option" : "Made for you"}
        </span>
        <h3 className="mt-3 font-display text-xl font-semibold text-balance">
          <Typewriter text={offer.headline} />
        </h3>
        <p className="mt-2 text-sm text-fg-secondary">
          <Typewriter text={offer.body} speed={8} />
        </p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {offer.grants.map((g) => (
            <li key={g} className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg-secondary">
              <Check className="size-3 text-success-fg" strokeWidth={3} />
              {g}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tabular">{offer.price.now}</span>
          {offer.price.was ? <span className="text-sm text-fg-muted line-through tabular">{offer.price.was}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => onAccept(offer)}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md btn-neon px-3 text-sm font-medium"
        >
          {offer.cta}
        </button>
        <button type="button" onClick={onDecline} className="mt-2 h-8 w-full text-xs text-fg-muted hover:text-fg">
          No thanks, continue canceling
        </button>
      </div>
      <p className="border-t border-border px-5 py-2.5 font-mono text-[10px] text-fg-placeholder">
        {offer.id} · expires in 48h · within your guardrails
      </p>
    </div>
  );
}

function Saved({ offer, onBack }: { offer: SaveOffer; onBack: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-6 text-center">
      <span className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-success-subtle text-success-fg">
        <HeartHandshake className="size-5" />
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold">Glad you&apos;re staying</h3>
      <p className="mt-1 text-xs text-fg-muted">Applied to your account right away. No reload needed.</p>
      <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-fg-secondary">
        {offer.grants.map((g) => (
          <li key={g} className="flex items-center gap-2">
            <Check className="size-3.5 text-success-fg" strokeWidth={3} />
            {g}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onBack} className="mt-5 text-xs text-accent-fg hover:underline">
        Back to billing
      </button>
    </div>
  );
}

function Canceled({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-6 text-center">
      <span className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-bg-active text-fg-icon">
        <MailCheck className="size-5" />
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold">Your plan ends on Nov 5</h3>
      <p className="mt-1 text-xs text-fg-muted">Thanks for the feedback. Your docs stay here if you come back.</p>
      <button type="button" onClick={onRestart} className="mt-5 text-xs text-accent-fg hover:underline">
        Restart demo
      </button>
    </div>
  );
}
