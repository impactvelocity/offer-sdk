import { api } from "./api/client";
import type { Incentive, Plan } from "./api/types";

// Multi-call operations the API doesn't offer directly.

/** Copies everything about a plan: limits, add-ons, meta (incl. private keys), pricing card and flags. */
export async function duplicatePlan(appId: string, source: Plan, target: { id: string; name: string }) {
  const plan = await api.plans.create(appId, {
    id: target.id,
    name: target.name,
    description: source.description ?? null,
    isFree: source.isFree ?? false,
    note: source.note ?? null,
    pricingCard: source.pricingCard ? { ...source.pricingCard, title: target.name } : null,
  });
  for (const e of source.entitlements) await api.plans.addEntitlement(appId, plan.id, e.id, e.max);
  for (const id of source.addons) await api.plans.addAddon(appId, plan.id, id);
  if (Object.keys(source.meta ?? {}).length) await api.plans.updateMeta(appId, plan.id, source.meta);
  if (source.privateMetaKeys?.length) await api.plans.update(appId, plan.id, { privateMetaKeys: source.privateMetaKeys });
  return plan;
}

export async function duplicateIncentive(appId: string, source: Incentive, target: { id: string; name: string }) {
  const incentive = await api.incentives.create(appId, {
    id: target.id,
    name: target.name,
    description: source.description ?? null,
  });
  for (const e of source.entitlements) await api.incentives.addEntitlement(appId, incentive.id, e.id, e.max);
  for (const id of source.addons) await api.incentives.addAddon(appId, incentive.id, id);
  return incentive;
}

/** The API doesn't cascade deletes, so detach from every plan and incentive first. */
export async function deleteEntitlement(appId: string, id: string, plans: Plan[], incentives: Incentive[]) {
  for (const p of plans) if (p.entitlements.some((e) => e.id === id)) await api.plans.removeEntitlement(appId, p.id, id);
  for (const i of incentives) if (i.entitlements.some((e) => e.id === id)) await api.incentives.removeEntitlement(appId, i.id, id);
  return api.entitlements.delete(appId, id);
}

export async function deleteAddon(appId: string, id: string, plans: Plan[], incentives: Incentive[]) {
  for (const p of plans) if (p.addons.includes(id)) await api.plans.removeAddon(appId, p.id, id);
  for (const i of incentives) if (i.addons.includes(id)) await api.incentives.removeAddon(appId, i.id, id);
  return api.addons.delete(appId, id);
}
