import type { Offer } from "@/sdk/types";

// Placeholder in-memory data until a real datastore is wired up.
const offers: Offer[] = [
  { id: "welcome-10", title: "10% off your first order", description: "Applies to any plan.", active: true },
  { id: "annual-2mo", title: "2 months free", description: "When you switch to annual billing.", active: true },
];

export async function listActiveOffers(): Promise<Offer[]> {
  return offers.filter((offer) => offer.active);
}

export async function findOffer(id: string): Promise<Offer | undefined> {
  return offers.find((offer) => offer.id === id);
}
