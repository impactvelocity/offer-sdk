import { handler } from "@/server/http";
import { listActiveOffers } from "@/server/offers";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return Response.json({ data: await listActiveOffers() });
});
