import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM for secrets kept in Postgres (PayPal client secrets). The key
// comes from SECRETS_KEY, falling back to the auth secret and then the admin
// key so local development needs no extra setup. Changing it makes stored
// secrets unreadable, so apps would have to reconnect PayPal.
function key() {
  const source = process.env.SECRETS_KEY || process.env.BETTER_AUTH_SECRET || process.env.ADMIN_API_KEY;
  if (!source) throw new Error("SECRETS_KEY is not set");
  return createHash("sha256").update(source).digest();
}

// "v1.<iv>.<tag>.<ciphertext>", all base64url.
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
