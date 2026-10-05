"use client";

import { useConfirm } from "@/components/ui/confirm";
import { api } from "@/lib/api/client";
import { keys, useApiMutation } from "@/lib/api/hooks";
import type { Offer } from "@/lib/api/types";
import { pluralize } from "@/lib/utils";

/** Publish, archive and delete, with the confirmations each needs. */
export function useOfferActions(appId: string, { onDeleted }: { onDeleted?: () => void } = {}) {
  const confirm = useConfirm();

  const publish = useApiMutation((offer: Offer) => api.offers.publish(appId, offer.id), {
    success: (offer) => `${offer.name} is live`,
  });
  const archive = useApiMutation((offer: Offer) => api.offers.archive(appId, offer.id), {
    success: (offer) => `${offer.name} archived`,
  });
  const remove = useApiMutation((offer: Offer) => api.offers.delete(appId, offer.id), {
    success: "Offer deleted",
    // Only the list: refetching the deleted offer would 404 before navigating away.
    invalidate: [keys.offers(appId)],
    onSuccess: () => onDeleted?.(),
  });

  return {
    publish,
    archive: (offer: Offer) =>
      confirm({
        title: `Archive ${offer.name}?`,
        description: "Its checkout link falls back to your regular prices. Accounts that already bought keep their price and extras.",
        confirmLabel: "Archive offer",
        onConfirm: () => archive.mutateAsync(offer),
      }),
    remove: (offer: Offer) =>
      confirm({
        title: `Delete ${offer.name}?`,
        description: offer.redemptions
          ? `${pluralize(offer.redemptions, "account")} bought through it and keep their price and extras, but its stats are no longer shown. Archive it instead to keep them.`
          : "Its checkout link falls back to your regular prices. This can't be undone.",
        tone: "danger",
        confirmLabel: "Delete offer",
        onConfirm: () => remove.mutateAsync(offer),
      }),
  };
}
