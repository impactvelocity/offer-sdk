"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "./api/client";
import { keys } from "./api/hooks";

/** Number of accounts on each plan (one lightweight request per plan). */
export function usePlanAccountTotals(appId: string, planIds: string[]) {
  return useQueries({
    queries: planIds.map((planId) => ({
      queryKey: [...keys.plan(appId, planId), "accounts", 1, 1],
      queryFn: () => api.plans.accounts(appId, planId, 1, 1),
    })),
    combine: (results) =>
      Object.fromEntries(planIds.map((id, i) => [id, results[i]?.data?.total])) as Record<string, number | undefined>,
  });
}
