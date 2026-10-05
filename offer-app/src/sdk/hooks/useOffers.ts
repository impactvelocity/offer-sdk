"use client";

import { useOfferClient } from "../context";
import type { Offer } from "../types";
import { useAsync, type AsyncState } from "./useAsync";

export function useOffers(): AsyncState<Offer[]> {
  const client = useOfferClient();
  return useAsync((signal) => client.listOffers({ signal }), [client]);
}

export function useOffer(id: string | undefined): AsyncState<Offer> {
  const client = useOfferClient();
  return useAsync((signal) => client.getOffer(id!, { signal }), [client, id], Boolean(id));
}
