"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  Plus,
  Settings,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppWindow } from "./controls";
import {
  CREDIT_PACK,
  GENERATE_COST,
  entitlements,
  featureLabels,
  money,
  nextPlan,
  plans,
  price,
  type Action,
  type DemoState,
  type Offer,
  type PlanId,
  type Purchase,
} from "./state";

type View = "editor" | "team" | "settings";
type Act = (action: Action) => void;

const planColor: Record<PlanId, BadgeColor> = { free: "gray", pro: "purple", team: "teal" };

const members = ["You", "Maya Chen", "Sam Ortiz", "Priya Nair", "Leo Park", "Ana Silva", "Tom Reid", "Kai Brooks", "Zoe Adams", "Ben Cole", "Ivy Lane", "Max Hart"];

const paragraphs = [
  "Launch week starts Monday. The goal is 400 paid upgrades by Friday, driven by the spring offer and two partner newsletters.",
  "Every touchpoint links to one checkout page. Offers change per campaign; the page doesn't.",
  "Draft: target heavy free users first. Anyone above 80% of their AI credits sees the Pro offer inline, not in an email.",
  "Partners get their own offer links with 30% off the first three months, tracked per partner in the dashboard.",
  "Retention: when a Pro customer clicks cancel, offer 40% off for three months before confirming.",
  "Success metric: upgrades per offer shown, split by surface (in-app, email, partner).",
];

