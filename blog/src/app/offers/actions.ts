"use server";

import { flashing } from "@/lib/actions";
import { offerApi } from "@/lib/offer/client";
import { requireUser } from "@/lib/session";
import { ensureAccount } from "@/lib/offer/account";

const back = (id?: string) => (id ? `/offers/${id}` : "/offers");

export async function publish(id: string) {
  const api = await offerApi();
  await flashing(back(id), `Offer ${id} published.`, () => api.post(`/offers/${id}/publish`));
}

export async function archive(id: string) {
  const api = await offerApi();
  await flashing(back(id), `Offer ${id} archived.`, () => api.post(`/offers/${id}/archive`));
}

export async function destroy(id: string) {
  const api = await offerApi();
  await flashing(back(), `Offer ${id} deleted.`, () => api.del(`/offers/${id}`));
}

export async function rename(id: string, form: FormData) {
  const api = await offerApi();
  await flashing(back(id), "Offer updated.", () =>
    api.patch(`/offers/${id}`, { name: String(form.get("name")), max_redemptions: Number(form.get("max_redemptions")) || null }),
  );
}

/** A targeted offer: one account only, with an unguessable id. */
export async function createTargeted(form: FormData) {
  const user = await requireUser();
  const api = await offerApi();
  await ensureAccount(api, user);
  const percent = Number(form.get("percent") || 30);
  await flashing(back(), `Targeted offer (${percent}% off) created for ${user.email}.`, () =>
    api.post("/offers", {
      type: "targeted",
      account_id: user.id,
      source: "manual",
      name: `${percent}% off for ${user.name || user.email}`,
      copy: { headline: `A personal ${percent}% off, just for you` },
      discount: { percent, cycles: 6 },
      intervals: ["month", "year"],
      plans: ["pro", "business"],
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    }),
  );
}

export async function createShareable(form: FormData) {
  const api = await offerApi();
  const id = String(form.get("id") || "");
  const amount = Number(form.get("amount_off") || 5);
  await flashing(back(), `Offer ${id} created.`, () =>
    api.post("/offers", { id, name: `$${amount} off`, discount: { amount_off: amount }, plans: ["pro", "business"], max_redemptions: 100 }),
  );
}
