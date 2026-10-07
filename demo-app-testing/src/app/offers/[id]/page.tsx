import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { ensureAccount } from "@/lib/offer/account";
import { offerApi } from "@/lib/offer/client";
import type { OfferDoc } from "@/lib/offer/types";
import { currentUser } from "@/lib/session";
import { rename } from "../actions";

interface Preview {
  plans: {
    plan_id: string;
    entitlements: { id: string; name: string; max: number | null; source: string }[];
    addons: string[];
    changes?: { id: string; name: string; from: number | null | "none"; to: number | null }[];
  }[];
}

const max = (v: number | null | "none" | undefined) => (v === null ? "unlimited" : String(v));

export default async function OfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const api = await offerApi();
  const user = await currentUser();
  if (user) await ensureAccount(api, user);

  const [offer, stats, preview] = await Promise.all([
    api.get<OfferDoc & Record<string, unknown>>(`/offers/${id}`),
    api.get<Record<string, unknown>>(`/offers/${id}/stats`),
    // What each plan gives, and with an account, what would change for it.
    api.post<Preview>(`/offers/${id}/preview`, user ? { account: user.id } : {}),
  ]);

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <h1>{offer.name}</h1>
      <p>
        <b>Status:</b> {offer.status} ({offer.availability}) &middot; <b>Sold:</b> {offer.redemptions}
      </p>
      <form action={rename.bind(null, id)}>
        <p>
          Name <input name="name" defaultValue={offer.name} size={30} /> max redemptions{" "}
          <input name="max_redemptions" type="number" defaultValue={(offer.max_redemptions as number | null) ?? ""} style={{ width: 60 }} />{" "}
          <button type="submit">Update Offer</button>
        </p>
      </form>

      <h2>What it gives {user && <span className="muted">(changes for you)</span>}</h2>
      {preview.plans.map((p) => (
        <div key={p.plan_id}>
          <p>
            <b>{p.plan_id}</b>: {p.entitlements.map((e) => `${e.name} ${e.source === "offer" ? "★" : ""}${max(e.max)}`).join(", ")}
            {p.addons.length > 0 && ` + ${p.addons.join(", ")}`}
          </p>
          {p.changes && p.changes.length > 0 && (
            <ul>
              {p.changes.map((c) => (
                <li key={c.id}>
                  {c.name}: {max(c.from)} → {max(c.to)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <h2>Stats</h2>
      <pre>{JSON.stringify(stats, null, 2)}</pre>

      <h2>Record</h2>
      <pre>{JSON.stringify(offer, null, 2)}</pre>

      <Link href={`/pricing?offer=${id}${offer.status === "draft" ? "&preview=1" : ""}`}>Open checkout</Link> | <Link href="/offers">Back</Link>
      <DevLog title={`GET "/offers/${id}"`} />
    </>
  );
}
