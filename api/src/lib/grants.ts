import sql from "../db/client.ts";
import { listDocs } from "../db/docs.ts";
import type { Json } from "./http.ts";
import { prefixedId } from "./ids.ts";
import { addDuration, isDuration, type Quote } from "./offers.ts";
import { emit, emitAccountChanges } from "./webhooks.ts";

// Applies purchases to accounts. A completed checkout sets the account's core
// plan, records the deal as `subscription` (offer, price, renewal) and adds bump
// addons and credits. PayPal stays the source of truth for renewals: every
// subscription webhook re-reads the subscription and updates the record.

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export function checkoutJson(row: Json) {
  return {
    id: row.id,
    app_id: row.app_id,
    offer_id: row.offer_id,
    plan_id: row.plan_id,
    interval: row.interval,
    bumps: row.bump_ids,
    account_id: row.account_id,
    email: row.email,
    ref: row.ref,
    status: row.status,
    currency: row.quote.currency,
    total_today: row.quote.total_today,
    quote: row.quote,
    paypal: row.paypal_id ? { kind: row.paypal_kind, id: row.paypal_id } : null,
    approve_url: row.approve_url ?? null,
    created_at: iso(row.created_at),
    completed_at: iso(row.completed_at),
  };
}

// ─── PayPal billing state ──────────────────────────────

export type Billing = {
  status: "active" | "suspended" | "cancelled" | "pending";
  renews_at: string | null;
  discounted_cycles_left: number;
  cycles_completed: number;
  paypal_plan_id: string | null;
};

const STATUS: Record<string, Billing["status"]> = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  EXPIRED: "cancelled",
};

// Reads what we track from a PayPal subscription resource.
export function billingFromSubscription(sub: Json): Billing {
  const executions: Json[] = sub.billing_info?.cycle_executions ?? [];
  const trial = executions.find((e) => e.tenure_type === "TRIAL");
  return {
    status: STATUS[sub.status] ?? "pending",
    renews_at: iso(sub.billing_info?.next_billing_time),
    discounted_cycles_left: trial ? Math.max(0, (trial.total_cycles ?? 0) - (trial.cycles_completed ?? 0)) : 0,
    cycles_completed: executions.reduce((sum, e) => sum + (e.cycles_completed ?? 0), 0),
    paypal_plan_id: sub.plan_id ?? null,
  };
}

// What the next charge will be.
function renewsAtPrice(sub: Json, cyclesLeft: number) {
  if (sub.interval === "once") return null;
  return sub.cycles && cyclesLeft === 0 ? (sub.list_price ?? sub.price) : sub.price;
}

// ─── Completing a checkout ─────────────────────────────

// Grants a paid checkout exactly once. Returns null when it was already
// completed (a repeated webhook or a second /complete call).
export async function completeCheckout(
  appId: string,
  checkoutId: string,
  billing: Pick<Billing, "renews_at" | "discounted_cycles_left"> | null,
) {
  const result = await sql.begin(async (tx) => {
    const [checkout] = await tx`
      select * from checkouts where app_id = ${appId} and id = ${checkoutId} for update`;
    if (!checkout || checkout.status !== "created") return null;

    const q: Quote = checkout.quote;
    const now = new Date();

    let accountId: string | null = checkout.account_id;
    let before: Json | null = null;
    if (accountId) {
      const [row] = await tx`
        select data from namespaces where app_id = ${appId} and id = ${accountId} for update`;
      before = row?.data ?? null;
    }
    accountId ??= prefixedId("acct", 16);
    const base: Json = before ?? {
      id: accountId,
      app_id: appId,
      name: checkout.email ?? accountId,
      email: checkout.email ?? null,
      incentive: null,
      created_at: now.toISOString(),
    };

    const cyclesLeft = billing?.discounted_cycles_left ?? q.cycles ?? 0;
    const subscription: Json = {
      offer_id: q.offer_id,
      offer_name: q.offer_name,
      plan_id: q.plan_id,
      interval: q.interval,
      currency: q.currency,
      price: q.price,
      list_price: q.list_price,
      cycles: q.cycles,
      discounted_cycles_left: q.interval === "once" ? 0 : cyclesLeft,
      renews_at: billing?.renews_at ?? null,
      renews_at_price: null,
      status: "active",
      provider: "paypal",
      provider_id: checkout.paypal_id,
      checkout_id: checkout.id,
      ref: checkout.ref,
      started_at: now.toISOString(),
      extras: {
        entitlements: q.extras.entitlements,
        addons: q.extras.addons,
        ends: q.extras.ends,
        ends_at: isDuration(q.extras.ends) ? addDuration(now, q.extras.ends).toISOString() : null,
      },
    };
    subscription.renews_at_price = renewsAtPrice(subscription, subscription.discounted_cycles_left);

    const existingAddons: string[] = base.addons ?? [];
    const bumpAddons = q.bumps.flatMap((b) => (b.grant.addons ?? []) as string[]);
    const newAddons = [...new Set(bumpAddons)].filter((a) => !existingAddons.includes(a));
    const after: Json = { ...base, plan: q.plan_id, subscription, addons: [...existingAddons, ...newAddons] };

    if (before) {
      await tx`update namespaces set data = ${after}::jsonb where app_id = ${appId} and id = ${accountId}`;
    } else {
      await tx`insert into namespaces (app_id, id, data) values (${appId}, ${accountId}, ${after}::jsonb)`;
    }

    // Credits lower the usage count, the same way a negative `amount` does.
    for (const bump of q.bumps) {
      const credits = bump.grant.credits;
      if (!credits) continue;
      await tx`
        with counter as (
          insert into usage_counters (app_id, namespace_id, entitlement_id, count)
          values (${appId}, ${accountId}, ${credits.entitlement}, ${-credits.amount})
          on conflict (app_id, namespace_id, entitlement_id)
          do update set count = usage_counters.count + excluded.count, updated_at = now()
          returning count
        )
        insert into usage_events (app_id, namespace_id, entitlement_id, operation, amount, count)
        select ${appId}, ${accountId}, ${credits.entitlement}, 'amount', ${-credits.amount}, count from counter`;
    }

    const [completed] = await tx`
      update checkouts set status = 'completed', completed_at = now(), account_id = ${accountId}
      where id = ${checkoutId} returning *`;
    if (completed.offer_id) {
      await tx`
        insert into offer_events (app_id, offer_id, type, plan_id, interval, ref, checkout_id)
        values (${appId}, ${completed.offer_id}, 'completed', ${completed.plan_id}, ${completed.interval},
                ${completed.ref}, ${completed.id})`;
    }
    return { before, after, newAddons, checkout: completed };
  });

  if (!result) return null;

  if (result.before) await emitAccountChanges(appId, result.before, result.after);
  else await emit(appId, "account.created", { object: result.after });
  for (const addon of result.newAddons) {
    await emit(appId, "account.addon_granted", { object: result.after, addon_id: addon, source: "checkout" });
  }
  await emit(appId, "checkout.completed", { object: checkoutJson(result.checkout), account: result.after });
  return result;
}

