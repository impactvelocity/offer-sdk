import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { offerApi } from "@/lib/offer/client";
import type { Namespace, Plan } from "@/lib/offer/types";
import { deleteReport, saveReport } from "./actions";

const INTERVALS = ["7d", "30d", "60d", "6m", "year", "alltime"];

interface Totals {
  entitlement_id: string;
  calls: number;
  total_amount: number;
}
interface Bucket extends Totals {
  date: string;
}
interface UsageEvent {
  id: number;
  namespace_id: string;
  entitlement_id: string;
  operation: string;
  amount: number;
  count: number;
  created_at: string;
}
interface Page<T> {
  data: T[];
  total: number;
}

const bar = (n: number, max: number) => "#".repeat(max ? Math.max(1, Math.round((n / max) * 40)) : 0);

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const interval = typeof sp.interval === "string" && INTERVALS.includes(sp.interval) ? sp.interval : "30d";
  const q = typeof sp.q === "string" ? sp.q : "";
  const api = await offerApi();

  const [totals, series, top, events, count, search, withIncentive, plans, reports] = await Promise.all([
    api.get<Totals[]>(`/analytics?interval=${interval}`),
    api.get<Bucket[]>(`/analytics/timeseries?interval=${interval}`),
    api.get<{ namespace_id: string; calls: number; total_amount: number }[]>(`/analytics/top-namespaces?interval=${interval}&limit=5`),
    api.get<UsageEvent[]>("/analytics/events?limit=10"),
    api.get<{ count: number }>("/namespaces/count"),
    api.get<Page<Namespace & { namespace_id?: string }>>(`/namespaces?per_page=10${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    api.get<Page<Namespace>>("/namespaces/with-incentive"),
    api.get<Plan[]>("/plans"),
    api.get<{ id: string; name: string; interval: string; entitlements: string[] }[]>("/analytics/reports"),
  ]);
  const perPlan = await Promise.all(plans.map((p) => api.get<Page<{ id: string }>>(`/plans/${p.id}/namespaces?per_page=1`).then((r) => [p.name, r.total] as const)));

  const days = [...new Set(series.map((b) => b.date))];
  const maxDay = Math.max(0, ...days.map((d) => series.filter((b) => b.date === d).reduce((n, b) => n + b.calls, 0)));

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>Stats</h1>
      <p>
        {INTERVALS.map((i, n) => (
          <span key={i}>
            {n > 0 && " | "}
            {i === interval ? <b>{i}</b> : <Link href={`/stats?interval=${i}`}>{i}</Link>}
          </span>
        ))}
      </p>

      <h2>Accounts</h2>
      <p>
        <b>{count.count}</b> total &middot; by plan: {perPlan.map(([name, n]) => `${name} ${n}`).join(", ")} &middot; with an incentive: {withIncentive.total}
      </p>
      <form>
        <p>
          <input name="q" defaultValue={q} placeholder="search accounts" /> <button type="submit">Search</button>
        </p>
      </form>
      <table className="data">
        <tbody>
          {search.data.map((n) => (
            <tr key={n.id ?? n.namespace_id}>
              <td>
                <code>{n.id ?? n.namespace_id}</code>
              </td>
              <td>{n.name}</td>
              <td>{n.plan}</td>
              <td className="muted">{n.incentive}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        {search.total} match{search.total === 1 ? "" : "es"}
      </p>

      <h2>Usage by entitlement</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Entitlement</th>
            <th>Calls</th>
            <th>Net amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <tr key={t.entitlement_id}>
              <td>{t.entitlement_id}</td>
              <td>{t.calls}</td>
              <td>{t.total_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Usage over time</h2>
      <pre>
        {days.length === 0
          ? "No usage yet."
          : days
              .map((d) => {
                const n = series.filter((b) => b.date === d).reduce((sum, b) => sum + b.calls, 0);
                return `${d}  ${String(n).padStart(4)}  ${bar(n, maxDay)}`;
              })
              .join("\n")}
      </pre>

      <h2>Top accounts</h2>
      <table className="data">
        <tbody>
          {top.map((t) => (
            <tr key={t.namespace_id}>
              <td>
                <code>{t.namespace_id}</code>
              </td>
              <td>{t.calls} calls</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent usage events</h2>
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>Account</th>
            <th>Entitlement</th>
            <th>Op</th>
            <th>Amount</th>
            <th>Count after</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleTimeString()}</td>
              <td>
                <code>{e.namespace_id.slice(0, 10)}</code>
              </td>
              <td>{e.entitlement_id}</td>
              <td>{e.operation}</td>
              <td>{e.amount}</td>
              <td>{e.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Saved reports</h2>
      <table className="data">
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.interval}</td>
              <td>{r.entitlements.join(", ")}</td>
              <td>
                <form className="inline" action={deleteReport.bind(null, r.id)}>
                  <button type="submit">Destroy</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={saveReport}>
        <input type="hidden" name="interval" value={interval} />
        <p>
          <input name="name" placeholder="Report name" defaultValue={`Posts and comments, ${interval}`} /> <button type="submit">Save report</button>
        </p>
      </form>
      <DevLog title={`GET "/stats?interval=${interval}"`} />
    </>
  );
}
