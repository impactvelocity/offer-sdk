import { createHmac, timingSafeEqual } from "node:crypto";
import sql from "../db/client.ts";

// Account tokens let a customer's browser act for one account, and nothing
// else. The app's server mints one with its secret key (POST
// /namespaces/:id/token) and hands it to the SDK, the same way Stripe's
// customer portal works. The publishable key alone can never cancel anyone.
//
// Format: `act_<payload>.<signature>`, payload = base64url JSON {a, n, e},
// signed with HMAC-SHA256 under the app's secret key, so rotating the key
// revokes every token.

export const ACCOUNT_TOKEN_PREFIX = "act_";
export const DEFAULT_TOKEN_TTL = 60 * 60; // 1 hour
export const MAX_TOKEN_TTL = 24 * 60 * 60;

type Payload = { a: string; n: string; e: number };

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function mintAccountToken(appId: string, appSecret: string, namespaceId: string, ttlSeconds = DEFAULT_TOKEN_TTL) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ a: appId, n: namespaceId, e: expires } satisfies Payload)).toString(
    "base64url",
  );
  return {
    token: `${ACCOUNT_TOKEN_PREFIX}${payload}.${sign(appSecret, payload)}`,
    expires_at: new Date(expires * 1000).toISOString(),
  };
}

function decode(token: string): { payload: string; sig: string; data: Payload } | null {
  if (!token.startsWith(ACCOUNT_TOKEN_PREFIX)) return null;
  const [payload, sig, extra] = token.slice(ACCOUNT_TOKEN_PREFIX.length).split(".");
  if (!payload || !sig || extra !== undefined) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data?.a !== "string" || typeof data?.n !== "string" || typeof data?.e !== "number") return null;
    return { payload, sig, data };
  } catch {
    return null;
  }
}

// The account id the token is for, or null when it is malformed, expired,
// for another app or not signed with this app's current secret key.
export async function verifyAccountToken(token: string, appId: string): Promise<string | null> {
  const decoded = decode(token);
  if (!decoded || decoded.data.a !== appId || decoded.data.e * 1000 <= Date.now()) return null;
  const [app] = await sql`select api_key from apps where id = ${appId}`;
  if (!app) return null;
  const expected = Buffer.from(sign(app.api_key, decoded.payload));
  const actual = Buffer.from(decoded.sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return decoded.data.n;
}
