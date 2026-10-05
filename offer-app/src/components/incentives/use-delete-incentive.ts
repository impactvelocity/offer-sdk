"use client";

import { useConfirm } from "@/components/ui/confirm";
import { useApiMutation } from "@/lib/api/hooks";
import type { Incentive } from "@/lib/api/types";
import { pluralize } from "@/lib/utils";
import { deleteIncentive } from "./actions";

/** Confirm + cascade delete. `accounts` is how many accounts currently have the incentive (if known). */
export function useDeleteIncentive(appId: string, { onDeleted }: { onDeleted?: () => void } = {}) {
  const confirm = useConfirm();
  const remove = useApiMutation((id: string) => deleteIncentive(appId, id), {
    success: "Incentive deleted",
    onSuccess: onDeleted,
  });

  return (incentive: Incentive, accounts: number | undefined) =>
    confirm({
      title: `Delete ${incentive.name}?`,
      description: accounts
        ? `${pluralize(accounts, "account")} ${accounts === 1 ? "has" : "have"} this incentive — it will be removed from them first, so they fall back to their plan's limits.`
        : "This can't be undone.",
      typeToConfirm: accounts ? incentive.id : undefined,
      confirmLabel: "Delete incentive",
      onConfirm: () => remove.mutateAsync(incentive.id),
    });
}
