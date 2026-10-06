/*
 * A fake Offer SDK for the demo page. Everything runs in the browser: the reducer stands in for
 * the API, and each action appends the requests and webhooks the real SDK would make to a log.
 */

export type PlanId = "free" | "pro" | "team";
export type Status = "active" | "trialing" | "past_due" | "canceled";
export type BoolFeature = "exports" | "custom_domains";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  credits: number;
  seats: number;
  exports: boolean;
  custom_domains: boolean;
}

export const plans: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", price: 0, credits: 500, seats: 1, exports: false, custom_domains: false },
  pro: { id: "pro", name: "Pro", price: 29, credits: 5000, seats: 3, exports: true, custom_domains: false },
  team: { id: "team", name: "Team", price: 79, credits: 20000, seats: 10, exports: true, custom_domains: true },
};

export const planOrder: PlanId[] = ["free", "pro", "team"];

export const nextPlan = (id: PlanId): PlanId | null => planOrder[planOrder.indexOf(id) + 1] ?? null;

export const featureLabels: Record<BoolFeature, string> = {
  exports: "PDF export",
  custom_domains: "Custom domains",
};

export const CREDIT_PACK = { credits: 2000, price: 10 };
export const GENERATE_COST = 50;

export interface Incentive {
  code: string;
  percentOff: number;
  cycles: number;
}

export type Offer =
  | { kind: "upgrade"; target: PlanId; reason: BoolFeature | "seats" | "manual" }
  | { kind: "credits" }
  | { kind: "retention" }
  | { kind: "renew"; reason: "trial" | "past_due" | "canceled" };

export type Purchase = { plan: PlanId } | { pack: true };

export type LogTag = "GET" | "POST" | "SDK" | "HOOK";
export type LogTone = "ok" | "warn" | "err" | "info";

export interface LogEvent {
  id: number;
  /** Milliseconds since the demo started. */
  t: number;
  tag: LogTag;
  text: string;
  status?: string;
  tone?: LogTone;
}

export interface DemoState {
  plan: PlanId;
  status: Status;
  trialDaysLeft: number | null;
  creditsUsed: number;
  bonusCredits: number;
  seatsUsed: number;
  overrides: Partial<Record<BoolFeature, boolean>>;
  incentive: Incentive | null;
  offer: Offer | null;
  /** A checkout in flight; the PayPal button shows a spinner until it completes. */
  pending: Purchase | null;
  toast: { id: number; text: string } | null;
  paragraphs: number;
  events: LogEvent[];
  seq: number;
}

export const initialState: DemoState = {
  plan: "free",
  status: "active",
  trialDaysLeft: null,
  creditsUsed: 180,
  bonusCredits: 0,
  seatsUsed: 1,
  overrides: {},
  incentive: null,
  offer: null,
  pending: null,
  toast: null,
  paragraphs: 2,
  events: [{ id: 0, t: 0, tag: "GET", text: "/namespaces/acct_42/full-plan", status: "200 · free", tone: "ok" }],
  seq: 1,
};

/** What `useEntitlement` would return for each feature. */
export function entitlements(s: DemoState) {
  const p = plans[s.plan];
  return {
    exports: s.overrides.exports ?? p.exports,
    custom_domains: s.overrides.custom_domains ?? p.custom_domains,
    ai_credits: { limit: p.credits + s.bonusCredits, used: s.creditsUsed },
    seats: { limit: p.seats, used: s.seatsUsed },
  };
}

export function price(s: DemoState, plan: PlanId) {
  const base = plans[plan].price;
  return s.incentive ? Math.round(base * (100 - s.incentive.percentOff)) / 100 : base;
}

