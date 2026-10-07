// Calls the Offer API's admin-only /pauses routes. The API owns the logic
// (PayPal, plans, webhooks); these tasks give it durable retries and a run log.

const base = () => {
  const url = process.env.OFFER_API_URL;
  if (!url) throw new Error("OFFER_API_URL is not set");
  return url.replace(/\/+$/, "");
};

/** A conflict the API reported (already paused, not paused…): retrying won't help. */
export class Skipped extends Error {}

export async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 404 || res.status === 409) throw new Skipped(json.error ?? `HTTP ${res.status}`);
  // Anything else (PayPal down, 5xx, network) throws so Render retries the task.
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${json.error ?? "unknown error"}`);
  return json as T;
}
