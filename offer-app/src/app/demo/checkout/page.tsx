import type { Metadata } from "next";
import { getOffer } from "@/sdk/checkout/client";
import type { Interval, PublicOffer } from "@/sdk/checkout/types";
import { env } from "@/server/env";
import { DemoSetup } from "../demo-setup";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Checkout · Scrapely" };

const INTERVALS: Interval[] = ["month", "year", "once"];

// A sample tenant checkout page built only from the public checkout SDK.
// Designed once; `?offer=` picks what it sells, `?ref=` who sent the buyer.
export default async function DemoCheckoutPage({ searchParams }: PageProps<"/demo/checkout">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) || null;
  };

  const appId = one("app") ?? env.DEMO_APP_ID;
  const publishableKey = one("key") ?? env.DEMO_PUBLISHABLE_KEY;
  const apiUrl = env.OFFER_API_URL;
  if (!appId || !publishableKey || !apiUrl) return <DemoSetup missing={!apiUrl ? "api" : "app"} />;

  const offerId = one("offer");
  const account = one("account");
  const refCode = one("ref");
  const interval = INTERVALS.find((i) => i === one("interval")) ?? null;

  let initialOffer: PublicOffer;
  try {
    initialOffer = await getOffer({
      apiUrl: env.OFFER_API_INTERNAL_URL ?? apiUrl,
      appId,
      publishableKey,
      offerId,
      account,
      ref: refCode,
    });
  } catch (err) {
    return <DemoSetup missing="app" error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <CheckoutView
      config={{ apiUrl, appId, publishableKey }}
      initialOffer={initialOffer}
      offerId={offerId}
      account={account}
      refCode={refCode}
      plan={one("plan")}
      interval={interval}
      overrides={one("app") ? { app: appId, key: publishableKey } : null}
    />
  );
}
