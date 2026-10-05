import type { NextRequest } from "next/server";

// JSON 404 for unknown API routes (instead of the HTML not-found page).
function notFound(req: NextRequest) {
  return Response.json({ error: `Route not found: ${req.method} ${req.nextUrl.pathname}` }, { status: 404 });
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
