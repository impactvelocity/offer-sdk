"use client";

import { useRouter } from "next/navigation";
import { Offer, OfferProvider, useOffer, type BumpRenderProps, type PlanRenderProps } from "@/sdk/checkout";
import type { CheckoutConfig, Interval, PublicOffer } from "@/sdk/checkout/types";
import styles from "../demo.module.css";

interface Props {
  config: Omit<CheckoutConfig, "fetch">;
  initialOffer: PublicOffer;
  offerId: string | null;
  account: string | null;
  refCode: string | null;
  plan: string | null;
  interval: Interval | null;
  /** Carried to the welcome page when the app came from the URL. */
  overrides: { app: string; key: string } | null;
}

export function CheckoutView({ config, initialOffer, offerId, account, refCode, plan, interval, overrides }: Props) {
  const router = useRouter();

  return (
    <OfferProvider
      {...config}
      initialOffer={initialOffer}
      offerId={offerId}
      account={account}
      refCode={refCode}
      plan={plan}
      interval={interval}
      onSuccess={(checkout) => {
        const next = new URLSearchParams({ account: checkout.account_id ?? "", ...overrides });
        router.push(`/demo/welcome?${next}`);
      }}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.logo}>
            <span aria-hidden className={styles.mark} /> Scrapely
          </span>
          <span className={styles.secure}>Secure checkout</span>
        </header>

        <main className={styles.main}>
          <section className={styles.choose}>
            <Offer.Status className={styles.status} />
            <Offer.Headline className={styles.headline} />
            <Offer.IntervalToggle className={styles.toggle} labels={{ year: "Yearly · 2 months free" }} />
            <Offer.Plans className={styles.plans}>
              {(p) => <Offer.Plan plan={p}>{(props) => <PlanCard {...props} />}</Offer.Plan>}
            </Offer.Plans>
            <Offer.Bumps className={styles.bumps}>
              {(b) => <Offer.Bump bump={b}>{(props) => <BumpCard {...props} />}</Offer.Bump>}
            </Offer.Bumps>
          </section>

          <aside className={styles.side}>
            <div className={styles.card}>
              <h3>Order summary</h3>
              <Offer.Summary className={styles.summary} />
              <Offer.Email className={styles.email} />
              <Offer.Checkout className={styles.checkout} />
              <p className={styles.fine}>Paid with PayPal. Your plan changes as soon as PayPal confirms the payment.</p>
            </div>
            <DemoInfo />
          </aside>
        </main>
      </div>
    </OfferProvider>
  );
}

function PlanCard({ plan, selected, select, priceText, listPriceText, renewalText, savings }: PlanRenderProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={styles.plan}
      data-selected={selected || undefined}
      data-featured={plan.featured || undefined}
      onClick={select}
    >
      <span className={styles.planTop}>
        <span className={styles.planName}>{plan.name}</span>
        {savings ? <span className={styles.badge}>Save {savings}%</span> : plan.featured ? <span className={styles.badge}>Popular</span> : null}
      </span>
      <span className={styles.planPrice}>
        {listPriceText && <s>{listPriceText}</s>}
        <strong>{priceText}</strong>
      </span>
      <span className={styles.planNote}>{renewalText ?? plan.description ?? " "}</span>
      {plan.extras.length > 0 && (
        <ul className={styles.extras}>
          {plan.extras.map((e) => (
            <li key={e.id}>{e.max === null ? `Unlimited ${e.name}` : `${e.max.toLocaleString("en-US")} ${e.name}`} with this offer</li>
          ))}
        </ul>
      )}
    </button>
  );
}

function BumpCard({ bump, selected, toggle, priceText }: BumpRenderProps) {
  return (
    <label className={styles.bump} data-selected={selected || undefined}>
      <input type="checkbox" checked={selected} onChange={(e) => toggle(e.target.checked)} />
      <span>
        <span className={styles.bumpTitle}>
          {bump.label} <strong>{priceText}</strong>
        </span>
        {bump.description && <span className={styles.bumpText}>{bump.description}</span>}
      </span>
    </label>
  );
}

// What the demo is doing behind the scenes, for whoever is watching.
function DemoInfo() {
  const { offer, account } = useOffer();
  if (!offer) return null;
  return (
    <dl className={styles.info}>
      <dt>Offer</dt>
      <dd>
        {offer.resolved_from === "default" ? "Regular prices" : offer.name} <code>{offer.id}</code>
      </dd>
      <dt>Buyer</dt>
      <dd>{account ? <code>{account}</code> : "New account (email)"}</dd>
      <dt>PayPal</dt>
      <dd>{offer.paypal ? offer.paypal.env : "not connected"}</dd>
    </dl>
  );
}
