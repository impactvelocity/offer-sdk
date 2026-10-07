import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { offerApi } from "@/lib/offer/client";
import type { OfferDoc } from "@/lib/offer/types";
import { archive, createShareable, createTargeted, destroy, publish } from "./actions";

interface CheckoutRow {
  id: string;
  offer_id: string | null;
  plan_id: string;
  interval: string;
  status: string;
  total_today: number;
  account_id: string | null;
  email: string | null;
  ref: string | null;
  created_at: string;
}

const discountText = (d: OfferDoc["discount"]) =>
  !d ? "" : `${d.percent ? `${d.percent}%` : `$${d.amount_off}`} off${d.cycles ? ` × ${d.cycles}` : ""}`;

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const api = await offerApi();
  const [offers, checkouts] = await Promise.all([api.get<OfferDoc[]>("/offers"), api.get<CheckoutRow[]>("/checkouts")]);

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>Listing offers</h1>
      <table className="data">
        <thead>
          <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Discount</th>
            <th>Plans</th>
            <th>Sold</th>
            <th colSpan={5}></th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td>
                <code>{o.id}</code>
              </td>
              <td>{o.name}</td>
              <td>
                {o.type}
                {o.account_id && <span className="muted"> → {o.account_id.slice(0, 8)}…</span>}
              </td>
              <td className={o.status === "active" ? "pass" : "muted"}>{o.status}</td>
              <td>{discountText(o.discount)}</td>
              <td>{o.plans.map((p) => p.plan_id).join(", ")}</td>
              <td>{o.redemptions ?? 0}</td>
              <td>
                <Link href={`/offers/${o.id}`}>Show</Link>
              </td>
              <td>
                <Link href={`/pricing?offer=${o.id}${o.status === "draft" ? "&preview=1" : ""}`}>{o.status === "draft" ? "Preview" : "Checkout"}</Link>
              </td>
              <td>
                {o.status !== "active" && (
                  <form className="inline" action={publish.bind(null, o.id)}>
                    <button type="submit">Publish</button>
                  </form>
                )}
              </td>
              <td>
                {o.status === "active" && (
                  <form className="inline" action={archive.bind(null, o.id)}>
                    <button type="submit">Archive</button>
                  </form>
                )}
              </td>
              <td>
                <form className="inline" action={destroy.bind(null, o.id)}>
                  <button type="submit">Destroy</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {offers.length === 0 && <p className="muted">No offers. Run Setup.</p>}

      <h2>New offer</h2>
      <form action={createShareable}>
        <p>
          Shareable: id <input name="id" defaultValue="five_off" size={12} /> amount off $<input name="amount_off" type="number" defaultValue={5} style={{ width: 50 }} />{" "}
          <button type="submit">Create Offer</button>
        </p>
      </form>
      <form action={createTargeted}>
        <p>
          Targeted at me: <input name="percent" type="number" defaultValue={30} style={{ width: 50 }} />% off for 6 cycles, expires in 7 days{" "}
          <button type="submit">Create Offer</button>
        </p>
      </form>
      <p className="muted">Publishing needs a PayPal connection; without one the API answers with an error, which is shown as the flash.</p>

      <h2>Checkouts</h2>
      {checkouts.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Id</th>
              <th>Offer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Total</th>
              <th>Buyer</th>
              <th>Ref</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {checkouts.map((c) => (
              <tr key={c.id}>
                <td>
                  <code>{c.id}</code>
                </td>
                <td>{c.offer_id ?? "default"}</td>
                <td>
                  {c.plan_id} / {c.interval}
                </td>
                <td>{c.status}</td>
                <td>{c.total_today}</td>
                <td>{c.email ?? c.account_id}</td>
                <td>{c.ref}</td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DevLog title='GET "/offers"' />
    </>
  );
}
