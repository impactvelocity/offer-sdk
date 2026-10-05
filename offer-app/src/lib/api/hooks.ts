"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { api, type AccountFilters } from "./client";
import type { AnalyticsInterval, TopAccountUsage, WebhookDeliveryStatus } from "./types";

/** The app id from the current /apps/[appId] route. */
export function useAppId(): string {
  const params = useParams<{ appId: string }>();
  return decodeURIComponent(params.appId);
}

export const keys = {
  workspace: ["workspace"] as const,
  apps: ["apps"] as const,
  app: (appId: string) => ["app", appId] as const,
  entitlements: (appId: string) => ["app", appId, "entitlements"] as const,
  addons: (appId: string) => ["app", appId, "addons"] as const,
  plans: (appId: string) => ["app", appId, "plans"] as const,
  plan: (appId: string, planId: string) => ["app", appId, "plans", planId] as const,
  incentives: (appId: string) => ["app", appId, "incentives"] as const,
  incentive: (appId: string, id: string) => ["app", appId, "incentives", id] as const,
  offers: (appId: string) => ["app", appId, "offers"] as const,
  offer: (appId: string, id: string) => ["app", appId, "offers", id] as const,
  paypal: (appId: string) => ["app", appId, "paypal"] as const,
  accounts: (appId: string) => ["app", appId, "accounts"] as const,
  account: (appId: string, id: string) => ["app", appId, "accounts", "detail", id] as const,
  analytics: (appId: string) => ["app", appId, "analytics"] as const,
  reports: (appId: string) => ["app", appId, "reports"] as const,
  webhooks: (appId: string) => ["app", appId, "webhooks"] as const,
  webhook: (appId: string, id: string) => ["app", appId, "webhooks", id] as const,
};

export function useWorkspace() {
  return useQuery({ queryKey: keys.workspace, queryFn: api.workspace.get, staleTime: Infinity });
}

export function useApps() {
  return useQuery({ queryKey: keys.apps, queryFn: api.workspace.apps });
}

export function useApp(appId: string) {
  return useQuery({ queryKey: [...keys.app(appId), "detail"], queryFn: () => api.apps.get(appId) });
}

export function useEntitlements(appId: string) {
  return useQuery({ queryKey: keys.entitlements(appId), queryFn: () => api.entitlements.list(appId), enabled: Boolean(appId) });
}

export function useAddons(appId: string) {
  return useQuery({ queryKey: keys.addons(appId), queryFn: () => api.addons.list(appId), enabled: Boolean(appId) });
}

export function usePlans(appId: string) {
  return useQuery({ queryKey: keys.plans(appId), queryFn: () => api.plans.list(appId), enabled: Boolean(appId) });
}

export function usePlan(appId: string, planId: string | null | undefined) {
  return useQuery({
    queryKey: keys.plan(appId, planId ?? ""),
    queryFn: () => api.plans.get(appId, planId!),
    enabled: Boolean(appId && planId),
  });
}

export function usePlanAccounts(appId: string, planId: string, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...keys.plan(appId, planId), "accounts", page, perPage],
    queryFn: () => api.plans.accounts(appId, planId, page, perPage),
    placeholderData: keepPreviousData,
  });
}

export function useIncentives(appId: string) {
  return useQuery({ queryKey: keys.incentives(appId), queryFn: () => api.incentives.list(appId), enabled: Boolean(appId) });
}

export function useIncentive(appId: string, id: string | null | undefined) {
  return useQuery({
    queryKey: keys.incentive(appId, id ?? ""),
    queryFn: () => api.incentives.get(appId, id!),
    enabled: Boolean(appId && id),
  });
}

export function useIncentiveAccounts(appId: string, id: string, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...keys.incentive(appId, id), "accounts", page, perPage],
    queryFn: () => api.incentives.accounts(appId, id, page, perPage),
    placeholderData: keepPreviousData,
  });
}

export function useOffers(appId: string) {
  return useQuery({ queryKey: keys.offers(appId), queryFn: () => api.offers.list(appId), enabled: Boolean(appId) });
}

export function useOffer(appId: string, id: string | null | undefined) {
  return useQuery({
    queryKey: keys.offer(appId, id ?? ""),
    queryFn: () => api.offers.get(appId, id!),
    enabled: Boolean(appId && id),
  });
}

export function useOfferStats(appId: string, id: string) {
  return useQuery({ queryKey: [...keys.offer(appId, id), "stats"], queryFn: () => api.offers.stats(appId, id) });
}

export function useOfferCheckouts(appId: string, id: string) {
  return useQuery({
    queryKey: [...keys.offer(appId, id), "checkouts"],
    queryFn: () => api.offers.checkouts(appId, { offer: id, limit: 50 }),
  });
}

export function usePaypal(appId: string) {
  return useQuery({ queryKey: keys.paypal(appId), queryFn: () => api.paypal.get(appId), enabled: Boolean(appId), retry: false });
}

export function useAccounts(appId: string, filters: AccountFilters) {
  return useQuery({
    queryKey: [...keys.accounts(appId), "list", filters],
    queryFn: () => api.accounts.list(appId, filters),
    placeholderData: keepPreviousData,
  });
}

