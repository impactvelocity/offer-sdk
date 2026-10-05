"use client";

import { SearchX } from "lucide-react";
import { EditorSkeleton, OfferEditor } from "@/components/offers/offer-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppId, useOffer } from "@/lib/api/hooks";

export function EditOffer({ offerId }: { offerId: string }) {
  const appId = useAppId();
  const { data: offer, isLoading, error } = useOffer(appId, offerId);
  if (isLoading) return <EditorSkeleton crumbs="Edit offer" />;
  if (error || !offer) {
    return <EmptyState icon={<SearchX />} title="Offer not found" description={`There's no offer with the ID “${offerId}” in this app.`} />;
  }
  // Remount when the saved offer changes so the form starts from it.
  return <OfferEditor key={offer.id} appId={appId} offer={offer} />;
}
