import posthog from "posthog-js";

// Product analytics, only when DEMO_ENABLED is on (see next.config.ts) so other people's
// deployments aren't tracked. The project token is public (it ships in the browser bundle anyway);
// NEXT_PUBLIC_POSTHOG_KEY overrides it, and an empty value turns tracking off.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "phc_wHmU9xGagja5baLnbfXbBsDSepVnU7h5bBB6Do6DAdGs";

if (key && process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true") {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
  });
  // Tag every event so Offer SDK traffic is easy to filter in the shared PostHog project.
  posthog.register({ project: "offersdk", app: "admin" });
}
