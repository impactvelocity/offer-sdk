import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (env.CORS_ORIGINS.includes("*")) return "*";
  return env.CORS_ORIGINS.includes(origin) ? origin : null;
}

// CORS for the public API so the SDK can be used from other sites.
function cors(request: NextRequest) {
  const origin = allowedOrigin(request.headers.get("origin"));
  const headers: Record<string, string> = { ...corsHeaders, ...(origin && { "Access-Control-Allow-Origin": origin }) };
  if (origin && origin !== "*") headers["Vary"] = "Origin";

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

// /demo is a sample tenant storefront for the checkout SDK.
const PUBLIC_PAGES = ["/sign-in", "/sign-up", "/demo"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The dashboard's own APIs (auth, admin BFF, agent chat) are same-origin; everything else under /api is public.
  if (pathname.startsWith("/api/")) {
    const internal = ["/api/auth/", "/api/admin/"].some((p) => pathname.startsWith(p)) || pathname === "/api/agent";
    return internal ? NextResponse.next() : cors(request);
  }

  // Optimistic check only: layouts verify the session for real.
  if (!PUBLIC_PAGES.some((p) => pathname.startsWith(p)) && !getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
