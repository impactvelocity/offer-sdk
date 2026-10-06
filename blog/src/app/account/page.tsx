import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { accountPath, ensureAccount } from "@/lib/offer/account";
import { isStatus, offerApi } from "@/lib/offer/client";
import { OFFER_API_URL } from "@/lib/offer/config";
import type { Addon, NamespacePlan, Plan, Subscription } from "@/lib/offer/types";
import { requireUser } from "@/lib/session";
import {
  applyPromo,
  changePlan,
  grantAddon,
  removeIncentive,
  rename,
  resetAccount,
  revokeAddon,
  setAmount,
  subscription,
  usage,
} from "./actions";
import { BrowserCheck } from "./browser-check";

const limit = (max: number | null) => (max === null ? "unlimited" : max);

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const api = await offerApi();
  const account = await ensureAccount(api, user);
  const path = accountPath(user.id);

  const [plan, fullPlan, plans, addons, sub] = await Promise.all([
    api.get<NamespacePlan>(`${path}/plan`),
    api.get<NamespacePlan>(`${path}/full-plan`),
    api.get<Plan[]>("/plans"),
    api.get<Addon[]>("/addons"),
    api.get<Subscription>(`${path}/subscription`).catch((err) => (isStatus(err, 404) ? null : Promise.reject(err))),
  ]);

  const privateMeta = Object.keys(fullPlan.plan.meta).filter((k) => !(k in plan.plan.meta));

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>My account</h1>

      <p>
        <b>Account id:</b> <code>{account.id}</code> <span className="muted">(your user id is the Offer namespace id)</span>
      </p>
      <form action={rename}>
        <p>
          <b>Name:</b> <input name="name" defaultValue={account.name} size={24} /> <button type="submit">Rename</button>
        </p>
      </form>
      <p>
        <b>Plan:</b> {plan.plan.name}
        {plan.plan.isFree && " (free)"} &mdash; {plan.plan.description}
        {Object.keys(plan.plan.meta).length > 0 && (
          <>
            {" "}
            <span className="muted">
              meta <code>{JSON.stringify(plan.plan.meta)}</code>
              {privateMeta.length > 0 && (
                <>
                  , private (only via <code>/full-plan</code>): <code>{privateMeta.join(", ")}</code>
                </>
              )}
            </span>
          </>
        )}
      </p>
      <p>
        <b>Incentive:</b> {plan.incentive ?? <span className="muted">none</span>}
        {account.incentive_expires_at && <span className="muted"> (expires {new Date(account.incentive_expires_at).toLocaleString()})</span>}
        {account.incentive && !plan.incentive && <span className="warn"> ({account.incentive} has expired)</span>}{" "}
        <b>Offer:</b> {plan.offer ?? <span className="muted">none</span>}
      </p>

      <h2>Entitlements</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Entitlement</th>
            <th>Type</th>
            <th>Used</th>
            <th>Limit</th>
            <th>Left</th>
            <th>Can?</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plan.entitlements.map((e) => (
            <tr key={e.id}>
              <td>
                {e.name} <code className="muted">{e.id}</code>
              </td>
              <td>{e.type}</td>
              <td>{e.type === "usage" ? e.usage : ""}</td>
              <td>{e.type === "usage" ? limit(e.max) : "on"}</td>
              <td>{e.type === "usage" ? (e.left ?? "∞") : ""}</td>
              <td className={e.can ? "pass" : "fail"}>{e.can ? "yes" : "no"}</td>
              <td>
                {e.type === "usage" && (
                  <>
                    <form className="inline" action={usage.bind(null, e.id, "add")}>
                      <button type="submit">+1</button>
                    </form>{" "}
                    <form className="inline" action={usage.bind(null, e.id, "remove")}>
                      <button type="submit">-1</button>
                    </form>{" "}
                    <form className="inline" action={setAmount.bind(null, e.id)}>
                      <input name="amount" type="number" defaultValue={5} style={{ width: 50 }} /> <button type="submit">add amount</button>
                    </form>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        <code>posts</code> blocks past its limit (402 with an upgrade offer); <code>comments</code> only counts, and the app checks <code>can</code>.
      </p>

      <h2>Add-ons</h2>
      <table className="data">
        <tbody>
          {addons.map((a) => {
            const effective = plan.addons.includes(a.id);
            const own = (account.addons ?? []).includes(a.id);
            return (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className={effective ? "pass" : "muted"}>{effective ? "yes" : "no"}</td>
                <td className="muted">{own ? "granted to the account" : effective ? "from plan or incentive" : ""}</td>
                <td>
                  {own ? (
                    <form className="inline" action={revokeAddon.bind(null, a.id)}>
                      <button type="submit">Revoke</button>
                    </form>
                  ) : (
                    <form className="inline" action={grantAddon.bind(null, a.id)}>
                      <button type="submit">Grant</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Billing</h2>
      {sub ? (
        <>
          <p>
            <b>Subscription:</b> {sub.status}, {sub.interval} at ${sub.price}
            {sub.offer_name && ` via ${sub.offer_name}`}
            {sub.renews_at && `, renews ${new Date(sub.renews_at).toLocaleDateString()}`}
          </p>
          <form className="inline" action={subscription.bind(null, "sync")}>
            <button type="submit">Sync with PayPal</button>
          </form>{" "}
          <form className="inline" action={subscription.bind(null, "cancel")}>
            <button type="submit">Cancel subscription</button>
          </form>
        </>
      ) : (
        <p>
          No subscription. <Link href="/pricing">See pricing</Link> or <Link href="/pricing?offer=launch_50">the launch offer</Link>.
        </p>
      )}

      <fieldset>
        <legend>Testing levers</legend>
        <form action={changePlan}>
          <p>
            Switch plan without paying:{" "}
            <select name="plan" defaultValue={account.plan}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>{" "}
            <button type="submit">Change plan</button>
          </p>
        </form>
        <form action={applyPromo}>
          <p>
            Promo code: <input name="code" placeholder="BETA" size={10} />{" "}
            <select name="expires" defaultValue="0">
              <option value="0">never expires</option>
              <option value="1">expires in 1 minute</option>
              <option value="60">expires in 1 hour</option>
            </select>{" "}
            <button type="submit">Apply</button>
            {account.incentive && (
              <>
                {" "}
                <button type="submit" formAction={removeIncentive}>
                  Remove incentive
                </button>
              </>
            )}
          </p>
        </form>
        <form action={resetAccount}>
          <p>
            <button type="submit">Delete my Offer account</button> <span className="muted">(recreated on Free with zero usage)</span>
          </p>
        </form>
      </fieldset>

      <h2>From your browser</h2>
      <p className="muted">
        The core SDK&rsquo;s <code>&lt;OfferProvider&gt;</code> and <code>useOfferClient()</code>, calling the API directly with the publishable key.
      </p>
      <BrowserCheck apiUrl={OFFER_API_URL} appId={api.config.appId} publicKey={api.config.publicKey} accountId={user.id} />

      <DevLog title='GET "/account"' />
    </>
  );
}
