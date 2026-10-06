"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withNotice } from "@/components/flash";
import { appApi } from "@/lib/offer/client";
import { offerConfig, writeSettings } from "@/lib/offer/config";
import { attachToOrg, runSetup, type GeneratorLine } from "@/lib/offer/setup";

export interface SetupState {
  lines?: GeneratorLine[];
  error?: string;
}

export async function generate(_: SetupState, form: FormData): Promise<SetupState> {
  try {
    const lines = await runSetup(String(form.get("name") || "Rails Blog"));
    revalidatePath("/", "layout");
    return { lines };
  } catch (err) {
    return { error: err instanceof Error ? `${err.message}. Is the Offer API running? (pnpm dev:api)` : String(err) };
  }
}

export async function attach(form: FormData) {
  const config = await offerConfig();
  const orgId = String(form.get("org") ?? "");
  if (!config || !orgId) redirect("/setup");
  await attachToOrg(orgId, config.appId);
  redirect(withNotice("/setup", `Added ${config.appId} to workspace ${orgId}. It now shows in the dashboard.`));
}

/** Forgets the app; with destroy=1 also deletes it (and everything in it) from the API. */
export async function disconnect(form: FormData) {
  const config = await offerConfig();
  if (config && form.get("destroy") === "1") await appApi(config).del("");
  await writeSettings({ app_id: null, secret_key: null, public_key: null, webhook_id: null, webhook_secret: null });
  redirect(withNotice("/setup", form.get("destroy") === "1" ? "App deleted from the Offer API." : "Disconnected."));
}
