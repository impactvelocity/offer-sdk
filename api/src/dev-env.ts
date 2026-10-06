// Defaults for local development, so the API runs with no .env next to a local
// Postgres and the dashboard on localhost (`docker compose up` at the repo root
// starts both). Production (NODE_ENV=production, set in the Dockerfile) and tests
// get none of these.
export const isLocalDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

if (isLocalDev) {
  process.env.DATABASE_URL ||= "postgres://postgres:postgres@localhost:5432/offersdk";
  // The dashboard's default OFFER_API_ADMIN_KEY in development.
  process.env.ADMIN_API_KEY ||= "dev-admin-key";
  process.env.PORT ||= "6767";
  // Lets webhooks deliver to receivers on localhost.
  process.env.WEBHOOKS_ALLOW_PRIVATE_URLS ||= "true";
}
