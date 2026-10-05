"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/hooks";

/** Number of accounts with each incentive (one lightweight request per incentive). */
export function useIncentiveAccountTotals(appId: string, incentiveIds: string[]) {
  return useQueries({
    queries: incentiveIds.map((id) => ({
      queryKey: [...keys.incentive(appId, id), "accounts", 1, 1],
      queryFn: () => api.incentives.accounts(appId, id, 1, 1),
    })),
    combine: (results) =>
      Object.fromEntries(incentiveIds.map((id, i) => [id, results[i]?.data?.total])) as Record<string, number | undefined>,
  });
}