// ─── Subscription updates from PayPal ──────────────────

async function freePlanId(appId: string): Promise<string | null> {
  return (await listDocs("plans", appId)).find((p) => p.isFree)?.id ?? null;
}

// Updates the account that owns a PayPal subscription: renewal dates and
// discounted cycles, cancellation (back to the free plan) and plan changes that
// were waiting for the buyer's approval.
export async function applySubscriptionBilling(appId: string, subscriptionId: string, billing: Billing) {
  const freePlan = billing.status === "cancelled" ? await freePlanId(appId) : null;

  const result = await sql.begin(async (tx) => {
    const [row] = await tx`
      select id, data from namespaces
      where app_id = ${appId} and data -> 'subscription' ->> 'provider_id' = ${subscriptionId}
      for update`;
    if (!row) return null;

    const before: Json = row.data;
    const prev: Json = before.subscription;
    let sub: Json = { ...prev };
    let plan = before.plan;

    // A plan change takes effect once PayPal reports the new billing plan;
    // downgrades also wait for the renewal date so nothing paid for is lost.
    const pending: Json | undefined = prev.pending_change;
    if (
      pending &&
      billing.paypal_plan_id === pending.paypal_plan_id &&
      (!pending.apply_after || new Date(pending.apply_after).getTime() <= Date.now())
    ) {
      const { paypal_plan_id: _, approve_url: __, apply_after: ___, requested_at: ____, ...change } = pending;
      sub = { ...sub, ...change, pending_change: null };
      plan = pending.plan_id;
    }

    if (billing.status !== "pending") sub.status = billing.status;
    sub.renews_at = billing.renews_at ?? sub.renews_at ?? null;
    sub.discounted_cycles_left = billing.discounted_cycles_left;
    sub.renews_at_price = renewsAtPrice(sub, sub.discounted_cycles_left);
    sub.payments = billing.cycles_completed;

    if (billing.status === "cancelled" && prev.status !== "cancelled") {
      sub.cancelled_at = new Date().toISOString();
      if (freePlan) plan = freePlan;
    }

    const after: Json = { ...before, plan, subscription: sub };
    await tx`update namespaces set data = ${after}::jsonb where app_id = ${appId} and id = ${row.id}`;
    return { before, after, prev, sub };
  });

  if (!result) return null;
  const { before, after, prev, sub } = result;
  await emitAccountChanges(appId, before, after);

  if (sub.status === "cancelled" && prev.status !== "cancelled") {
    await emit(appId, "subscription.cancelled", { object: after, previous: { plan: before.plan } });
  } else if ((sub.payments ?? 0) > (prev.payments ?? 1) && sub.payments > 1) {
    await emit(appId, "subscription.renewed", { object: after });
  }
  return after;
}
