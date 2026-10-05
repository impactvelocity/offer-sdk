import sql from "../db/client.ts";
import { getDoc, getDocs } from "../db/docs.ts";
import type { EntitlementRef } from "./attachments.ts";
import type { Json } from "./http.ts";

const isPast = (date: unknown) => typeof date === "string" && new Date(date).getTime() <= Date.now();

// Extras from the offer an account bought through, while they still apply:
// the subscription is active, and they haven't run out with the intro price
// (`ends: "discount"`) or after a set duration (`ends_at`).
function offerExtras(namespace: Json): { entitlements: EntitlementRef[]; addons: string[] } | null {
  const sub = namespace.subscription;
  const extras = sub?.extras;
  if (!extras || sub.status !== "active") return null;
  if (extras.ends === "discount" && !(sub.discounted_cycles_left > 0)) return null;
  if (isPast(extras.ends_at)) return null;
  return { entitlements: extras.entitlements ?? [], addons: extras.addons ?? [] };
}

// The limit that applies to one entitlement for a namespace: the plan's,
// overridden by the offer extras, then by an unexpired incentive. `undefined`
// when none of them include it, `null` when it is unlimited.
export async function effectiveLimit(appId: string, namespace: Json, entitlementId: string) {
  const incentiveId = namespace.incentive && !isPast(namespace.incentive_expires_at) ? namespace.incentive : null;
  const [plan, incentive] = await Promise.all([
    getDoc("plans", appId, namespace.plan),
    incentiveId ? getDoc("incentives", appId, incentiveId) : null,
  ]);
  const find = (list: EntitlementRef[] | undefined) => list?.find((e) => e.id === entitlementId);
  const ref = find(incentive?.entitlements) ?? find(offerExtras(namespace)?.entitlements) ?? find(plan?.entitlements);
  return ref ? (ref.max ?? null) : undefined;
}

// Resolves a namespace's effective plan in three layers, each overriding the
// one before for matching entitlement ids: the plan, then extras from the offer
// the account bought through, then the incentive (skipped once
// `incentive_expires_at` passes). Add-ons from all three are merged with the
// account's own. Includes current usage for each entitlement.
export async function buildNamespacePlan(appId: string, namespaceId: string) {
  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) return null;

  const incentiveId = namespace.incentive && !isPast(namespace.incentive_expires_at) ? namespace.incentive : null;
  const [plan, incentive] = await Promise.all([
    getDoc("plans", appId, namespace.plan),
    incentiveId ? getDoc("incentives", appId, incentiveId) : null,
  ]);

  if (!plan) return "plan_not_found" as const;

  const extras = offerExtras(namespace);
  const merged = new Map<string, EntitlementRef>();
  for (const e of plan.entitlements ?? []) merged.set(e.id, e);
  for (const e of extras?.entitlements ?? []) merged.set(e.id, e);
  for (const e of incentive?.entitlements ?? []) merged.set(e.id, e);
  const refs = [...merged.values()];

  const addons = [
    ...new Set([
      ...(plan.addons ?? []),
      ...(extras?.addons ?? []),
      ...(incentive?.addons ?? []),
      ...(namespace.addons ?? []),
    ]),
  ];

  const ids = refs.map((e) => e.id);
  const [details, usageRows] = await Promise.all([
    getDocs("entitlements", appId, ids),
    ids.length
      ? sql`
          select entitlement_id, count::float8 as count
          from usage_counters
          where app_id = ${appId} and namespace_id = ${namespaceId}
            and entitlement_id in (select jsonb_array_elements_text(${ids}::jsonb))`
      : [],
  ]);
  const usageById = new Map<string, number>(
    usageRows.map((r: { entitlement_id: string; count: number }) => [r.entitlement_id, r.count]),
  );

  const entitlements = refs.map((e) => {
    const detail = details.get(e.id);
    const usage = usageById.get(e.id) ?? 0;
    const max = e.max ?? null;
    return {
      id: e.id,
      feature: e.id,
      name: detail?.name ?? e.id,
      type: detail?.type ?? "usage",
      usage,
      max,
      left: max !== null ? Math.max(0, max - usage) : null,
      can: max !== null ? usage < max : true,
    };
  });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      isFree: plan.isFree ?? false,
      meta: (plan.meta ?? {}) as Record<string, unknown>,
      privateMetaKeys: (plan.privateMetaKeys ?? []) as string[],
    },
    incentive: incentiveId,
    offer: namespace.subscription?.status === "active" ? (namespace.subscription.offer_id ?? null) : null,
    addons,
    entitlements,
  };
}
