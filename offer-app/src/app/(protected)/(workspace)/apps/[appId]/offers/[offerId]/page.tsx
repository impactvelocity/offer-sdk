import type { Metadata } from "next";
import { OfferDetail } from "./offer-detail";

export const metadata: Metadata = { title: "Offer" };

export default async function OfferPage({ params }: PageProps<"/apps/[appId]/offers/[offerId]">) {
  const { offerId } = await params;
  return <OfferDetail offerId={decodeURIComponent(offerId)} />;
}
