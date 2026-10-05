import type { Metadata } from "next";
import { EditOffer } from "./edit-offer";

export const metadata: Metadata = { title: "Edit offer" };

export default async function EditOfferPage({ params }: PageProps<"/apps/[appId]/offers/[offerId]/edit">) {
  const { offerId } = await params;
  return <EditOffer offerId={decodeURIComponent(offerId)} />;
}
