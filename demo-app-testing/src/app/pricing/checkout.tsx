"use client";

import { Offer, OfferProvider, useOffer, type Checkout, type PublicOffer } from "@offer/sdk/checkout";
import { useRouter } from "next/navigation";

// The checkout SDK, start to finish: one page that sells any offer by id.

function DebugPanel() {
  const { offer, selection, summary, phase, checkout, checkoutError, redirectToPaypal } = useOffer();
  if (!offer) return null;
  return (
    <fieldset>
      <legend>useOffer()</legend>
      <table className="data">
        <tbody>
          <tr>
            <td>offer</td>
            <td>
              <code>{offer.id}</code> resolved_from <code>{offer.resolved_from}</code>
              {offer.requested && (
                <>
                  , requested <code>{offer.requested.id}</code> → <code>{offer.requested.reason}</code>
                </>
              )}
            </td>
          </tr>
          <tr>
            <td>selection</td>
            <td>
              <code>{JSON.stringify(selection)}</code>
            </td>
          </tr>
          <tr>
            <td>summary</td>
            <td>
              total today <code>{summary?.totalToday}</code>, renewal <code>{JSON.stringify(summary?.renewal)}</code>, ready{" "}
              <code>{String(summary?.ready)}</code>
            </td>
          </tr>
          <tr>
            <td>phase</td>
            <td>
              <code>{phase}</code> {checkoutError && <span className="fail">{checkoutError}</span>}
            </td>
          </tr>
          {checkout && (
            <tr>
              <td>checkout</td>
              <td>
                <code>
                  {checkout.id} {checkout.status} {checkout.total_today}
                </code>
              </td>
            </tr>
          )}
          <tr>
            <td>paypal</td>
            <td>
              {offer.paypal ? (
                <>
                  {offer.paypal.env}{" "}
                  <button type="button" onClick={() => void redirectToPaypal().catch(() => {})} disabled={!summary?.ready}>
                    Pay on PayPal&rsquo;s page instead (redirectToPaypal)
                  </button>
                </>
              ) : (
                <span className="muted">not connected (set PAYPAL_CLIENT_ID/SECRET and re-run setup)</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </fieldset>
  );
}

export function CheckoutPage(props: {
  apiUrl: string;
  appId: string;
  publishableKey: string;
  initialOffer: PublicOffer;
  offerId: string | null;
  account: string | null;
  refCode: string | null;
  plan: string | null;
  interval: "month" | "year" | "once" | null;
}) {
  const router = useRouter();
  const onSuccess = (c: Checkout) => router.push(`/account?notice=${encodeURIComponent(`Payment received (${c.id}). Welcome aboard!`)}`);

  return (
    <div className="checkout">
      <OfferProvider
        apiUrl={props.apiUrl}
        appId={props.appId}
        publishableKey={props.publishableKey}
        offerId={props.offerId}
        initialOffer={props.initialOffer}
        account={props.account}
        refCode={props.refCode}
        plan={props.plan}
        interval={props.interval}
        onSuccess={onSuccess}
      >
        <Offer.Status />
        <Offer.Headline />
        <Offer.IntervalToggle />
        <Offer.Plans>{(plan) => <Offer.Plan plan={plan} />}</Offer.Plans>
        <Offer.Bumps>{(bump) => <Offer.Bump bump={bump} />}</Offer.Bumps>
        <Offer.Summary />
        <Offer.Email />
        <Offer.Checkout style={{ color: "gold", shape: "rect" }} />
        <DebugPanel />
      </OfferProvider>
    </div>
  );
}