/** A product built on the SDK, drawn as a small app window. It only reads state and dispatches. */
export function MockApp({ state, act }: { state: DemoState; act: Act }) {
  const [view, setView] = useState<View>("editor");
  const e = entitlements(state);
  const plan = plans[state.plan];

  // Toasts clear themselves.
  useEffect(() => {
    if (!state.toast) return;
    const id = setTimeout(() => act({ type: "clear_toast" }), 2600);
    return () => clearTimeout(id);
  }, [state.toast, act]);

  const nav: { id: View; label: string; icon: ReactNode }[] = [
    { id: "editor", label: "Docs", icon: <FileText /> },
    { id: "team", label: "Team", icon: <Users /> },
    { id: "settings", label: "Settings", icon: <Settings /> },
  ];

  return (
    <AppWindow url={`app.acmedocs.dev/${view === "editor" ? "docs/launch-plan" : view}`} className="h-[580px]">
      {/* App header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand text-[11px] text-white">A</span>
          <span className="hidden sm:inline">Acme Docs</span>
        </span>
        <span key={`${state.plan}-${state.status}`} className="demo-flash flex items-center gap-1.5 rounded-md">
          <Badge color={planColor[state.plan]}>{plan.name}</Badge>
          {state.status === "trialing" ? (
            <Badge color="blue" icon={<Clock />}>
              Trial · {state.trialDaysLeft}d
            </Badge>
          ) : state.status === "past_due" ? (
            <Badge color="red">Past due</Badge>
          ) : state.status === "canceled" ? (
            <Badge color="orange">Canceling</Badge>
          ) : null}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <CreditMeter used={e.ai_credits.used} limit={e.ai_credits.limit} />
          {nextPlan(state.plan) ? (
            <button
              type="button"
              onClick={() => act({ type: "show_offer", offer: { kind: "upgrade", target: nextPlan(state.plan)!, reason: "manual" } })}
              className="hidden h-7 items-center gap-1 rounded-md bg-brand-vertical px-2.5 text-xs font-medium text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.22),inset_0_0_0_2px_rgb(255_255_255/0.18)] hover:brightness-110 sm:inline-flex"
            >
              <Sparkles className="size-3.5" />
              Upgrade
            </button>
          ) : null}
        </div>
      </div>

      <Banner state={state} act={act} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <nav className="flex w-12 shrink-0 flex-col gap-0.5 border-r border-border bg-panel/60 p-1.5 sm:w-40 sm:p-2">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              aria-label={n.label}
              className={cn(
                "flex h-8 items-center justify-center gap-2 rounded-md px-2 text-sm text-fg-tertiary transition-colors hover:bg-bg-hover hover:text-fg sm:justify-start [&_svg]:size-4 [&_svg]:shrink-0",
                view === n.id && "bg-bg-active text-fg",
              )}
            >
              {n.icon}
              <span className="hidden sm:inline">{n.label}</span>
            </button>
          ))}
          <p className="mt-4 hidden px-2 text-2xs font-medium text-fg-placeholder uppercase sm:block">Recent</p>
          {["Launch plan", "Q4 roadmap", "Partner FAQ"].map((d, i) => (
            <span key={d} className={cn("hidden truncate rounded-md px-2 py-1 text-xs sm:block", i === 0 ? "text-fg-secondary" : "text-fg-muted")}>
              {d}
            </span>
          ))}
        </nav>

        {/* Views */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {view === "editor" ? (
            <Editor state={state} act={act} />
          ) : view === "team" ? (
            <Team state={state} act={act} />
          ) : (
            <SettingsView state={state} act={act} />
          )}
        </div>
      </div>

      {state.offer ? <OfferModal offer={state.offer} state={state} act={act} /> : null}

      {state.toast ? (
        <div
          key={state.toast.id}
          role="status"
          className="feature-in absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border-strong bg-bg-elevated px-3 py-2 text-sm whitespace-nowrap text-fg shadow-lg"
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-success text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
          {state.toast.text}
        </div>
      ) : null}
    </AppWindow>
  );
}

function CreditMeter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand";
  return (
    <span className="flex flex-col items-end gap-1" title="AI credits">
      <span className="flex items-center gap-1 text-2xs text-fg-tertiary tabular">
        <Sparkles className="size-3 text-fg-icon" />
        <span key={used} className={cn("demo-flash rounded px-0.5", pct >= 100 && "text-danger-fg")}>
          {Math.max(0, limit - used).toLocaleString("en-US")}
        </span>
        <span className="hidden sm:inline">credits left</span>
      </span>
      <span className="h-1 w-20 overflow-hidden rounded-full bg-bg-active sm:w-28">
        <span className={cn("block h-full rounded-full transition-[width] duration-500 ease-out", tone)} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function Banner({ state, act }: { state: DemoState; act: Act }) {
  const planName = plans[state.plan].name;
  let banner: { tone: string; icon: ReactNode; text: ReactNode; cta?: { label: string; offer: Offer } } | null = null;

  if (state.status === "past_due") {
    banner = {
      tone: "bg-danger-subtle text-danger-fg",
      icon: <AlertTriangle />,
      text: "We couldn't charge your PayPal account. Features stay on for 3 more days.",
      cta: { label: "Update payment", offer: { kind: "renew", reason: "past_due" } },
    };
  } else if (state.status === "trialing" && state.trialDaysLeft != null && state.trialDaysLeft <= 3) {
    banner = {
      tone: "bg-warning-subtle text-warning-fg",
      icon: <Clock />,
      text: `Your ${planName} trial ends in ${state.trialDaysLeft} days.`,
      cta: { label: `Keep ${planName}`, offer: { kind: "renew", reason: "trial" } },
    };
  } else if (state.status === "trialing") {
    banner = {
      tone: "bg-tag-blue-bg text-tag-blue-fg",
      icon: <Sparkles />,
      text: `You're trying ${planName} free for ${state.trialDaysLeft} more days.`,
    };
  } else if (state.status === "canceled") {
    banner = {
      tone: "bg-tag-orange-bg text-tag-orange-fg",
      icon: <Clock />,
      text: `Your ${planName} plan ends on Nov 5.`,
      cta: { label: "Resubscribe", offer: { kind: "renew", reason: "canceled" } },
    };
  } else if (state.incentive) {
    banner = {
      tone: "bg-brand-soft text-fg-secondary",
      icon: <Tag />,
      text: (
        <>
          <span className="font-mono text-fg">{state.incentive.code}</span>: {state.incentive.percentOff}% off your next{" "}
          {state.incentive.cycles} bills
        </>
      ),
    };
  }

  if (!banner) return null;
  return (
    <div className={cn("feature-in flex min-h-9 shrink-0 items-center gap-2 px-4 py-1.5 text-xs [&>svg]:size-3.5 [&>svg]:shrink-0", banner.tone)}>
      {banner.icon}
      <span className="min-w-0 flex-1">{banner.text}</span>
      {banner.cta ? (
        <button
          type="button"
          onClick={() => act({ type: "show_offer", offer: banner.cta!.offer })}
          className="shrink-0 rounded-md bg-bg/70 px-2 py-1 font-medium text-fg ring-1 ring-border-strong hover:bg-bg"
        >
          {banner.cta.label}
        </button>
      ) : null}
    </div>
  );
}

function Editor({ state, act }: { state: DemoState; act: Act }) {
  const e = entitlements(state);
  const out = e.ai_credits.used + GENERATE_COST > e.ai_credits.limit;
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <AppButton onClick={() => act({ type: "generate" })} tone={out ? "muted" : "accent"}>
          <Sparkles />
          Write with AI
          <span className="text-2xs opacity-70 tabular">{GENERATE_COST}</span>
        </AppButton>
        <AppButton onClick={() => act({ type: "use_feature", feature: "exports" })} locked={!e.exports}>
          {e.exports ? <Download /> : <Lock />}
          Export PDF
        </AppButton>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold">Launch plan</h3>
      <p className="mt-1 text-2xs text-fg-muted">Edited just now · {state.seatsUsed} {state.seatsUsed === 1 ? "editor" : "editors"}</p>
      <div className="mt-4 space-y-3 text-sm text-fg-secondary">
        {Array.from({ length: state.paragraphs }, (_, i) => (
          <p key={i} className={cn(i >= 2 && "feature-in", i === state.paragraphs - 1 && i >= 2 && "rounded-md bg-accent-subtle/60 px-2 py-1 -mx-2")}>
            {paragraphs[i % paragraphs.length]}
          </p>
        ))}
      </div>
    </div>
  );
}

function Team({ state, act }: { state: DemoState; act: Act }) {
  const { limit, used } = entitlements(state).seats;
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Team</h3>
          <p className={cn("text-xs tabular", used > limit ? "text-danger-fg" : "text-fg-muted")}>
            {used} of {limit} {limit === 1 ? "seat" : "seats"} used
          </p>
        </div>
        <AppButton onClick={() => act({ type: "invite" })} locked={used >= limit}>
          {used >= limit ? <Lock /> : <Plus />}
          Invite
        </AppButton>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {members.slice(0, used).map((m, i) => (
          <li key={m} className={cn("flex items-center gap-3 px-3 py-2 text-sm", i > 0 && "feature-in")}>
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-bg-active text-2xs font-medium text-fg-secondary">
              {m === "You" ? "DJ" : m.split(" ").map((w) => w[0]).join("")}
            </span>
            <span className="flex-1 text-fg">{m}</span>
            <span className="text-xs text-fg-muted">{i === 0 ? "Owner" : "Editor"}</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, limit - used) }).slice(0, 3).map((_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm text-fg-placeholder">
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border-strong" />
            Open seat
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsView({ state, act }: { state: DemoState; act: Act }) {
  const e = entitlements(state);
  const plan = plans[state.plan];
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h3 className="font-display text-lg font-semibold">Settings</h3>
      <section className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="size-4 text-fg-icon" />
          Custom domain
          {!e.custom_domains ? <Badge color="teal">Team</Badge> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <span className={cn("flex h-8 min-w-0 flex-1 items-center rounded-md border border-border-input bg-panel px-2.5 font-mono text-xs", e.custom_domains ? "text-fg-secondary" : "text-fg-placeholder")}>
            docs.acme.com
          </span>
          <AppButton onClick={() => act({ type: "use_feature", feature: "custom_domains" })} locked={!e.custom_domains}>
            {e.custom_domains ? null : <Lock />}
            Connect
          </AppButton>
        </div>
      </section>
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Billing</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <dt className="text-fg-muted">Plan</dt>
          <dd className="text-right text-fg">{plan.name}</dd>
          <dt className="text-fg-muted">Price</dt>
          <dd className="text-right text-fg tabular">
            {plan.price === 0 ? (
              "Free"
            ) : state.incentive ? (
              <>
                <span className="mr-1.5 text-fg-muted line-through">{money(plan.price)}</span>
                {money(price(state, state.plan))}/mo
              </>
            ) : (
              `${money(plan.price)}/mo`
            )}
          </dd>
          <dt className="text-fg-muted">Status</dt>
          <dd className="text-right text-fg capitalize">{state.status.replace("_", " ")}</dd>
          <dt className="text-fg-muted">Payment</dt>
          <dd className="text-right text-fg">{plan.price ? "PayPal · dj@acme.dev" : "None"}</dd>
        </dl>
        {state.plan !== "free" && state.status !== "canceled" ? (
          <button
            type="button"
            onClick={() => act({ type: "cancel_clicked" })}
            className="mt-4 text-xs text-danger-fg hover:underline"
          >
            Cancel subscription
          </button>
        ) : null}
      </section>
    </div>
  );
}

function AppButton({
  children,
  onClick,
  locked,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  locked?: boolean;
  tone?: "default" | "accent" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ring-1 ring-inset transition-colors [&_svg]:size-3.5",
        locked
          ? "bg-panel text-fg-muted ring-border hover:text-fg-secondary"
          : tone === "accent"
            ? "bg-accent-subtle text-accent-fg ring-accent/30 hover:bg-accent/25"
            : tone === "muted"
              ? "bg-panel text-fg-muted ring-border"
              : "bg-bg text-fg ring-border-strong hover:bg-bg-hover",
      )}
    >
      {children}
    </button>
  );
}

function OfferModal({ offer, state, act }: { offer: Offer; state: DemoState; act: Act }) {
  const pending = state.pending;
  const close = () => act({ type: "dismiss_offer" });

  let content: ReactNode;
  if (offer.kind === "credits") {
    const up = nextPlan(state.plan);
    content = (
      <>
        <OfferHead icon={<Sparkles />} title="You're out of AI credits" body="Top up now or move to a plan with more each month." />
        <div className="mt-4 space-y-2">
          <Choice
            title={`+${CREDIT_PACK.credits.toLocaleString("en-US")} credits`}
            note="One-time credit pack"
            price={money(CREDIT_PACK.price)}
            purchase={{ pack: true }}
            pending={pending}
            act={act}
          />
          {up ? (
            <Choice
              title={`${plans[up].name} · ${plans[up].credits.toLocaleString("en-US")}/mo`}
              note="Plus everything in your plan"
              price={`${money(price(state, up))}/mo`}
              strike={state.incentive ? money(plans[up].price) : undefined}
              purchase={{ plan: up }}
              pending={pending}
              act={act}
              featured
            />
          ) : null}
        </div>
      </>
    );
  } else if (offer.kind === "retention") {
    const discounted = Math.round(plans[state.plan].price * 60) / 100;
    content = (
      <>
        <OfferHead icon={<Tag />} title="Before you go: 40% off for 3 months" body={`Keep ${plans[state.plan].name} and everything in it for ${money(discounted)}/mo.`} />
        <div className="mt-5 flex flex-col gap-2">
          <ModalButton onClick={() => act({ type: "accept_retention" })}>Keep {plans[state.plan].name} for {money(discounted)}/mo</ModalButton>
          <button type="button" onClick={() => act({ type: "confirm_cancel" })} className="h-8 text-xs text-fg-muted hover:text-fg">
            Cancel anyway
          </button>
        </div>
      </>
    );
  } else {
    const target = offer.kind === "upgrade" ? offer.target : state.plan === "free" ? "pro" : state.plan;
    const p = plans[target];
    const title =
      offer.kind === "renew"
        ? offer.reason === "past_due"
          ? "Update your payment method"
          : offer.reason === "trial"
            ? `Keep ${p.name} after your trial`
            : `Resubscribe to ${p.name}`
        : offer.reason === "manual"
          ? `Upgrade to ${p.name}`
          : offer.reason === "seats"
            ? `Need more seats? ${p.name} has ${p.seats}`
            : `${featureLabels[offer.reason]} ${offer.reason === "exports" ? "is a" : "come with"} ${p.name}${offer.reason === "exports" ? " feature" : ""}`;
    content = (
      <>
        <OfferHead
          icon={offer.kind === "renew" && offer.reason === "past_due" ? <AlertTriangle /> : <Sparkles />}
          title={title}
          body={offer.kind === "renew" && offer.reason === "past_due" ? "Reconnect PayPal to keep your plan running." : `Upgrade and it unlocks right away. No reload needed.`}
        />
        <ul className="mt-4 space-y-1.5 text-xs text-fg-secondary">
          {[
            `${p.credits.toLocaleString("en-US")} AI credits / month`,
            `${p.seats} seats`,
            p.custom_domains ? "Custom domains" : "PDF export",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="size-3.5 text-success-fg" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tabular">{money(price(state, target))}</span>
          {state.incentive ? <span className="text-sm text-fg-muted line-through tabular">{money(p.price)}</span> : null}
          <span className="text-xs text-fg-muted">/month</span>
          {state.incentive ? <Badge color="pink" className="ml-auto">{state.incentive.code}</Badge> : null}
        </div>
        <PayPalButton purchase={{ plan: target }} pending={pending} act={act} className="mt-3 w-full" />
      </>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-(--backdrop) p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-label="Offer"
        onClick={(ev) => ev.stopPropagation()}
        className="feature-in relative w-full max-w-sm rounded-xl border border-border-strong bg-bg-elevated p-5 shadow-lg"
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 rounded-md p-1 text-fg-icon hover:bg-bg-hover hover:text-fg">
          <X className="size-4" />
        </button>
        {content}
        <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-fg-placeholder">
          offer chosen by /decide-offer · rendered with &lt;Offer /&gt;
        </p>
      </div>
    </div>
  );
}

function OfferHead({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <>
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-soft text-accent-fg [&_svg]:size-4">{icon}</span>
      <h4 className="mt-3 pr-6 font-display text-lg font-semibold text-balance">{title}</h4>
      <p className="mt-1 text-xs text-fg-muted">{body}</p>
    </>
  );
}

function Choice({
  title,
  note,
  price,
  strike,
  purchase,
  pending,
  act,
  featured,
}: {
  title: string;
  note: string;
  price: string;
  strike?: string;
  purchase: Purchase;
  pending: Purchase | null;
  act: Act;
  featured?: boolean;
}) {
  const busy = pending != null && ("pack" in purchase ? "pack" in pending : "plan" in pending && pending.plan === purchase.plan);
  return (
    <button
      type="button"
      disabled={pending != null}
      onClick={() => act({ type: "checkout", purchase })}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-bg-hover disabled:opacity-60",
        featured ? "border-accent/50 bg-accent-subtle/40" : "border-border bg-bg",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-2xs text-fg-muted">{note}</span>
      </span>
      <span className="text-right text-sm text-fg tabular">
        {strike ? <span className="mr-1 text-2xs text-fg-muted line-through">{strike}</span> : null}
        {busy ? <Loader2 className="inline size-4 animate-spin" /> : price}
      </span>
    </button>
  );
}

function PayPalButton({ purchase, pending, act, className }: { purchase: Purchase; pending: Purchase | null; act: Act; className?: string }) {
  return (
    <button
      type="button"
      disabled={pending != null}
      onClick={() => act({ type: "checkout", purchase })}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-(--paypal) text-sm font-semibold text-(--paypal-fg) transition-[filter] hover:brightness-105 disabled:opacity-80",
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Processing
        </>
      ) : (
        "Pay with PayPal"
      )}
    </button>
  );
}

function ModalButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-md bg-brand-vertical px-3 text-sm font-medium text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.22),inset_0_0_0_2px_rgb(255_255_255/0.18)] hover:brightness-110"
    >
      {children}
    </button>
  );
}
