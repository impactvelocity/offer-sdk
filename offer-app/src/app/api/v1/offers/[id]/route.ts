import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, handler } from "@/server/http";
import { findOffer } from "@/server/offers";

const params = z.object({ id: z.string().min(1) });

export const GET = handler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/offers/[id]">) => {
  const { id } = params.parse(await ctx.params);
  const offer = await findOffer(id);
  if (!offer) throw new HttpError(404, `Offer not found: ${id}`);
  return Response.json({ data: offer });
});
