"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../demo.module.css";

interface ResolvedPlan {
  plan: { id: string; name: string };
  offer: string | null;
  incentive: string | null;
  addons: string[];
  entitlements: { id: string; name: string; type: string; usage: number; max: number | null; can: boolean }[];
}

interface LimitReached {
  message: string;
  offer: { checkout_url: string | null } | null;
}

interface Props {
  apiUrl: string;
  appId: string;
  publishableKey: string;
  account: string;
  overrides: { app: string; key: string } | null;
}

export function WelcomeView({ apiUrl, appId, publishableKey, account, overrides }: Props) {
  const base = `${apiUrl.replace(/\/+$/, "")}/apps/${encodeURIComponent(appId)}/namespaces/${encodeURIComponent(account)}`;
  const [plan, setPlan] = useState<ResolvedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrape, setScrape] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${publishableKey}`, "Content-Type": "application/json" },
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    [base, publishableKey],
  );

  const load = useCallback(async () => {
    const res = await request("/plan");
    if (res.status === 200) setPlan(res.body as ResolvedPlan);
    else setError((res.body as { error?: string }).error ?? `Couldn't load the account (${res.status})`);
  }, [request]);

  useEffect(() => {
    let active = true;
    request("/plan").then((res) => {
      if (!active) return;
      if (res.status === 200) setPlan(res.body as ResolvedPlan);
      else setError((res.body as { error?: string }).error ?? `Couldn't load the account (${res.status})`);
    });
    return () => {
      active = false;
    };
  }, [request]);

  // What an API client (or an AI agent) sees when it uses a scrape.
  async function runScrape() {
    const res = await request("/usage/scrapes/add", { method: "POST" });
    if (res.status === 402) {
      const body = res.body as LimitReached;
      setScrape({ ok: false, text: body.message, link: body.offer?.checkout_url });
    } else if (res.status === 200) {
      setScrape({ ok: true, text: `Scrape #${(res.body as { count: number }).count} done.` });
    } else {
      setScrape({ ok: false, text: (res.body as { error?: string }).error ?? `Request failed (${res.status})` });
    }
    await load();
  }

  const checkoutHref = `/demo/checkout?${new URLSearchParams({ account, ...overrides })}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>
          <span aria-hidden className={styles.mark} /> Scrapely
        </span>
        <span style={{ display: "flex", gap: 16 }}>
          <a className={styles.secure} href={`/demo/account?${new URLSearchParams({ account, ...(overrides ? { app: overrides.app } : {}) })}`}>
            Account
          </a>
          <a className={styles.secure} href={checkoutHref}>
            Plans
          </a>
        </span>
      </header>
      <main className={styles.welcome}>
        {error && <p className={styles.error}>{error}</p>}
        {plan && (
          <>
            <h1>
              You&apos;re on {plan.plan.name}
              {plan.offer && <span className={styles.chip}>via {plan.offer}</span>}
            </h1>
            <p className={styles.muted}>
              Account <code>{account}</code>. This page reads access with <code>GET /plan</code>, the same call the app
              made before offers existed.
            </p>

            <div className={styles.card}>
              <h3>Your access</h3>
              <ul className={styles.access}>
                {plan.entitlements.map((e) => (
                  <li key={e.id}>
                    <span>{e.name}</span>
                    <span>
                      {e.type === "usage"
                        ? `${e.usage.toLocaleString("en-US")} / ${e.max === null ? "unlimited" : e.max.toLocaleString("en-US")}`
                        : "Included"}
                    </span>
                  </li>
                ))}
                {plan.addons.map((a) => (
                  <li key={a}>
                    <span>{a === "welcome_call" ? "1:1 welcome call" : a}</span>
                    <span>{a === "welcome_call" ? <a href="#">Book your call</a> : "Included"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.card}>
              <h3>Try the API</h3>
              <p className={styles.muted}>Uses one scrape, like an API client would. Past the limit you get a 402 with an upgrade.</p>
              <button type="button" className={styles.button} onClick={runScrape}>
                Run a scrape
              </button>
              {scrape && (
                <p className={scrape.ok ? styles.ok : styles.error}>
                  {scrape.text}
                  {scrape.link && (
                    <>
                      {" "}
                      <a href={scrape.link}>Open the upgrade</a>
                    </>
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
