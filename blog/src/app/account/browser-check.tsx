"use client";

import { OfferApiError, OfferProvider, useOfferClient } from "@offer/sdk";
import { useEffect, useState } from "react";

// The core SDK in the browser: <OfferProvider> + useOfferClient() with the
// publishable key. Public keys may read plan state and pricing and track
// usage; anything else must come back 401.

interface Check {
  label: string;
  path: string;
  expect: number;
}

function Checks({ appId, accountId }: { appId: string; accountId: string }) {
  const client = useOfferClient();
  const [rows, setRows] = useState<{ check: Check; status: number | string; ms: number; preview: string }[]>([]);

  useEffect(() => {
    const app = `/apps/${appId}`;
    const ns = `${app}/namespaces/${encodeURIComponent(accountId)}`;
    const checks: Check[] = [
      { label: "effective plan", path: `${ns}/plan`, expect: 200 },
      { label: "usage counts", path: `${ns}/usage`, expect: 200 },
      { label: "one counter", path: `${ns}/usage/posts`, expect: 200 },
      { label: "pricing cards", path: `${app}/plans/pricing`, expect: 200 },
      // Legacy rule: the public key can read /full-plan, private meta included.
      { label: "full plan (incl. private meta!)", path: `${ns}/full-plan`, expect: 200 },
      { label: "account record", path: ns, expect: 401 },
      { label: "plan list", path: `${app}/plans`, expect: 401 },
    ];
    let cancelled = false;
    (async () => {
      const out = [];
      for (const check of checks) {
        const started = performance.now();
        try {
          const data = await client.request(check.path);
          out.push({ check, status: 200, ms: Math.round(performance.now() - started), preview: JSON.stringify(data).slice(0, 90) });
        } catch (err) {
          const status = err instanceof OfferApiError ? err.status : String(err);
          out.push({ check, status, ms: Math.round(performance.now() - started), preview: err instanceof Error ? err.message : "" });
        }
      }
      if (!cancelled) setRows(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, appId, accountId]);

  if (!rows.length) return <p className="muted">Calling the API from your browser…</p>;
  return (
    <table className="data">
      <tbody>
        {rows.map(({ check, status, ms, preview }) => (
          <tr key={check.path}>
            <td className={status === check.expect ? "pass" : "fail"}>{status === check.expect ? "✓" : "✗"}</td>
            <td>{check.label}</td>
            <td>
              <code>GET {check.path.replace(`/apps/${appId}`, "…")}</code>
            </td>
            <td>
              {status} <span className="muted">(want {check.expect}, {ms}ms)</span>
            </td>
            <td className="muted">
              <code>{preview}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BrowserCheck({ apiUrl, appId, publicKey, accountId }: { apiUrl: string; appId: string; publicKey: string; accountId: string }) {
  return (
    <OfferProvider baseUrl={apiUrl} apiKey={publicKey}>
      <Checks appId={appId} accountId={accountId} />
    </OfferProvider>
  );
}
