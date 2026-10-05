"use client";

import { EditorSkeleton, OfferEditor } from "@/components/offers/offer-editor";
import { useAppId, useOffer } from "@/lib/api/hooks";

/** A blank offer, or a copy of `from` (the Duplicate action). */
export function NewOffer({ from }: { from: string | null }) {
  const appId = useAppId();
  const source = useOffer(appId, from);
  if (from && source.isLoading) return <EditorSkeleton crumbs="New offer" />;
  return <OfferEditor appId={appId} source={source.data ?? null} />;
}
