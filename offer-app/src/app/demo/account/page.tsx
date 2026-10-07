import type { Metadata } from "next";
import { env } from "@/server/env";
import { offerApi } from "@/server/offer-api";
import { DemoSetup } from "../demo-setup";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Account · Scrapely" };

// A sample tenant's account settings with a cancel button. Like any tenant,
// its server mints a short-lived account token (here with the dashboard's
// admin key; a tenant uses its secret key) and hands only that to the browser.
export default async function DemoAccountPage({ searchParams }: PageProps<"/demo/account">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) || null;
  };
  const appId = one("app") ?? env.DEMO_APP_ID;
  const account = one("account");
  if (!appId || !env.OFFER_API_URL) return <DemoSetup missing={!env.OFFER_API_URL ? "api" : "app"} />;
  if (!account) return <DemoSetup missing="app" error="Open this page with ?account= (an account with a subscription)." />;

  let token: string;
  try {
    ({ token } = await offerApi<{ token: string }>(
      "POST",
      `/apps/${encodeURIComponent(appId)}/namespaces/${encodeURIComponent(account)}/token`,
      { ttl_seconds: 3600 },
    ));
  } catch (err) {
    return <DemoSetup missing="app" error={err instanceof Error ? err.message : String(err)} />;
  }

  return <AccountView apiUrl={env.OFFER_API_URL} appId={appId} account={account} token={token} app={one("app")} />;
}
