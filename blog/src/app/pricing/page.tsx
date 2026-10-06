import { getOffer, priceLabel, type Interval, type PublicOffer } from "@offer/sdk/checkout";
import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { appApi, loggingFetch, offerApi } from "@/lib/offer/client";
import { OFFER_API_URL } from "@/lib/offer/config";
import { currentUser } from "@/lib/session";
import { CheckoutPage } from "./checkout";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
const INTERVALS = ["month", "year", "once"];

interface PricingCard {
  plan_id: string;
  title: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  isFree: boolean;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const api = await offerApi();
  const { config } = api;
  const user = await currentUser();
  const offerId = one(sp.offer);
  const interval = one(sp.interval);

  // ?preview=1 renders a draft through POST /offers/draft-preview (secret key),
  // since publishing needs PayPal. Otherwise the SDK's getOffer() on the server,
  // so the page renders with prices.
  const preview = sp.preview === "1" && offerId;
  const [initialOffer, cards] = await Promise.all([
    preview
      ? api.get<Record<string, unknown>>(`/offers/${encodeURIComponent(offerId)}`).then((doc) => api.post<PublicOffer>("/offers/draft-preview", doc))
      : getOffer(
      {
        apiUrl: OFFER_API_URL,
        appId: config.appId,
        publishableKey: config.publicKey,
        offerId,
        account: user?.id ?? one(sp.account),
        ref: one(sp.ref),
        fetch: loggingFetch,
      },
    ),
    // The plain pricing table: GET /plans/pricing with the publishable key.
    appApi(config, config.publicKey).get<PricingCard[]>("/plans/pricing"),
  ]);

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>Pricing</h1>

      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Monthly</th>
            <th>Yearly</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.plan_id}>
              <td>{c.title}</td>
              <td>{c.isFree ? "free" : priceLabel(c.monthlyPrice ?? 0, "month", c.currency ?? "USD")}</td>
              <td>{c.isFree ? "" : priceLabel(c.yearlyPrice ?? 0, "year", c.currency ?? "USD")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {preview && (
        <p className="warn">
          Previewing draft <code>{offerId}</code> via <code>POST /offers/draft-preview</code>. Checkout needs it published (PayPal).
        </p>
      )}
      <p>
        Try: <Link href="/pricing">regular prices</Link> | <Link href="/pricing?offer=launch_50&ref=newsletter">?offer=launch_50&amp;ref=newsletter</Link> |{" "}
        <Link href="/pricing?offer=lifetime">?offer=lifetime</Link> | <Link href="/pricing?offer=nope">?offer=nope</Link> |{" "}
        <Link href="/pricing?offer=launch_50&preview=1">launch_50 draft preview</Link> |{" "}
        <Link href="/pricing?plan=business&interval=year">?plan=business&amp;interval=year</Link>
      </p>
      {!user && (
        <p className="muted">
          Not signed in, so the checkout asks for an email. <Link href="/login">Log in</Link> to buy for your account.
        </p>
      )}

      <hr />
      <CheckoutPage
        key={JSON.stringify(sp)}
        apiUrl={OFFER_API_URL}
        appId={config.appId}
        publishableKey={config.publicKey}
        initialOffer={initialOffer}
        offerId={offerId}
        account={user?.id ?? one(sp.account)}
        refCode={one(sp.ref)}
        plan={one(sp.plan)}
        interval={interval && INTERVALS.includes(interval) ? (interval as Interval) : null}
      />
      <DevLog title='GET "/pricing"' />
    </>
  );
}
