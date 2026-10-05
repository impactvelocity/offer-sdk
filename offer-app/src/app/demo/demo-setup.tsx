import styles from "./demo.module.css";

/** Shown when the demo has no app to sell from. */
export function DemoSetup({ missing, error }: { missing: "api" | "app"; error?: string }) {
  return (
    <div className={styles.page}>
      <main className={styles.setup}>
        <h1>Checkout demo isn&apos;t set up</h1>
        {missing === "api" ? (
          <p>
            Set <code>OFFER_API_URL</code> to the Offer API. The demo sells through the real API, not the in-memory mock.
          </p>
        ) : (
          <>
            <p>
              Seed a demo app, then add <code>DEMO_APP_ID</code> and <code>DEMO_PUBLISHABLE_KEY</code> to{" "}
              <code>offer-app/.env.local</code> (or open this page with <code>?app=…&amp;key=…</code>).
            </p>
            <pre>cd api{"\n"}PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… bun scripts/seed-demo.ts</pre>
          </>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </main>
    </div>
  );
}
