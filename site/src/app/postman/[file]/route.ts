// Serves the Offer API's Postman collection and environment for download, and for
// Postman's Import → Link. The files are generated in api/postman (bun run postman).
import collection from "../../../../../api/postman/offer-api.postman_collection.json";
import environment from "../../../../../api/postman/offer-api.postman_environment.json";

const FILES: Record<string, unknown> = {
  "offer-api.postman_collection.json": collection,
  "offer-api.postman_environment.json": environment,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_req: Request, ctx: RouteContext<"/postman/[file]">) {
  const { file } = await ctx.params;
  return Response.json(FILES[file], {
    headers: { "Content-Disposition": `attachment; filename="${file}"`, "Access-Control-Allow-Origin": "*" },
  });
}