export const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/** The `/full-plan` response for the current state. */
export function fullPlan(s: DemoState) {
  const e = entitlements(s);
  return {
    plan: s.plan,
    status: s.status,
    ...(s.trialDaysLeft != null ? { trial_days_left: s.trialDaysLeft } : {}),
    entitlements: {
      exports: e.exports,
      custom_domains: e.custom_domains,
      seats: e.seats,
      ai_credits: e.ai_credits,
    },
    ...(s.bonusCredits ? { addons: [{ id: "credit_pack", credits: s.bonusCredits }] } : {}),
    incentive: s.incentive
      ? { code: s.incentive.code, percent_off: s.incentive.percentOff, cycles_left: s.incentive.cycles }
      : null,
  };
}

export type Action =
  | { type: "set_plan"; plan: PlanId }
  | { type: "use_credits"; amount: number }
  | { type: "max_credits" }
  | { type: "generate" }
  | { type: "invite" }
  | { type: "reset_usage" }
  | { type: "start_trial"; days: number }
  | { type: "payment_failed" }
  | { type: "cancel_clicked" }
  | { type: "apply_promo" }
  | { type: "grant_pack" }
  | { type: "set_override"; feature: BoolFeature; value: boolean }
  | { type: "use_feature"; feature: BoolFeature }
  | { type: "show_offer"; offer: Offer }
  | { type: "dismiss_offer" }
  | { type: "accept_retention" }
  | { type: "confirm_cancel" }
  | { type: "checkout"; purchase: Purchase }
  | { type: "checkout_complete" }
  | { type: "clear_toast" }
  | { type: "reset" };

type Entry = Omit<LogEvent, "id" | "t">;

const offerId = (o: Offer) =>
  o.kind === "upgrade"
    ? `upgrade_${o.target}`
    : o.kind === "credits"
      ? "credits_topup"
      : o.kind === "retention"
        ? "save_40_off"
        : `renew_${o.reason}`;

const decide = (o: Offer, reason: string): Entry => ({
  tag: "POST",
  text: `/decide-offer { reason: "${reason}" }`,
  status: `200 · ${offerId(o)}`,
  tone: "info",
});

const refetch = (plan: PlanId): Entry => ({
  tag: "GET",
  text: "/namespaces/acct_42/full-plan",
  status: `200 · ${plan}`,
  tone: "ok",
});

/** Offer to show when the customer reaches for a feature or seat they don't have. */
export function upgradeOfferFor(s: DemoState, reason: BoolFeature | "seats"): Offer {
  const target =
    reason === "custom_domains" ? "team" : reason === "exports" ? "pro" : (nextPlan(s.plan) ?? "team");
  return { kind: "upgrade", target, reason };
}

export function reducer(state: DemoState, action: Action & { t: number }): DemoState {
  const [next, entries] = step(state, action);
  if (!entries.length) return next;
  const events = entries.map((e, i) => ({ ...e, id: next.seq + i, t: action.t }));
  return { ...next, seq: next.seq + entries.length, events: [...events.reverse(), ...next.events].slice(0, 40) };
}

function toast(s: DemoState, text: string): DemoState["toast"] {
  return { id: s.seq, text };
}