export function useAccountCount(appId: string) {
  return useQuery({
    queryKey: [...keys.accounts(appId), "count"],
    queryFn: () => api.accounts.count(appId),
    enabled: Boolean(appId),
  });
}

export function useAccount(appId: string, id: string) {
  return useQuery({ queryKey: keys.account(appId, id), queryFn: () => api.accounts.get(appId, id) });
}

export function useResolvedAccess(appId: string, id: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...keys.account(appId, id), "full-plan"],
    queryFn: () => api.accounts.fullPlan(appId, id),
    enabled,
    retry: false,
  });
}

export function useAnalyticsSummary(appId: string, interval: AnalyticsInterval, namespace?: string) {
  return useQuery({
    queryKey: [...keys.analytics(appId), "summary", interval, namespace ?? null],
    queryFn: () => api.analytics.summary(appId, interval, namespace),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsTimeseries(appId: string, interval: AnalyticsInterval, namespace?: string) {
  return useQuery({
    queryKey: [...keys.analytics(appId), "timeseries", interval, namespace ?? null],
    queryFn: () => api.analytics.timeseries(appId, interval, { namespace }),
    placeholderData: keepPreviousData,
  });
}

/** Several entitlements are fetched one by one and merged (the API filters by a single id). */
export function useTopAccounts(
  appId: string,
  interval: AnalyticsInterval,
  entitlement?: string | readonly string[],
  limit = 10,
) {
  const ids = entitlement === undefined ? [] : typeof entitlement === "string" ? [entitlement] : [...entitlement].sort();
  return useQuery({
    queryKey: [...keys.analytics(appId), "top", interval, ids.length ? ids : null, limit],
    queryFn: async () => {
      if (ids.length <= 1) return api.analytics.topAccounts(appId, interval, { entitlement: ids[0], limit });
      // Each list is cut at `limit`, so accounts near the cutoff can be under-counted.
      const lists = await Promise.all(ids.map((id) => api.analytics.topAccounts(appId, interval, { entitlement: id, limit })));
      const merged = new Map<string, TopAccountUsage>();
      for (const row of lists.flat()) {
        const prev = merged.get(row.namespace_id);
        merged.set(row.namespace_id, {
          namespace_id: row.namespace_id,
          calls: (prev?.calls ?? 0) + row.calls,
          total_amount: (prev?.total_amount ?? 0) + row.total_amount,
        });
      }
      return [...merged.values()]
        .sort((a, b) => b.calls - a.calls || a.namespace_id.localeCompare(b.namespace_id))
        .slice(0, limit);
    },
    placeholderData: keepPreviousData,
  });
}

export function useSavedReports(appId: string) {
  return useQuery({ queryKey: keys.reports(appId), queryFn: () => api.analytics.reports.list(appId), enabled: Boolean(appId) });
}

export function useUsageEvents(appId: string, opts: { namespace?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: [...keys.analytics(appId), "events", opts.namespace ?? null, opts.limit ?? 50],
    queryFn: () => api.analytics.events(appId, opts),
  });
}

export function useWebhooks(appId: string) {
  return useQuery({ queryKey: keys.webhooks(appId), queryFn: () => api.webhooks.list(appId), enabled: Boolean(appId) });
}

export function useWebhook(appId: string, id: string) {
  return useQuery({ queryKey: [...keys.webhook(appId, id), "detail"], queryFn: () => api.webhooks.get(appId, id) });
}

export function useWebhookDeliveries(appId: string, id: string, status?: WebhookDeliveryStatus) {
  return useQuery({
    queryKey: [...keys.webhook(appId, id), "deliveries", status ?? null],
    queryFn: () => api.webhooks.deliveries(appId, id, { status, limit: 100 }),
    placeholderData: keepPreviousData,
    // New events are delivered in the background; poll while the page is open.
    refetchInterval: 5000,
  });
}

export function useWebhookEvents(appId: string, type?: string) {
  return useQuery({
    queryKey: [...keys.webhooks(appId), "events", type ?? null],
    queryFn: () => api.webhooks.events(appId, { type, limit: 100 }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });
}

interface MutationOptions<TData, TVars> {
  /** Toast shown on success. */
  success?: string | ((data: TData, vars: TVars) => string);
  /** Query keys to invalidate. Defaults to everything under the current app. */
  invalidate?: QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  /** Set false when the caller shows errors inline. */
  toastError?: boolean;
}

/** Mutation with error toasts and broad cache invalidation, so counts and lists never go stale. */
export function useApiMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  { success, invalidate, onSuccess, toastError = true }: MutationOptions<TData, TVars> = {},
) {
  const queryClient = useQueryClient();
  const params = useParams<{ appId?: string }>();
  const appId = params.appId ? decodeURIComponent(params.appId) : undefined;

  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      const targets = invalidate ?? (appId ? [keys.app(appId)] : [keys.apps]);
      await Promise.all(targets.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      await onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (toastError) toast.error(error instanceof Error ? error.message : "Something went wrong");
    },
  });
}
