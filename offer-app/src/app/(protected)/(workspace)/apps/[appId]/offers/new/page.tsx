import type { Metadata } from "next";
import { NewOffer } from "./new-offer";

export const metadata: Metadata = { title: "New offer" };

export default async function NewOfferPage({ searchParams }: PageProps<"/apps/[appId]/offers/new">) {
  const { from } = await searchParams;
  return <NewOffer from={typeof from === "string" ? from : null} />;
}