function step(s: DemoState, a: Action): [DemoState, Entry[]] {
  const e = entitlements(s);
  const credits = e.ai_credits;

  switch (a.type) {
    case "set_plan": {
      if (a.plan === s.plan) return [s, []];
      return [
        { ...s, plan: a.plan, status: "active", trialDaysLeft: null, offer: null, pending: null },
        [
          { tag: "HOOK", text: "subscription.updated", status: `${s.plan} → ${a.plan}`, tone: "info" },
          refetch(a.plan),
        ],
      ];
    }

    case "use_credits":
    case "generate": {
      const amount = a.type === "generate" ? GENERATE_COST : a.amount;
      const usage: Entry = { tag: "POST", text: `/usage ai_credits +${amount}`, status: "200", tone: "ok" };
      if (credits.used + amount > credits.limit) {
        const offer: Offer = { kind: "credits" };
        return [
          { ...s, offer },
          [{ ...usage, status: "402 Payment Required", tone: "err" }, decide(offer, "ai_credits.exceeded")],
        ];
      }
      return [
        {
          ...s,
          creditsUsed: credits.used + amount,
          paragraphs: a.type === "generate" ? s.paragraphs + 1 : s.paragraphs,
        },
        [{ ...usage, status: `200 · ${(credits.limit - credits.used - amount).toLocaleString("en-US")} left` }],
      ];
    }

    case "max_credits":
      return [
        { ...s, creditsUsed: credits.limit },
        [{ tag: "POST", text: `/usage ai_credits +${credits.limit - credits.used}`, status: "200 · 0 left", tone: "warn" }],
      ];

    case "invite": {
      if (s.seatsUsed >= e.seats.limit) {
        const offer = upgradeOfferFor(s, "seats");
        return [
          { ...s, offer },
          [
            { tag: "SDK", text: 'useEntitlement("seats")', status: `${s.seatsUsed}/${e.seats.limit} · full`, tone: "warn" },
            decide(offer, "seats.exceeded"),
          ],
        ];
      }
      return [
        { ...s, seatsUsed: s.seatsUsed + 1, toast: toast(s, "Invite sent") },
        [{ tag: "POST", text: "/usage seats +1", status: `200 · ${s.seatsUsed + 1}/${e.seats.limit}`, tone: "ok" }],
      ];
    }

    case "reset_usage":
      return [
        { ...s, creditsUsed: 0, seatsUsed: 1 },
        [{ tag: "HOOK", text: "usage.reset", status: "billing period rolled over", tone: "info" }],
      ];

    case "start_trial": {
      const plan = s.plan === "free" ? "pro" : s.plan;
      return [
        { ...s, plan, status: "trialing", trialDaysLeft: a.days, offer: null },
        [
          {
            tag: "HOOK",
            text: s.status === "trialing" ? "trial.will_end" : "trial.started",
            status: `${plans[plan].name} · ${a.days} days left`,
            tone: "info",
          },
          refetch(plan),
        ],
      ];
    }

    case "payment_failed":
      if (s.plan === "free") return [s, []];
      return [
        { ...s, status: "past_due", trialDaysLeft: null },
        [
          { tag: "HOOK", text: "payment.failed", status: `PayPal declined · ${money(price(s, s.plan))}`, tone: "err" },
          { tag: "HOOK", text: "subscription.past_due", status: "grace period 3 days", tone: "warn" },
        ],
      ];

    case "cancel_clicked": {
      if (s.plan === "free") return [s, []];
      const offer: Offer = { kind: "retention" };
      return [{ ...s, offer }, [decide(offer, "cancel.intent")]];
    }

    case "accept_retention":
      return [
        {
          ...s,
          status: "active",
          offer: null,
          incentive: { code: "SAVE40", percentOff: 40, cycles: 3 },
          toast: toast(s, "40% off applied. Glad you're staying"),
        },
        [
          { tag: "POST", text: "/offers/save_40_off/redeem", status: "201", tone: "ok" },
          { tag: "HOOK", text: "incentive.applied", status: "SAVE40 · 3 cycles", tone: "info" },
        ],
      ];

    case "confirm_cancel":
      return [
        { ...s, status: "canceled", offer: null },
        [
          { tag: "HOOK", text: "offer.declined", status: "save_40_off", tone: "warn" },
          { tag: "HOOK", text: "subscription.canceled", status: "ends Nov 5", tone: "err" },
        ],
      ];

    case "apply_promo":
      return [
        { ...s, incentive: { code: "SPRING20", percentOff: 20, cycles: 3 }, toast: toast(s, "SPRING20 applied") },
        [
          { tag: "POST", text: "/incentives/SPRING20/apply", status: "201", tone: "ok" },
          { tag: "HOOK", text: "incentive.applied", status: "20% off · 3 cycles", tone: "info" },
        ],
      ];

    case "grant_pack":
      return [
        { ...s, bonusCredits: s.bonusCredits + CREDIT_PACK.credits, toast: toast(s, `+${CREDIT_PACK.credits.toLocaleString("en-US")} AI credits`) },
        [{ tag: "HOOK", text: "addon.granted", status: `credit_pack +${CREDIT_PACK.credits}`, tone: "info" }, refetch(s.plan)],
      ];

    case "set_override": {
      const overrides = { ...s.overrides };
      if (a.value === plans[s.plan][a.feature]) delete overrides[a.feature];
      else overrides[a.feature] = a.value;
      return [
        { ...s, overrides },
        [
          {
            tag: "POST",
            text: `/entitlements/${a.feature}/${overrides[a.feature] == null ? "reset" : "override"}`,
            status: `200 · ${a.value}`,
            tone: "ok",
          },
        ],
      ];
    }

    case "use_feature": {
      const has = e[a.feature];
      const check: Entry = {
        tag: "SDK",
        text: `useEntitlement("${a.feature}")`,
        status: String(has),
        tone: has ? "ok" : "warn",
      };
      if (has) {
        return [
          { ...s, toast: toast(s, a.feature === "exports" ? "Exported launch-plan.pdf" : "docs.acme.com connected") },
          [check],
        ];
      }
      const offer = upgradeOfferFor(s, a.feature);
      return [{ ...s, offer }, [check, decide(offer, `${a.feature}.locked`)]];
    }

    case "show_offer":
      return [{ ...s, offer: a.offer }, [decide(a.offer, a.offer.kind === "renew" ? a.offer.reason : a.offer.kind)]];

    case "dismiss_offer":
      if (!s.offer) return [s, []];
      return [{ ...s, offer: null, pending: null }, [{ tag: "HOOK", text: "offer.dismissed", status: offerId(s.offer), tone: "warn" }]];

    case "checkout":
      return [
        { ...s, pending: a.purchase },
        [
          {
            tag: "POST",
            text: "/checkout/orders",
            status: `201 · ${"plan" in a.purchase ? `${a.purchase.plan} ${money(price(s, a.purchase.plan))}` : `credit_pack ${money(CREDIT_PACK.price)}`}`,
            tone: "ok",
          },
        ],
      ];

    case "checkout_complete": {
      const p = s.pending;
      if (!p) return [s, []];
      const paid: Entry = { tag: "HOOK", text: "payment.captured", status: "PayPal", tone: "ok" };
      if ("pack" in p) {
        return [
          {
            ...s,
            pending: null,
            offer: null,
            bonusCredits: s.bonusCredits + CREDIT_PACK.credits,
            toast: toast(s, `+${CREDIT_PACK.credits.toLocaleString("en-US")} AI credits added`),
          },
          [paid, { tag: "HOOK", text: "addon.granted", status: `credit_pack +${CREDIT_PACK.credits}`, tone: "info" }, refetch(s.plan)],
        ];
      }
      const incentive = s.incentive && s.incentive.cycles > 1 ? { ...s.incentive, cycles: s.incentive.cycles - 1 } : null;
      return [
        {
          ...s,
          plan: p.plan,
          status: "active",
          trialDaysLeft: null,
          pending: null,
          offer: null,
          incentive,
          toast: toast(s, `You're on ${plans[p.plan].name}`),
        },
        [
          paid,
          {
            tag: "HOOK",
            text: "subscription.updated",
            status: p.plan === s.plan ? `${p.plan} · active` : `${s.plan} → ${p.plan}`,
            tone: "info",
          },
          refetch(p.plan),
        ],
      ];
    }

    case "clear_toast":
      return [{ ...s, toast: null }, []];

    case "reset":
      return [{ ...initialState, seq: s.seq, events: s.events }, [{ tag: "SDK", text: "demo.reset()", tone: "info" }, refetch("free")]];
  }
}
