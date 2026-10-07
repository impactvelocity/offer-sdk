import Link from "next/link";
import { dialect } from "@/db";
import { Flash } from "@/components/flash";
import { appApi, clientFor } from "@/lib/offer/client";
import { OFFER_API_URL, OFFER_APP_URL, WEBHOOK_URL, offerConfig } from "@/lib/offer/config";
import { listOrgs } from "@/lib/offer/setup";
import { currentUser } from "@/lib/session";
import { attach, disconnect } from "./actions";
import { Generator } from "./generator";

const mask = (key: string) => `${key.slice(0, 8)}…${key.slice(-4)}`;

async function apiStatus() {
  try {
    await clientFor().request("/health");
    return "ok";
  } catch (err) {
    return `down (${err instanceof Error ? err.message : err})`;
  }
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const [config, health, user] = await Promise.all([offerConfig(), apiStatus(), currentUser()]);
  const [orgs, paypal] = config
    ? await Promise.all([listOrgs(), appApi(config).get<{ env?: string; connected?: false }>("/paypal").catch(() => null)])
    : [null, null];

  const env: [string, React.ReactNode][] = [
    ["Offer API", `${OFFER_API_URL} (${health})`],
    ["Database adapter", dialect === "postgres" ? "postgresql (DATABASE_URL)" : "sqlite3 (blog.sqlite3)"],
    ["Auth", "better-auth, email + password"],
    ["App", config ? config.appId : <i>not connected</i>],
    ["Secret key", config ? mask(config.secretKey) : "-"],
    ["Publishable key", config ? mask(config.publicKey) : "-"],
    ["Webhook", config?.webhookId ? `${config.webhookId} → ${WEBHOOK_URL}` : "-"],
    ["PayPal", paypal?.env ? `connected (${paypal.env})` : "not connected: offers stay drafts"],
    ["Dashboard", OFFER_APP_URL],
  ];

  return (
    <div className="welcome">
      <div id="page">
        <div id="content">
          <div id="header">
            <h1>Welcome aboard</h1>
            <h2>You&rsquo;re riding the Offer API!</h2>
          </div>
          <Flash notice={sp.notice} alert={sp.alert} />

          <div id="about">
            <h3>About your application&rsquo;s environment</h3>
            <table>
              <tbody>
                {env.map(([name, value]) => (
                  <tr key={name}>
                    <td className="name">{name}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div id="getting-started">
            <h1>Getting started</h1>
            <h2>Here&rsquo;s how to get rolling:</h2>
            <ol>
              <li>
                <h2>1. Start the Offer API</h2>
                <p>
                  From the repo root: <code>pnpm dev:api</code> (Postgres + the API on :6767). Status: <b>{health}</b>
                </p>
              </li>
              <li>
                <h2>2. Generate the catalog</h2>
                <p>
                  Creates the app with <code>POST /apps</code>, then its entitlements, add-ons, plans, incentive, offers and a webhook
                  endpoint, using the app&rsquo;s secret key. Safe to run again.
                </p>
                <Generator connected={!!config} />
              </li>
              <li>
                <h2>3. Create your account</h2>
                <p>
                  {user ? (
                    <>
                      Signed in as {user.email}. <Link href="/posts/new">Write a post</Link>, or run <Link href="/console">rake test</Link>.
                    </>
                  ) : (
                    <>
                      <Link href="/signup">Sign up</Link>: your first visit creates your Offer account on the Free plan (3 posts).
                    </>
                  )}
                </p>
              </li>
            </ol>
          </div>

          {config && (
            <div id="getting-started">
              <h1>Housekeeping</h1>
              {Array.isArray(orgs) ? (
                orgs.length ? (
                  <form action={attach}>
                    <p>
                      Show this app in a dashboard workspace (admin key, <code>PATCH /orgs/:id</code>):{" "}
                      <select name="org">
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.id} ({o.app_ids.length} apps{o.app_ids.includes(config.appId) ? ", includes this one" : ""})
                          </option>
                        ))}
                      </select>{" "}
                      <button type="submit">Attach</button>
                    </p>
                  </form>
                ) : (
                  <p className="muted">No dashboard workspaces yet. Sign up at {OFFER_APP_URL} to make one.</p>
                )
              ) : (
                <p className="muted">Dashboard workspaces unavailable: {orgs}</p>
              )}
              <form action={disconnect}>
                <p>
                  <button type="submit">Disconnect</button> forgets the keys.{" "}
                  <button type="submit" name="destroy" value="1">
                    Delete app
                  </button>{" "}
                  also runs <code>DELETE /apps/{config.appId}</code>.
                </p>
              </form>
            </div>
          )}
        </div>

        <div id="sidebar">
          <h3>Try it out</h3>
          <ul>
            <li><Link href="/">Posts</Link></li>
            <li><Link href="/pricing">Pricing (checkout SDK)</Link></li>
            <li><Link href="/pricing?offer=launch_50&ref=newsletter">Launch offer</Link></li>
            <li><Link href="/account">My account</Link></li>
          </ul>
          <h3>Admin</h3>
          <ul>
            <li><Link href="/offers">Offers</Link></li>
            <li><Link href="/webhooks">Webhooks</Link></li>
            <li><Link href="/stats">Stats</Link></li>
            <li><Link href="/console">rake test</Link></li>
          </ul>
          <h3>Browse the docs</h3>
          <ul>
            <li><a href={`${OFFER_API_URL}/docs`}>API reference</a></li>
            <li><a href={OFFER_APP_URL}>Dashboard</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
