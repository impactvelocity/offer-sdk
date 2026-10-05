import type { Metadata } from "next";
import { env } from "@/server/env";
import { DemoSetup } from "../demo-setup";
import { WelcomeView } from "./welcome-view";

export const metadata: Metadata = { title: "Welcome · Scrapely" };

// After checkout: the tenant app reads the account's access the same way it
// always has (GET /full-plan with the publishable key).
export default async function DemoWelcomePage({ searchParams }: PageProps<"/demo/welcome">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) || null;
  };
  const appId = one("app") ?? env.DEMO_APP_ID;
  const publishableKey = one("key") ?? env.DEMO_PUBLISHABLE_KEY;
  const account = one("account");
  if (!appId || !publishableKey || !env.OFFER_API_URL) return <DemoSetup missing={!env.OFFER_API_URL ? "api" : "app"} />;
  if (!account) return <DemoSetup missing="app" error="Open this page from the checkout, with ?account=." />;

  return (
    <WelcomeView
      apiUrl={env.OFFER_API_URL}
      appId={appId}
      publishableKey={publishableKey}
      account={account}
      overrides={one("app") ? { app: appId, key: publishableKey } : null}
    />
  );
}
