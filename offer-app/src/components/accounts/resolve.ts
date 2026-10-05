import type { Incentive, Plan } from "@/lib/api/types";

export type AccessSource = "plan" | "incentive" | "override";

export interface ResolvedLimit {
  id: string;
  max: number | null;
  source: AccessSource;
  /** The plan's own limit when an incentive overrides it. */
  planMax?: number | null;
}

/**
 * Same merge the API does in buildNamespacePlan: incentive entitlements override the
 * plan's max for matching ids and add the ones the plan lacks.
 */
export function resolveLimits(plan: Plan | null | undefined, incentive: Incentive | null | undefined) {
  const limits = new Map<string, ResolvedLimit>();
  for (const e of plan?.entitlements ?? []) limits.set(e.id, { id: e.id, max: e.max ?? null, source: "plan" });
  for (const e of incentive?.entitlements ?? []) {
    const fromPlan = limits.get(e.id);
    limits.set(e.id, {
      id: e.id,
      max: e.max ?? null,
      source: fromPlan ? "override" : "incentive",
      planMax: fromPlan?.max,
    });
  }
  return limits;
}

/** Where each granted add-on comes from (plan wins when both grant it). */
export function addonSources(plan: Plan | null | undefined, incentive: Incentive | null | undefined) {
  const sources = new Map<string, "plan" | "incentive">();
  for (const id of incentive?.addons ?? []) sources.set(id, "incentive");
  for (const id of plan?.addons ?? []) sources.set(id, "plan");
  return sources;
}

export const NONE = "__none";
