import sql from "../db/client.ts";
import { getDoc } from "../db/docs.ts";
import { startCheckout } from "./checkout.ts";
import type { Json } from "./http.ts";
import {
  type Catalog,
  DEFAULT_OFFER_ID,
  defaultOffer,
  entryPrice,
  type EntryPrice,
  type Interval,
  loadCatalog,
  offerIntervals,
  unavailableReason,
} from "./offers.ts";
import { getConnection } from "./paypal.ts";

// The 402 a usage call gets when an entitlement with `overage.mode: "block"`
// is used up. Written for whoever reads it, including an AI agent calling the
// API: a plain-language message plus an upgrade offer with a checkout link.

type Upgrade = { offer: Json; entry: Json; plan: Json; interval: Interval; price: EntryPrice; limit: number | null };

const limitFor = (entry: Json, plan: Json, entitlementId: string): number | null | undefined => {
  const ref =
    (entry.entitlements as Json[] | undefined)?.find((e) => e.id === entitlementId) ??
    (plan.entitlements as Json[] | undefined)?.find((e) => e.id === entitlementId);
  return ref ? (ref.max ?? null) : undefined;
};

const perMonth = (p: EntryPrice, interval: Interval) => (interval === "year" ? p.amount / 12 : p.amount);

// The cheapest plan in the offer that raises this entitlement's limit.
function pickUpgrade(offer: Json, catalog: Catalog, currentPlan: string, entitlementId: string, currentMax: number): Upgrade | null {
  const options: Upgrade[] = [];
  for (const entry of offer.plans as Json[]) {
    const plan = catalog.plans.get(entry.plan_id);
    if (!plan || plan.id === currentPlan) continue;
    const limit = limitFor(entry, plan, entitlementId);
    if (limit === undefined || (limit !== null && limit <= currentMax)) continue;
    const intervals = offerIntervals(offer);
    const interval = (["month", "year", "once"] as Interval[]).find((i) => intervals.includes(i) && entryPrice(offer, entry, plan, i));
    if (!interval) continue;
    options.push({ offer, entry, plan, interval, price: entryPrice(offer, entry, plan, interval)!, limit });
  }
  options.sort((a, b) => perMonth(a.price, a.interval) - perMonth(b.price, b.interval));
  return options[0] ?? null;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}

function priceText(p: EntryPrice, interval: Interval, currency: string) {
  if (interval === "once") return `${formatMoney(p.amount, currency)} once`;
  const per = interval === "year" ? "/year" : "/month";
  if (p.cycles && p.list_price !== null) {
    const period = interval === "year" ? "year" : "month";
    return `${formatMoney(p.amount, currency)}${per} for ${p.cycles} ${period}${p.cycles > 1 ? "s" : ""}, then ${formatMoney(p.list_price, currency)}${per}`;
  }
  return `${formatMoney(p.amount, currency)}${per}`;
}

// A link that starts paying for the upgrade: the app's own checkout page when
// it has one (`checkout_url` on the app), else a PayPal approval link made on
// the spot and reused while it's open.
async function checkoutLink(appId: string, accountId: string, upgrade: Upgrade, catalog: Catalog): Promise<string | null> {
  const [app] = await sql`select data ->> 'checkout_url' as url from apps where id = ${appId}`;
  if (app?.url) {
    const url = new URL(app.url);
    url.searchParams.set("offer", upgrade.offer.id);
    url.searchParams.set("plan", upgrade.plan.id);
    url.searchParams.set("interval", upgrade.interval);
    url.searchParams.set("account", accountId);
    return url.toString();
  }

  if (!(await getConnection(appId))) return null;
  const offerId = upgrade.offer.id === DEFAULT_OFFER_ID ? null : upgrade.offer.id;
  const [open] = await sql`
    select approve_url from checkouts
    where app_id = ${appId} and account_id = ${accountId} and status = 'created' and approve_url is not null
      and plan_id = ${upgrade.plan.id} and interval = ${upgrade.interval}
      and offer_id is not distinct from ${offerId}
      and created_at > now() - interval '1 hour'
    order by created_at desc limit 1`;
  if (open) return open.approve_url;

  try {
    const row = await startCheckout(
      appId,
      upgrade.offer,
      catalog,
      { plan: upgrade.plan.id, interval: upgrade.interval },
      { account: accountId, ref: "usage_limit" },
    );
    return row.approve_url ?? null;
  } catch (err) {
    console.error("over-limit checkout failed:", err);
    return null;
  }
}

export async function limitReachedBody(
  appId: string,
  namespace: Json,
  entitlement: Json,
  usage: number,
  max: number,
) {
  const catalog = await loadCatalog(appId);
  const name: string = entitlement.name ?? entitlement.id;
  const planName = catalog.plans.get(namespace.plan)?.pricingCard?.title ?? catalog.plans.get(namespace.plan)?.name ?? namespace.plan;

  // The entitlement's chosen offer if this account can buy it, else regular prices.
  let offer: Json | null = null;
  const chosen = entitlement.overage?.offer_id;
  if (typeof chosen === "string") {
    const doc = await getDoc("offers", appId, chosen);
    if (doc && !(await unavailableReason(appId, doc, namespace.id))) offer = doc;
  }
  const upgrade =
    (offer && pickUpgrade(offer, catalog, namespace.plan, entitlement.id, max)) ??
    pickUpgrade(defaultOffer(appId, catalog), catalog, namespace.plan, entitlement.id, max);

  const used = `You've used ${usage.toLocaleString("en-US")} of ${max.toLocaleString("en-US")} ${name} on the ${planName} plan.`;
  if (!upgrade) {
    return {
      error: "limit_reached",
      message: `${used} There is no plan with a higher limit to upgrade to.`,
      entitlement: { id: entitlement.id, name, usage, max },
      offer: null,
      retry_after_purchase: false,
    };
  }

  const currency = upgrade.offer.currency;
  const upName = upgrade.plan.pricingCard?.title ?? upgrade.plan.name ?? upgrade.plan.id;
  const limitText = upgrade.limit === null ? `unlimited ${name}` : `${upgrade.limit.toLocaleString("en-US")} ${name}`;
  const url = await checkoutLink(appId, namespace.id, upgrade, catalog);

  return {
    error: "limit_reached",
    message: `${used} ${upName} includes ${limitText} for ${priceText(upgrade.price, upgrade.interval, currency)}.${url ? ` Upgrade here: ${url}` : ""}`,
    entitlement: { id: entitlement.id, name, usage, max },
    offer: {
      id: upgrade.offer.id,
      name: upgrade.offer.id === DEFAULT_OFFER_ID ? null : (upgrade.offer.name ?? upgrade.offer.id),
      plan: { id: upgrade.plan.id, name: upName },
      interval: upgrade.interval,
      currency,
      price: upgrade.price.amount,
      list_price: upgrade.price.list_price,
      cycles: upgrade.price.cycles,
      new_limit: upgrade.limit,
      checkout_url: url,
      expires_at: upgrade.offer.expires_at ?? null,
    },
    retry_after_purchase: true,
  };
}
