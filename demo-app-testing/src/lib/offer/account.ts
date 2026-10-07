import "server-only";
import type { User } from "@/lib/auth";
import { isStatus, type AppApi } from "./client";
import type { Namespace, NamespacePlan } from "./types";

// Each blog user is one Offer account (a "namespace"), keyed by the user id.

const accountPath = (userId: string) => `/namespaces/${encodeURIComponent(userId)}`;

/** The user's account, created on the Free plan the first time it's needed. */
export async function ensureAccount(api: AppApi, user: Pick<User, "id" | "name" | "email">): Promise<Namespace> {
  try {
    return await api.get<Namespace>(accountPath(user.id));
  } catch (err) {
    if (!isStatus(err, 404)) throw err;
  }
  try {
    return await api.post<Namespace>("/namespaces", { id: user.id, name: user.name || user.email, plan: "free" });
  } catch (err) {
    // Another request created it first.
    if (isStatus(err, 409)) return api.get<Namespace>(accountPath(user.id));
    throw err;
  }
}

/** Effective plan: plan, then offer extras, then incentive, with live usage. */
export async function accountPlan(api: AppApi, user: Pick<User, "id" | "name" | "email">): Promise<NamespacePlan> {
  await ensureAccount(api, user);
  return api.get<NamespacePlan>(`${accountPath(user.id)}/plan`);
}

export const can = (plan: NamespacePlan, entitlementId: string) =>
  plan.entitlements.find((e) => e.id === entitlementId)?.can ?? false;

export { accountPath };
