import "server-only";
import { db } from "@/db";

export const OFFER_API_URL = (process.env.OFFER_API_URL ?? "http://localhost:6767").replace(/\/+$/, "");
export const OFFER_ADMIN_KEY = process.env.OFFER_ADMIN_KEY ?? (process.env.NODE_ENV === "production" ? undefined : "dev-admin-key");
export const OFFER_APP_URL = (process.env.OFFER_APP_URL ?? "http://localhost:6768").replace(/\/+$/, "");
export const BLOG_URL = (process.env.BLOG_URL ?? "http://localhost:6770").replace(/\/+$/, "");
export const WEBHOOK_URL = process.env.OFFER_WEBHOOK_URL ?? "http://host.docker.internal:6770/api/webhooks";

export interface OfferConfig {
  appId: string;
  secretKey: string;
  publicKey: string;
  webhookId?: string;
  webhookSecret?: string;
}

type Key = "app_id" | "secret_key" | "public_key" | "webhook_id" | "webhook_secret";

export async function readSettings(): Promise<Partial<Record<Key, string>>> {
  const rows = await db.selectFrom("offer_settings").selectAll().execute();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function writeSettings(values: Partial<Record<Key, string | null>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      await db.deleteFrom("offer_settings").where("key", "=", key).execute();
    } else {
      await db
        .insertInto("offer_settings")
        .values({ key, value })
        .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
        .execute();
    }
  }
}

/** The Offer app this blog sells through: env vars win, else what /setup saved. */
export async function offerConfig(): Promise<OfferConfig | null> {
  const s = await readSettings();
  const appId = process.env.OFFER_APP_ID ?? s.app_id;
  const secretKey = process.env.OFFER_SECRET_KEY ?? s.secret_key;
  const publicKey = process.env.OFFER_PUBLIC_KEY ?? s.public_key;
  if (!appId || !secretKey || !publicKey) return null;
  return { appId, secretKey, publicKey, webhookId: s.webhook_id, webhookSecret: s.webhook_secret };
}
