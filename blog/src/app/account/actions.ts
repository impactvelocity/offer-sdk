"use server";

import { redirect } from "next/navigation";
import { withNotice } from "@/components/flash";
import { accountPath, ensureAccount } from "@/lib/offer/account";
import { OfferApiError, offerApi } from "@/lib/offer/client";
import { PROMO_CODES } from "@/lib/offer/catalog";
import type { LimitReached } from "@/lib/offer/types";
import { requireUser } from "@/lib/session";

// Every action here is one Offer API call on the signed-in user's account,
// then back to /account with the outcome as the flash.

async function run(label: string, fn: (path: string) => Promise<unknown>): Promise<never> {
  const user = await requireUser();
  const api = await offerApi();
  await ensureAccount(api, user);
  let message = label;
  let kind: "notice" | "alert" = "notice";
  try {
    await fn(accountPath(user.id));
  } catch (err) {
    kind = "alert";
    if (err instanceof OfferApiError) {
      const limit = err.status === 402 ? (err.body as LimitReached) : null;
      message = `${err.status}: ${limit?.message ?? err.message}`;
    } else throw err;
  }
  redirect(withNotice("/account", message, kind));
}

const api = () => offerApi();

export async function usage(entitlement: string, op: "add" | "remove") {
  await run(`usage/${entitlement}/${op} ok.`, async (p) => (await api()).post(`${p}/usage/${entitlement}/${op}`));
}

export async function setAmount(entitlement: string, form: FormData) {
  const amount = Number(form.get("amount"));
  await run(`usage/${entitlement}/amount ${amount} ok.`, async (p) => (await api()).post(`${p}/usage/${entitlement}/amount`, { amount }));
}

export async function changePlan(form: FormData) {
  const plan = String(form.get("plan"));
  await run(`Plan changed to ${plan} (no payment: PATCH /namespaces/:id).`, async (p) => (await api()).patch(p, { plan }));
}

export async function applyPromo(form: FormData) {
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const incentive = PROMO_CODES[code];
  if (!incentive) redirect(withNotice("/account", `Promo code "${code}" is invalid. Try BETA.`, "alert"));
  const minutes = Number(form.get("expires") || 0);
  const incentive_expires_at = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
  await run(`Promo code ${code} applied (incentive ${incentive}).`, async (p) => (await api()).patch(p, { incentive, incentive_expires_at }));
}

export async function removeIncentive() {
  await run("Incentive removed.", async (p) => (await api()).del(`${p}/incentive`));
}

export async function grantAddon(addon: string) {
  await run(`Add-on ${addon} granted.`, async (p) => (await api()).post(`${p}/addons`, { id: addon }));
}

export async function revokeAddon(addon: string) {
  await run(`Add-on ${addon} removed.`, async (p) => (await api()).del(`${p}/addons/${addon}`));
}

export async function rename(form: FormData) {
  const name = String(form.get("name") ?? "");
  await run("Account renamed.", async (p) => (await api()).patch(p, { name }));
}

export async function subscription(op: "sync" | "cancel") {
  await run(`subscription/${op} ok.`, async (p) => (await api()).post(`${p}/subscription/${op}`));
}

/** DELETE /namespaces/:id. The next page view recreates it on Free with zeroed usage. */
export async function resetAccount() {
  const user = await requireUser();
  await (await offerApi()).del(accountPath(user.id));
  redirect(withNotice("/account", "Offer account deleted; recreated on Free."));
}
