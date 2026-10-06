import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { db, now } from "@/db";
import { offerConfig } from "@/lib/offer/config";

// Receives the Offer API's webhooks. Signatures follow Standard Webhooks:
// the secret is `whsec_<base64>`, and the library wants the base64 part.
export async function POST(req: Request) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);
  const config = await offerConfig();

  let verified = false;
  let error: string | null = null;
  if (config?.webhookSecret) {
    try {
      new Webhook(config.webhookSecret.slice("whsec_".length)).verify(body, headers);
      verified = true;
    } catch (err) {
      error = err instanceof WebhookVerificationError ? err.message : String(err);
    }
  } else {
    error = "no webhook secret saved (run /setup)";
  }

  let type = "unknown";
  try {
    type = (JSON.parse(body) as { type?: string }).type ?? type;
  } catch {
    // stored as-is below
  }

  const id = headers["webhook-id"] ?? `unsigned_${Date.now()}`;
  await db
    .insertInto("webhook_events")
    .values({ id, type, payload: body, verified: verified ? 1 : 0, received_at: now() })
    .onConflict((oc) => oc.column("id").doNothing()) // retries reuse the event id
    .execute();

  if (!verified) return Response.json({ error }, { status: 401 });
  return Response.json({ received: true });
}
