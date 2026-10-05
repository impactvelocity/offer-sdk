import { headers } from "next/headers";
import { offerApiServerUrl } from "@/server/offer-api";
import { env } from "@/server/env";

// Hosted mode (OFFER_API_URL set): better-auth runs in the Offer API, next to the data.
// The browser still talks only to this app: /api/auth/* is forwarded to the API with the
// admin key, and the API's Set-Cookie headers come back unchanged, so session cookies
// stay first-party on the dashboard's domain.

// Request headers better-auth needs: the session cookie, the body type, and the
// browser's origin (CSRF check) and IP (rate limits).
const FORWARDED_HEADERS = ["accept", "content-type", "cookie", "origin", "referer", "user-agent", "x-forwarded-for"];

// fetch() has already decoded the body, so these no longer describe it.
const DROPPED_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

function upstream(path: string, from: Headers) {
  const url = new URL(path.replace(/^\//, ""), offerApiServerUrl());
  const forwarded = new Headers({ authorization: `Bearer ${env.OFFER_API_ADMIN_KEY}` });
  for (const name of FORWARDED_HEADERS) {
    const value = from.get(name);
    if (value) forwarded.set(name, value);
  }
  return { url, headers: forwarded };
}

/** Forwards a browser request for /api/auth/* to the API. */
export async function proxyAuthRequest(request: Request): Promise<Response> {
  const { pathname, search } = new URL(request.url);
  const { url, headers: forwarded } = upstream(`${pathname}${search}`, request.headers);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let res: Response;
  try {
    res = await fetch(url, {
      method: request.method,
      headers: forwarded,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (e) {
    console.error("[auth proxy]", e);
    return Response.json({ message: "Could not reach the Offer API" }, { status: 502 });
  }

  const out = new Headers();
  for (const [name, value] of res.headers) {
    if (name !== "set-cookie" && !DROPPED_RESPONSE_HEADERS.has(name)) out.set(name, value);
  }
  for (const cookie of res.headers.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** Server-side better-auth call on behalf of the current request's user. */
export async function remoteAuthCall<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const incoming = await headers();
  const { url, headers: forwarded } = upstream(`/api/auth${path}`, incoming);
  if (body !== undefined) forwarded.set("content-type", "application/json");
  // better-auth checks the Origin of cookie-authenticated POSTs; this app is that origin.
  if (method === "POST" && !forwarded.has("origin")) {
    const host = incoming.get("x-forwarded-host") ?? incoming.get("host");
    const proto = incoming.get("x-forwarded-proto") ?? "http";
    if (host) forwarded.set("origin", `${proto.split(",")[0]}://${host}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: forwarded,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(
      `Can't reach the Offer API at ${url.origin}. Locally, start it with \`pnpm dev:api\`, or set OFFER_API_URL=mock to use the in-memory mock.`,
      { cause: e },
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: string; error?: string } | null)?.message ?? (data as { error?: string })?.error;
    throw new Error(`Offer API auth ${method} ${path} failed (${res.status})${message ? `: ${message}` : ""}`);
  }
  return data as T;
}
