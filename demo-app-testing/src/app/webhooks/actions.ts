"use server";

import { redirect } from "next/navigation";
import { withNotice } from "@/components/flash";
import { db } from "@/db";
import { flashing } from "@/lib/actions";
import { OfferApiError, offerApi } from "@/lib/offer/client";
import { writeSettings } from "@/lib/offer/config";

async function endpoint() {
  const api = await offerApi();
  if (!api.config.webhookId) redirect(withNotice("/webhooks", "No webhook endpoint yet. Run Setup.", "alert"));
  return { api, path: `/webhooks/${api.config.webhookId}` };
}

export async function sendTest(form: FormData) {
  const { api, path } = await endpoint();
  const type = String(form.get("type") || "account.created");
  let delivery: { status: string; response_status: number | null; error?: string | null };
  try {
    delivery = await api.post(`${path}/test`, { type });
  } catch (err) {
    if (!(err instanceof OfferApiError)) throw err;
    redirect(withNotice("/webhooks", `${err.status}: ${err.message}`, "alert"));
  }
  const ok = delivery.status === "succeeded";
  const detail = delivery.response_status ? `HTTP ${delivery.response_status}` : (delivery.error ?? "no response");
  redirect(withNotice("/webhooks", `Test ${type}: ${delivery.status} (${detail})`, ok ? "notice" : "alert"));
}

export async function toggle(enabled: boolean) {
  const { api, path } = await endpoint();
  await flashing("/webhooks", enabled ? "Endpoint enabled." : "Endpoint disabled.", () => api.patch(path, { enabled }));
}

export async function regenerateSecret() {
  const { api, path } = await endpoint();
  await flashing("/webhooks", "Secret regenerated and saved.", async () => {
    const { secret } = await api.post<{ secret: string }>(`${path}/secret/regenerate`);
    await writeSettings({ webhook_secret: secret });
  });
}

/** Forget the secret locally so the next delivery fails verification (401) and gets retried. */
export async function breakSecret() {
  await writeSettings({ webhook_secret: "whsec_d3Jvbmctc2VjcmV0LXdyb25nLXNlY3JldA==" });
  redirect(withNotice("/webhooks", "Local secret replaced with a wrong one: deliveries will now fail with 401."));
}

export async function retry(deliveryId: string) {
  const { api, path } = await endpoint();
  await flashing("/webhooks", `Delivery ${deliveryId} retried.`, () => api.post(`${path}/deliveries/${deliveryId}/retry`));
}

export async function clearReceived() {
  await db.deleteFrom("webhook_events").execute();
  redirect(withNotice("/webhooks", "Cleared received events."));
}
