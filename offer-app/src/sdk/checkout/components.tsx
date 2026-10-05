"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { loadPaypal, type PaypalButtons } from "./paypal";
import { type OfferContextValue, useOffer } from "./provider";
import { formatMoney, INTERVAL_LABELS, plansFor, priceLabel, renewalLabel, savings } from "./state";
import type { Checkout, Interval, OfferBump, OfferPlan, OfferPrice, Unavailable } from "./types";

// Headless building blocks for a checkout page. Each renders plain markup with
// `data-*` attributes for state (data-selected, data-featured, data-phase…) so
// the page styles them; pass `children` as a function to render your own markup.

type ClassName = { className?: string };

function Headline({ className, children }: ClassName & { children?: (ctx: OfferContextValue) => ReactNode }) {
  const ctx = useOffer();
  if (!ctx.offer) return null;
  if (children) return <>{children(ctx)}</>;
  const { copy, name } = ctx.offer;
  return (
    <div className={className} data-offer-headline="">
      <h2>{copy.headline ?? name}</h2>
      {copy.subhead && <p>{copy.subhead}</p>}
      {copy.bullets?.length ? (
        <ul>
          {copy.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const REASONS: Record<Unavailable, string> = {
  not_found: "This offer doesn't exist.",
  draft: "This offer isn't live yet.",
  archived: "This offer has ended.",
  expired: "This offer has ended.",
  sold_out: "This offer is sold out.",
  not_eligible: "This offer is for a different account.",
};

/** Explains why the requested offer isn't shown (expired, sold out…). Renders nothing otherwise. */
function Status({
  className,
  children,
}: ClassName & { children?: (reason: Unavailable, ctx: OfferContextValue) => ReactNode }) {
  const ctx = useOffer();
  const reason = ctx.offer?.requested?.reason;
  if (!reason) return null;
  if (children) return <>{children(reason, ctx)}</>;
  return (
    <p className={className} data-offer-status={reason} role="status">
      {REASONS[reason]} {ctx.offer?.resolved_from === "default" ? "Here are the regular prices." : "Here's what's available."}
    </p>
  );
}

function IntervalToggle({ className, labels }: ClassName & { labels?: Partial<Record<Interval, ReactNode>> }) {
  const { offer, selection, setInterval } = useOffer();
  if (!offer || offer.intervals.length < 2) return null;
  return (
    <div className={className} role="radiogroup" aria-label="Billing" data-offer-intervals="">
      {offer.intervals.map((interval) => (
        <button
          key={interval}
          type="button"
          role="radio"
          aria-checked={selection.interval === interval}
          data-selected={selection.interval === interval || undefined}
          onClick={() => setInterval(interval)}
        >
          {labels?.[interval] ?? INTERVAL_LABELS[interval]}
        </button>
      ))}
    </div>
  );
}

/** The plans sold for the selected interval. */
function Plans({ className, children }: ClassName & { children: (plan: OfferPlan) => ReactNode }) {
  const { offer, selection } = useOffer();
  if (!offer) return null;
  return (
    <div className={className} role="radiogroup" aria-label="Plan" data-offer-plans="">
      {plansFor(offer, selection.interval).map((plan) => (
        <Fragment key={plan.id}>{children(plan)}</Fragment>
      ))}
    </div>
  );
}

export interface PlanRenderProps {
  plan: OfferPlan;
  price: OfferPrice;
  interval: Interval;
  currency: string;
  selected: boolean;
  select(): void;
  /** "$10/mo" */
  priceText: string;
  /** "$20/mo" when discounted, else null */
  listPriceText: string | null;
  /** "for 3 months, then $20/mo" */
  renewalText: string | null;
  /** Percent off the list price */
  savings: number | null;
}

function Plan({
  plan,
  className,
  children,
}: ClassName & { plan: OfferPlan; children?: (props: PlanRenderProps) => ReactNode }) {
  const { offer, selection, selectPlan } = useOffer();
  const interval = selection.interval;
  const price = interval ? plan.prices[interval] : undefined;
  if (!offer || !interval || !price) return null;

  const props: PlanRenderProps = {
    plan,
    price,
    interval,
    currency: offer.currency,
    selected: selection.plan === plan.id,
    select: () => selectPlan(plan.id),
    priceText: priceLabel(price.amount, interval, offer.currency),
    listPriceText: savings(price) !== null ? priceLabel(price.list_price!, interval, offer.currency) : null,
    renewalText: renewalLabel(price, interval, offer.currency),
    savings: savings(price),
  };
  if (children) return <>{children(props)}</>;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      className={className}
      data-offer-plan={plan.id}
      data-selected={props.selected || undefined}
      data-featured={plan.featured || undefined}
      onClick={props.select}
    >
      <span data-part="name">{plan.name}</span>
      <span data-part="price">
        {props.listPriceText && <s>{props.listPriceText}</s>} {props.priceText}
      </span>
      {props.renewalText && <span data-part="renewal">{props.renewalText}</span>}
      {plan.description && <span data-part="description">{plan.description}</span>}
      {plan.extras.length + plan.benefits.length > 0 && (
        <ul data-part="features">
          {plan.extras.map((e) => (
            <li key={e.id} data-extra="">
              {e.max === null ? `Unlimited ${e.name}` : `${e.max.toLocaleString()} ${e.name}`}
            </li>
          ))}
          {plan.benefits.map((b) => (
            <li key={b.id}>{b.title}</li>
          ))}
        </ul>
      )}
    </button>
  );
}

/** Bumps that apply to the selected plan and interval. */
function Bumps({ className, children }: ClassName & { children: (bump: OfferBump) => ReactNode }) {
  const { bumps } = useOffer();
  if (!bumps.length) return null;
  return (
    <div className={className} data-offer-bumps="">
      {bumps.map((bump) => (
        <Fragment key={bump.id}>{children(bump)}</Fragment>
      ))}
    </div>
  );
}

export interface BumpRenderProps {
  bump: OfferBump;
  selected: boolean;
  toggle(on?: boolean): void;
  /** "+$50" */
  priceText: string;
}

function Bump({ bump, className, children }: ClassName & { bump: OfferBump; children?: (props: BumpRenderProps) => ReactNode }) {
  const { offer, selection, toggleBump } = useOffer();
  if (!offer) return null;
  const props: BumpRenderProps = {
    bump,
    selected: selection.bumps.includes(bump.id),
    toggle: (on) => toggleBump(bump.id, on),
    priceText: `+${formatMoney(bump.amount, offer.currency)}`,
  };
  if (children) return <>{children(props)}</>;
  return (
    <label className={className} data-offer-bump={bump.id} data-selected={props.selected || undefined}>
      <input type="checkbox" checked={props.selected} onChange={(e) => props.toggle(e.target.checked)} />
      <span data-part="label">{bump.label}</span>
      <span data-part="price">{props.priceText}</span>
      {bump.description && <span data-part="description">{bump.description}</span>}
    </label>
  );
}

function Summary({ className, children }: ClassName & { children?: (ctx: OfferContextValue) => ReactNode }) {
  const ctx = useOffer();
  const { offer, summary } = ctx;
  if (!offer || !summary?.plan || !summary.price || !summary.interval) return null;
  if (children) return <>{children(ctx)}</>;
  const { plan, price, interval, bumps, totalToday } = summary;
  const renewal = renewalLabel(price, interval, offer.currency);
  return (
    <dl className={className} data-offer-summary="">
      <dt>
        {plan.name} · {INTERVAL_LABELS[interval]}
      </dt>
      <dd>{priceLabel(price.amount, interval, offer.currency)}</dd>
      {bumps.map((b) => (
        <Fragment key={b.id}>
          <dt>{b.label}</dt>
          <dd>{formatMoney(b.amount, offer.currency)}</dd>
        </Fragment>
      ))}
      <dt data-part="total">Due today</dt>
      <dd data-part="total">{formatMoney(totalToday, offer.currency)}</dd>
      {interval !== "once" && (
        <dd data-part="renewal">
          {renewal
            ? `${priceLabel(price.amount, interval, offer.currency)} ${renewal}. Cancel anytime.`
            : `Renews at ${priceLabel(price.amount, interval, offer.currency)}. Cancel anytime.`}
        </dd>
      )}
    </dl>
  );
}

/** Email field, shown only when the page didn't pass an account. */
function Email({ className, placeholder = "you@company.com", label = "Email" }: ClassName & { placeholder?: string; label?: ReactNode }) {
  const { account, email, setEmail } = useOffer();
  if (account) return null;
  return (
    <label className={className} data-offer-email="">
      <span>{label}</span>
      <input type="email" autoComplete="email" required value={email} placeholder={placeholder} onChange={(e) => setEmail(e.target.value)} />
    </label>
  );
}

const PHASE_TEXT: Partial<Record<OfferContextValue["phase"], string>> = {
  starting: "Preparing your checkout…",
  confirming: "Confirming your payment…",
  completed: "You're all set.",
};

/**
 * PayPal's buttons for the current selection. Subscriptions for monthly and
 * yearly prices, a one-time order for lifetime. Calls `onSuccess` once the
 * API has applied the purchase.
 */
function CheckoutButton({
  className,
  onSuccess,
  style,
  children,
}: ClassName & {
  onSuccess?(checkout: Checkout): void;
  /** PayPal button style, e.g. { color: "black", shape: "pill" }. */
  style?: Record<string, string | number>;
  children?: (ctx: OfferContextValue) => ReactNode;
}) {
  const ctx = useOffer();
  const container = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latest = useRef(ctx);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    latest.current = ctx;
    onSuccessRef.current = onSuccess;
  });

  const clientId = ctx.offer?.paypal?.client_id;
  const currency = ctx.offer?.currency;
  const kind = ctx.summary?.interval === "once" ? "order" : "subscription";
  const ready = !!ctx.summary?.ready;
  const styleKey = JSON.stringify(style ?? {});

  useEffect(() => {
    if (!clientId || !currency || !ready || !container.current) return;
    let cancelled = false;
    let buttons: PaypalButtons | null = null;

    loadPaypal(clientId, kind, currency).then(
      (paypal) => {
        if (cancelled || !container.current) return;
        const create = async () => (await latest.current.startCheckout()).paypal!.id;
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: kind === "subscription" ? "subscribe" : "pay", ...JSON.parse(styleKey) },
          ...(kind === "subscription" ? { createSubscription: create } : { createOrder: create }),
          onApprove: async () => {
            const done = await latest.current.confirm();
            if (done) onSuccessRef.current?.(done);
          },
          onCancel: () => latest.current.cancel(),
          onError: (err: unknown) => latest.current.fail(err),
        });
        container.current.replaceChildren();
        void buttons.render(container.current);
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load PayPal");
      },
    );

    return () => {
      cancelled = true;
      void buttons?.close?.();
    };
  }, [clientId, currency, kind, ready, styleKey]);

  if (children) return <>{children(ctx)}</>;
  if (ctx.offer && !ctx.offer.paypal) {
    return (
      <p className={className} data-offer-checkout="" data-error="" role="alert">
        Payments aren&apos;t set up for this app yet.
      </p>
    );
  }

  const status = ctx.checkoutError ?? loadError ?? PHASE_TEXT[ctx.phase];
  return (
    <div className={className} data-offer-checkout="" data-phase={ctx.phase}>
      <div ref={container} hidden={ctx.phase === "confirming" || ctx.phase === "completed"} />
      {status && (
        <p role={ctx.checkoutError || loadError ? "alert" : "status"} data-error={ctx.checkoutError || loadError ? "" : undefined}>
          {status}
        </p>
      )}
    </div>
  );
}

export const Offer = {
  Headline,
  Status,
  IntervalToggle,
  Plans,
  Plan,
  Bumps,
  Bump,
  Summary,
  Email,
  Checkout: CheckoutButton,
};
