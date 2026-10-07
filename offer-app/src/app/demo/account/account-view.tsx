"use client";

import { useCallback, useEffect, useState } from "react";
import cancelStyles from "@/components/cancel-flows/cancel-flow.module.css";
import { CancelFlow, CancelFlowProvider, type CancelSession } from "@/sdk/cancel";
import styles from "../demo.module.css";

interface Subscription {
  plan_id: string;
  interval: string;
  price: number;
  currency: string;
  status: string;
  renews_at: string | null;
  renews_at_price: number | null;
  pause?: { resume_at: string; months: number } | null;
  pending_change?: { approve_url: string | null; discount?: { percent: number; cycles: number } } | null;
}

interface Props {
  apiUrl: string;
  appId: string;
  account: string;
  token: string;
  app: string | null;
}

const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "–";

export function AccountView({ apiUrl, appId, account, token, app }: Props) {
  const base = `${apiUrl.replace(/\/+$/, "")}/apps/${encodeURIComponent(appId)}/namespaces/${encodeURIComponent(account)}`;
  const [plan, setPlan] = useState<{ name: string } | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  // The account token can read this account's own plan and subscription.
  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [p, s] = await Promise.all([
      fetch(`${base}/full-plan`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}/subscription`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ]);
    setPlan(p?.plan ?? null);
    setSub(s);
  }, [base, token]);

  useEffect(() => {
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${base}/full-plan`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}/subscription`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([p, s]) => {
      if (!active) return;
      setPlan(p?.plan ?? null);
      setSub(s);
    });
    return () => {
      active = false;
    };
  }, [base, token]);

  const done = (session: CancelSession) => {
    setOutcome(session.status === "cancelled" ? "Your subscription was cancelled." : "Thanks for staying!");
    void load();
  };

  const welcome = `/demo/welcome?${new URLSearchParams({ account, ...(app ? { app } : {}) })}`;
  // Accounts billed outside PayPal can cancel too; the app hears about it by webhook.
  const canCancel = !sub || ["active", "suspended"].includes(sub.status);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>
          <span aria-hidden className={styles.mark} /> Scrapely
        </span>
        <a className={styles.secure} href={welcome}>
          Dashboard
        </a>
      </header>
      <main className={styles.welcome}>
        <h1>Account settings</h1>
        <p className={styles.muted}>
          Account <code>{account}</code>. The cancel button below is the Offer SDK&apos;s cancel flow; its questions and save offers
          are set in the Offer dashboard.
        </p>

        <section className={styles.card} style={{ display: "grid", gap: 8 }}>
          <h3>Subscription</h3>
          {sub ? (
            <dl className={styles.info}>
              <dt>Plan</dt>
              <dd>{plan?.name ?? sub.plan_id}</dd>
              <dt>Price</dt>
              <dd>
                {money(sub.renews_at_price ?? sub.price, sub.currency)} / {sub.interval}
              </dd>
              <dt>Status</dt>
              <dd>{sub.pause ? `Paused until ${date(sub.pause.resume_at)}` : sub.status}</dd>
              <dt>Next bill</dt>
              <dd>{sub.status === "active" ? date(sub.renews_at) : "–"}</dd>
            </dl>
          ) : (
            <p className={styles.muted}>No paid subscription on this account.</p>
          )}
          {sub?.pending_change?.approve_url ? (
            <p className={styles.muted}>
              A new price is waiting for your approval on <a href={sub.pending_change.approve_url}>PayPal</a>.
            </p>
          ) : null}
          {outcome ? <p className={styles.status}>{outcome}</p> : null}

          <CancelFlowProvider apiUrl={apiUrl} appId={appId} token={token} onCancelled={done} onSaved={done}>
            {canCancel ? (
              <CancelFlow.Trigger className={styles.cancelLink}>Cancel subscription</CancelFlow.Trigger>
            ) : null}
            <CancelFlow.Dialog className={styles.dialog}>
              <CancelFlow.Steps className={`${cancelStyles.flow} ${styles.cancelFlow}`} />
            </CancelFlow.Dialog>
          </CancelFlowProvider>
        </section>
      </main>
    </div>
  );
}
