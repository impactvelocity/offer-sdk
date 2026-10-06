import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { db } from "@/db";
import { clientFor, offerApi } from "@/lib/offer/client";
import { WEBHOOK_URL } from "@/lib/offer/config";
import type { Delivery, WebhookEndpoint } from "@/lib/offer/types";
import { breakSecret, clearReceived, regenerateSecret, retry, sendTest, toggle } from "./actions";

interface Endpoint extends WebhookEndpoint {
  disabled_reason: string | null;
  stats: { total: number; succeeded: number; failed: number; pending: number; last_status: string | null };
}

interface ApiEvent {
  id: string;
  type: string;
  created_at: string;
  data: { object?: { id?: string } };
}

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const api = await offerApi();
  const id = api.config.webhookId;

  const [endpoint, deliveries, events, types, received] = await Promise.all([
    id ? api.get<Endpoint>(`/webhooks/${id}`).catch(() => null) : null,
    id ? api.get<Delivery[]>(`/webhooks/${id}/deliveries?limit=15`).catch(() => []) : [],
    api.get<ApiEvent[]>("/events?limit=15"),
    // Public: no key needed.
    clientFor().request<{ type: string; title: string }[]>("/event-types"),
    db.selectFrom("webhook_events").selectAll().orderBy("received_at", "desc").limit(25).execute(),
  ]);

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>Webhooks</h1>

      {endpoint ? (
        <>
          <p>
            <b>Endpoint:</b> <code>{endpoint.id}</code> &rarr; {endpoint.url}{" "}
            <span className={endpoint.enabled ? "pass" : "fail"}>{endpoint.enabled ? "enabled" : `disabled${endpoint.disabled_reason ? ` (${endpoint.disabled_reason})` : ""}`}</span>
          </p>
          <p>
            <b>Events:</b> <code>{endpoint.events.join(", ")}</code> &middot; <b>Deliveries:</b> {endpoint.stats.total} total,{" "}
            <span className="pass">{endpoint.stats.succeeded} ok</span>, <span className="fail">{endpoint.stats.failed} failed</span>, {endpoint.stats.pending} pending
          </p>
          <form action={sendTest}>
            <p>
              <select name="type" defaultValue="account.created">
                {types.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type}
                  </option>
                ))}
              </select>{" "}
              <button type="submit">Send test event</button>{" "}
              <button type="submit" formAction={toggle.bind(null, !endpoint.enabled)}>
                {endpoint.enabled ? "Disable" : "Enable"}
              </button>{" "}
              <button type="submit" formAction={regenerateSecret}>
                Regenerate secret
              </button>{" "}
              <button type="submit" formAction={breakSecret}>
                Break local secret
              </button>
            </p>
          </form>
        </>
      ) : (
        <p id="alert">No endpoint registered. Run Setup (it registers {WEBHOOK_URL}).</p>
      )}

      <h2>Received here</h2>
      <form action={clearReceived}>
        <p className="muted">
          <code>POST /api/webhooks</code>, verified with <code>standardwebhooks</code>. <button type="submit">Clear</button>
        </p>
      </form>
      {received.length === 0 ? (
        <p className="muted">
          Nothing yet. Write a post or change your plan. The API in Docker reaches this app at {WEBHOOK_URL}.
        </p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Received</th>
              <th>Type</th>
              <th>Signature</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {received.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.received_at).toLocaleTimeString()}</td>
                <td>{e.type}</td>
                <td className={e.verified ? "pass" : "fail"}>{e.verified ? "valid" : "INVALID"}</td>
                <td>
                  <details>
                    <summary>
                      <code>{e.id}</code>
                    </summary>
                    <pre>{JSON.stringify(JSON.parse(e.payload), null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Deliveries</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Created</th>
            <th>Event</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Attempts</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id}>
              <td>{new Date(d.created_at).toLocaleTimeString()}</td>
              <td>{d.event_type}</td>
              <td className={d.status === "succeeded" ? "pass" : d.status === "failed" ? "fail" : "warn"}>{d.status}</td>
              <td>{d.response_status ?? "-"}</td>
              <td>{d.attempts}</td>
              <td>
                {d.status !== "succeeded" && (
                  <form className="inline" action={retry.bind(null, d.id)}>
                    <button type="submit">Retry</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Event log</h2>
      <p className="muted">
        <code>GET /events</code>: everything the API recorded for this app, test events excluded.
      </p>
      <table className="data">
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleTimeString()}</td>
              <td>{e.type}</td>
              <td className="muted">
                <code>{e.data.object?.id}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <DevLog title='GET "/webhooks"' />
    </>
  );
}
