"use client";

import { Check, Handshake, Loader2, Lock, Mail, PartyPopper, RotateCcw, Search, UserRound } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppWindow, ChoiceCard, Control, Panel, Segmented, SwitchRow } from "../controls";
import { money } from "../state";
import {
  bumps,
  checkoutPlans,
  compose,
  composeSteps,
  controlPage,
  defaultGuardrails,
  price,
  purchaseSteps,
  visitors,
  type BumpId,
  type CheckoutPlan,
  type Guardrails,
  type Interval,
  type Page,
  type VisitorId,
} from "./checkout";
import { TracePanel, Typewriter, useTrace } from "./trace";

type Variant = "control" | "agent";
type Phase = "idle" | "composing" | "ready" | "paying" | "paid";

const visitorIcons: Record<VisitorId, ReactNode> = {
  partner: <Handshake />,
  ad: <Search />,
  returning: <UserRound />,
  bf: <Mail />,
};

export function CheckoutDemo() {
  const [visitorId, setVisitorId] = useState<VisitorId>("partner");
  const [variant, setVariant] = useState<Variant>("agent");
  const [guardrails, setGuardrails] = useState<Guardrails>(defaultGuardrails);
  const [phase, setPhase] = useState<Phase>("idle");
  const [page, setPage] = useState<Page | null>(null);
  const [plan, setPlan] = useState<CheckoutPlan>("pro");
  const [interval, setBilling] = useState<Interval>("month");
  const [bump, setBump] = useState(false);
  const trace = useTrace();
  const root = useRef<HTMLDivElement>(null);
  const visitor = visitors.find((v) => v.id === visitorId)!;

  const show = (p: Page) => {
    setPage(p);
    setPlan(p.plan);
    setBilling(p.interval);
    setBump(p.bump != null);
    setPhase("ready");
  };

  const land = (id: VisitorId, g: Guardrails, which: Variant) => {
    const v = visitors.find((x) => x.id === id)!;
    if (which === "control") {
      show(controlPage);
      trace.play(
        [
          { kind: "event", tag: "GET", text: `/checkout${v.query}`, status: "page view", tone: "info" },
          { kind: "event", tag: "SDK", text: "variant A · control", status: `static offer ${controlPage.id}`, tone: "warn" },
        ],
        undefined,
        { reset: true },
      );
      return;
    }
    const next = compose(v, g);
    setPage(null);
    setPhase("composing");
    trace.play(composeSteps(v, g, next), () => show(next), { reset: true });
  };

  // Land the first visitor once the demo scrolls into view, so the run isn't over before anyone sees it.
  const landFirst = useEffectEvent(() => land("partner", defaultGuardrails, "agent"));
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      landFirst();
    }, { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chooseVisitor = (id: VisitorId) => {
    setVisitorId(id);
    land(id, guardrails, variant);
  };

  const chooseVariant = (v: Variant) => {
    setVariant(v);
    land(visitorId, guardrails, v);
  };

  const updateGuardrails = (g: Guardrails) => {
    setGuardrails(g);
    if (variant === "agent") land(visitorId, g, variant);
  };

  const discount = page?.discount ?? 0;
  const { base, now } = price(plan, interval, discount);
  const bumpId: BumpId | null = page?.bump ?? null;
  const total = now + (bump && bumpId ? bumps[bumpId].price : 0);

  const pay = () => {
    if (!page) return;
    setPhase("paying");
    trace.play(purchaseSteps(visitor, page, plan, interval, bump ? bumpId : null, total), () => setPhase("paid"));
  };

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_300px]">
      <aside className="space-y-4 lg:row-span-2 xl:row-span-1">
        <Panel title="Visitor">
          {visitors.map((v) => (
            <ChoiceCard
              key={v.id}
              selected={v.id === visitorId}
              onClick={() => chooseVisitor(v.id)}
              title={v.label}
              note={v.note}
              avatar={visitorIcons[v.id]}
            />
          ))}
        </Panel>
        <Panel title="Experiment">
          <Segmented
            label="Variant"
            value={variant}
            options={[
              { value: "control", label: "A · Control" },
              { value: "agent", label: "B · Agent" },
            ]}
            onChange={chooseVariant}
          />
        </Panel>
        <Panel title="Guardrails">
          <p className="px-1 pb-1.5 text-2xs text-fg-muted">Max discount</p>
          <Segmented
            label="Max discount"
            value={guardrails.maxDiscount}
            options={(["0", "20", "30", "50"] as const).map((v) => ({ value: v, label: v === "0" ? "None" : `${v}%` }))}
            onChange={(maxDiscount) => updateGuardrails({ ...guardrails, maxDiscount })}
          />
          <p className="px-1 pt-3 pb-0.5 text-2xs text-fg-muted">Order bumps the agent may add</p>
          {(Object.keys(bumps) as BumpId[]).map((b) => (
            <SwitchRow
              key={b}
              label={bumps[b].name}
              checked={guardrails.bumps[b]}
              onChange={(on) => updateGuardrails({ ...guardrails, bumps: { ...guardrails.bumps, [b]: on } })}
            />
          ))}
        </Panel>
        <Control icon={<RotateCcw />} onClick={() => land(visitorId, guardrails, variant)} disabled={phase === "composing" || phase === "paying"}>
          Land again
        </Control>
      </aside>

      <AppWindow url={`acmedocs.dev/checkout${visitor.query}`} className="h-[600px]">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand font-display text-[11px] font-semibold text-accent-contrast">A</span>
          <span className="font-display text-sm font-semibold">Acme Docs</span>
          <span className={cn("ml-auto rounded-md px-1.5 py-0.5 font-mono text-[10px]", variant === "agent" ? "bg-accent-subtle text-accent-fg" : "bg-bg-active text-fg-tertiary")}>
            {variant === "agent" ? "variant B · agent" : "variant A · control"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md p-4 sm:p-6">
            {phase === "idle" || phase === "composing" || !page ? (
              <Composing />
            ) : phase === "paid" ? (
              <Paid plan={plan} interval={interval} total={total} partner={visitor.id === "partner" && variant === "agent"} />
            ) : (
              <div key={page.id + variant} className="feature-in">
                {page.badge ? (
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg py-0.5 pr-2.5 pl-0.5 text-2xs text-fg-secondary">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-tag-pink-bg text-[9px] font-medium text-tag-pink-fg">SB</span>
                    {page.badge}
                  </span>
                ) : null}
                <h3 className="font-display text-2xl font-semibold text-balance">
                  {variant === "agent" ? <Typewriter text={page.headline} /> : page.headline}
                </h3>
                <p className="mt-1.5 text-sm text-fg-muted">{page.sub}</p>

                <div role="group" aria-label="Billing interval" className="mt-5 inline-grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1 ring-1 ring-border">
                  {(["month", "year"] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={interval === i}
                      onClick={() => setBilling(i)}
                      className={cn("h-7 rounded-md px-3 text-xs text-fg-tertiary hover:text-fg", interval === i && "bg-bg-active text-fg")}
                    >
                      {i === "month" ? "Monthly" : "Yearly · 2 months free"}
                    </button>
                  ))}
                </div>

                <div role="radiogroup" aria-label="Plan" className="mt-3 space-y-2">
                  {(Object.keys(checkoutPlans) as CheckoutPlan[]).map((id) => {
                    const p = price(id, interval, discount);
                    const selected = plan === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPlan(id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          selected ? "border-accent/60 bg-accent-subtle/40" : "border-border bg-bg hover:bg-bg-hover",
                        )}
                      >
                        <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-border-strong", selected && "bg-accent ring-accent")}>
                          {selected ? <Check className="size-2.5 text-accent-contrast" strokeWidth={4} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium text-fg">
                            {checkoutPlans[id].name}
                            {variant === "agent" && id === page.plan ? (
                              <span className="rounded bg-brand-soft px-1.5 text-[10px] font-medium text-accent-fg">Best for you</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-2xs text-fg-muted">{checkoutPlans[id].blurb}</span>
                        </span>
                        <span className="text-right text-sm tabular">
                          {discount ? <span className="mr-1 text-2xs text-fg-muted line-through">{money(p.base)}</span> : null}
                          {money(p.now)}
                          <span className="text-2xs text-fg-muted">/{interval === "month" ? "mo" : "yr"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {bumpId ? (
                  <label className="mt-3 flex cursor-pointer gap-3 rounded-lg border border-dashed border-warning/50 bg-warning-subtle/40 p-3">
                    <input type="checkbox" checked={bump} onChange={(ev) => setBump(ev.target.checked)} className="mt-0.5 size-4 shrink-0 accent-(--accent)" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                        Add {bumps[bumpId].name}
                        <span className="tabular">+{money(bumps[bumpId].price)}</span>
                      </span>
                      <span className="block text-2xs text-fg-muted">{bumps[bumpId].blurb}</span>
                    </span>
                  </label>
                ) : null}

                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
                  <div className="flex justify-between text-fg-secondary">
                    <span>Due today</span>
                    <span className="text-sm font-semibold text-fg tabular">{money(total)}</span>
                  </div>
                  <p className="text-fg-muted">
                    {discount
                      ? `${discount}% off ${interval === "month" ? "for 3 months" : "your first year"}, then ${money(base)}/${interval === "month" ? "mo" : "yr"}.`
                      : `Renews at ${money(base)}/${interval === "month" ? "mo" : "yr"}.`}{" "}
                    Cancel anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pay}
                  disabled={phase === "paying"}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-(--paypal) text-sm font-semibold text-(--paypal-fg) transition-[filter] hover:brightness-105 disabled:opacity-80"
                >
                  {phase === "paying" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    "Pay with PayPal"
                  )}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-fg-placeholder">
                  <Lock className="size-3" />
                  <span className="font-mono">{page.id}</span> · prices re-checked on the server
                </p>
              </div>
            )}
          </div>
        </div>
      </AppWindow>

      <TracePanel
        steps={trace.steps}
        running={trace.running}
        className="h-80 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:h-[600px]"
        idle="Pick a visitor. The agent reads where they came from and builds the checkout for them."
      />
    </div>
  );
}

function Composing() {
  return (
    <div aria-label="Composing checkout" className="space-y-3">
      <span className="block h-7 w-4/5 animate-pulse rounded bg-bg-active" />
      <span className="block h-4 w-3/5 animate-pulse rounded bg-bg-active" />
      <span className="mt-5 block h-9 w-1/2 animate-pulse rounded-lg bg-bg-active" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="block h-14 animate-pulse rounded-lg bg-bg-active" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
      <span className="block h-10 animate-pulse rounded-md bg-bg-active" />
    </div>
  );
}

function Paid({ plan, interval, total, partner }: { plan: CheckoutPlan; interval: Interval; total: number; partner: boolean }) {
  return (
    <div className="feature-in pt-10 text-center">
      <span className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-success-subtle text-success-fg">
        <PartyPopper className="size-5" />
      </span>
      <h3 className="mt-3 font-display text-xl font-semibold">Welcome to {checkoutPlans[plan].name}</h3>
      <p className="mt-1 text-sm text-fg-muted">
        Paid {money(total)} with PayPal · billed {interval === "month" ? "monthly" : "yearly"}
      </p>
      <p className="mt-1 text-xs text-fg-muted">Your plan is active. No reload or support ticket needed.</p>
      {partner ? <p className="mt-4 text-xs text-tag-pink-fg">@sarahbuilds was credited for this sale</p> : null}
    </div>
  );
}
