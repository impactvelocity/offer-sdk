"use client";

import { useMemo } from "react";
import {
  useAccounts,
  useAddons,
  useApp,
  useAppId,
  useEntitlements,
  useIncentives,
  usePlans,
  useWebhooks,
  useWorkspace,
} from "@/lib/api/hooks";
import type { Addon, Entitlement, Incentive, Plan } from "@/lib/api/types";
import type { ExampleKey } from "./endpoints";

export type Examples = Record<ExampleKey, string> & { accountName: string | null };

/** Picks representative ids from the app's catalog, with generic fallbacks for empty apps. */
function pickExamples(
  appId: string,
  appName: string,
  data: {
    entitlements: Entitlement[];
    plans: Plan[];
    incentives: Incentive[];
    addons: Addon[];
    account?: { id: string; name: string };
    webhook?: string;
  },
): Examples {
  const { entitlements, plans, incentives, addons, account, webhook } = data;
  const paid = plans.find((p) => !p.isFree && p.pricingCard?.featured) ?? plans.find((p) => !p.isFree) ?? plans[0];
  const free = plans.find((p) => p.isFree) ?? plans[0];
  const usage = entitlements.find((e) => e.type === "usage");
  const incentive = incentives[0];
  const planEntIds = new Set(paid?.entitlements.map((e) => e.id));
  const planAddonIds = new Set(paid?.addons);
  return {
    appId,
    appName,
    account: account?.id ?? "usr_123",
    accountName: account?.name ?? null,
    plan: paid?.id ?? "pro",
    freePlan: free?.id ?? "free",
    pricedPlan: plans.find((p) => p.pricingCard)?.id ?? paid?.id ?? "pro",
    entitlement: entitlements[0]?.id ?? "ai_credits",
    usageEntitlement: usage?.id ?? "ai_credits",
    planEntitlement: paid?.entitlements[0]?.id ?? usage?.id ?? "ai_credits",
    unattachedEntitlement: entitlements.find((e) => !planEntIds.has(e.id))?.id ?? entitlements[0]?.id ?? "sso",
    addon: addons[0]?.id ?? "extra_storage",
    planAddon: paid?.addons[0] ?? addons[0]?.id ?? "extra_storage",
    unattachedAddon: addons.find((a) => !planAddonIds.has(a.id))?.id ?? addons[0]?.id ?? "extra_storage",
    incentive: incentive?.id ?? "summer_promo",
    incentiveEntitlement: incentive?.entitlements[0]?.id ?? usage?.id ?? "ai_credits",
    webhook: webhook ?? "whk_AbCdEfGhIjKlMnOp",
  };
}

/** Replaces {{placeholders}} in strings (deeply) with example ids. */
export function fillExample<T>(value: T, examples: Examples): T {
  if (typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (examples as Record<string, string | null>)[key] ?? match) as T;
  }
  if (Array.isArray(value)) return value.map((v) => fillExample(v, examples)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [fillExample(k, examples), fillExample(v, examples)]),
    ) as T;
  }
  return value;
}

/** Everything the developer pages need: the app, its keys, the API base URL and real example ids. */
export function useDevContext() {
  const appId = useAppId();
  const app = useApp(appId);
  const workspace = useWorkspace();
  const entitlements = useEntitlements(appId);
  const plans = usePlans(appId);
  const incentives = useIncentives(appId);
  const addons = useAddons(appId);
  const accounts = useAccounts(appId, { perPage: 1 });
  const firstAccount = accounts.data?.data[0];
  const webhooks = useWebhooks(appId);

  const examples = useMemo(
    () =>
      pickExamples(appId, app.data?.name ?? "My app", {
        entitlements: entitlements.data ?? [],
        plans: plans.data ?? [],
        incentives: incentives.data ?? [],
        addons: addons.data ?? [],
        account: firstAccount ? { id: firstAccount.id, name: firstAccount.name } : undefined,
        webhook: webhooks.data?.[0]?.id,
      }),
    [appId, app.data?.name, entitlements.data, plans.data, incentives.data, addons.data, firstAccount, webhooks.data],
  );

  return {
    appId,
    app: app.data,
    mode: workspace.data?.mode,
    baseUrl: workspace.data?.apiBaseUrl ?? "",
    entitlements: entitlements.data ?? [],
    plans: plans.data ?? [],
    incentives: incentives.data ?? [],
    addons: addons.data ?? [],
    firstAccount,
    examples,
    /** True until the app, workspace and catalog have loaded. */
    isLoading:
      app.isLoading ||
      workspace.isLoading ||
      entitlements.isLoading ||
      plans.isLoading ||
      incentives.isLoading ||
      addons.isLoading ||
      accounts.isLoading,
    error: app.error ?? workspace.error ?? null,
  };
}

export type DevContext = ReturnType<typeof useDevContext>;
