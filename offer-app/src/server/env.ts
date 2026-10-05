import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

// `next dev` defaults to the API running locally (`docker compose up` at the repo root)
// with its development admin key. OFFER_API_URL=mock uses the in-memory mock instead.
// Builds, production and tests get no defaults: there, an unset OFFER_API_URL means the mock.
const isDev = process.env.NODE_ENV === "development";
const LOCAL_API_URL = "http://localhost:6767";
const LOCAL_ADMIN_KEY = "dev-admin-key"; // the API's ADMIN_API_KEY in development

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Origins allowed to call the public API from the browser (where the SDK is embedded).
  // "*" allows any origin; otherwise a comma-separated list.
  CORS_ORIGINS: z
    .string()
    .default("*")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),

  // Hosted Offer API (../api), public URL: shown in snippets and used by tenant code.
  // "mock" (or unset outside `next dev`) uses the built-in in-memory mock.
  OFFER_API_URL: optional.pipe(z.url().optional()),
  // Optional private address this server uses instead (e.g. Render's private network,
  // "honeypot-api:10000"). A bare host:port means http.
  OFFER_API_INTERNAL_URL: optional
    .transform((value) => (value && !/^https?:\/\//.test(value) ? `http://${value}` : value))
    .pipe(z.url().optional()),
  // The hosted API's ADMIN_API_KEY: shared secret for the BFF and the auth proxy.
  // In mock mode, the admin key /api/mock accepts (random per process when unset).
  OFFER_API_ADMIN_KEY: optional,

  // Mock mode only: better-auth runs in this process. With the hosted API, auth runs
  // there and these are set on the API service instead.
  BETTER_AUTH_SECRET: optional,
  BETTER_AUTH_URL: optional.pipe(z.url().optional()),

  // Show "Explore the demo workspace" on the sign-in page with the hosted API (seed it
  // first with `pnpm seed:demo`). The mock always has its demo. Defaults to on under `next dev`.
  DEMO_ENABLED: optional.transform((value) => (value ?? (isDev ? "true" : "false")) === "true"),

  // Agent chat (AI SDK + Anthropic). Without it the Agent page explains how to enable it.
  ANTHROPIC_API_KEY: optional,
  // Signs the agent's tool approvals. Optional: derived from another server secret when unset.
  // Set the same value on every instance when running more than one.
  AGENT_APPROVAL_SECRET: optional,

  // The PayPal checkout demo at /demo/checkout: an app and its publishable key
  // (api/scripts/seed-demo.ts prints both). `?app=&key=` on the URL override them.
  DEMO_APP_ID: optional,
  DEMO_PUBLISHABLE_KEY: optional,
});

const input: Record<string, string | undefined> = { ...process.env };
if (isDev) {
  input.OFFER_API_URL ||= LOCAL_API_URL;
  input.OFFER_API_ADMIN_KEY ||= LOCAL_ADMIN_KEY;
}
if (input.OFFER_API_URL?.trim() === "mock") delete input.OFFER_API_URL;

const parsed = schema.safeParse(input);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`,
  );
}

if (parsed.data.OFFER_API_URL && !parsed.data.OFFER_API_ADMIN_KEY) {
  throw new Error("OFFER_API_ADMIN_KEY is required when OFFER_API_URL is set (use the API's ADMIN_API_KEY)");
}

export const env = parsed.data;
