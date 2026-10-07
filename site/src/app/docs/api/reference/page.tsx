import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { DocsHeader, EndpointList, H2, Table } from "@/components/docs/prose";
import { ENDPOINT_GROUPS } from "./endpoints";

export const metadata: Metadata = {
  title: "Endpoint reference",
  description: "Every route the Offer API serves, grouped by resource, with the credential each one takes.",
};

export default function ApiReferencePage() {
  return (
    <>
      <DocsHeader
        title="Endpoint reference"
        lead="Every route the Offer API serves, grouped by resource. Paths are relative to the API's base URL, http://localhost:6767 when you run it locally."
      />

      <p>
        Under each route is the credential it takes. The admin key also works on every <code>/apps/:appId</code>{" "}
        route. <Link href="/docs/api">Authentication</Link> explains each credential and the error format. To send
        these requests, import the <Link href="/docs/sponsors/postman">Postman collection</Link>: it has every route
        below with an example body.
      </p>
      <Table
        mono={false}
        head={["Label", "Meaning"]}
        rows={[
          ["Secret key", <>The app&apos;s <code>key_…</code> key, from your server.</>],
          ["Secret or publishable key", <>The <code>pub_…</code> key works too, so the route can be called from a browser.</>],
          ["…or the account’s own token", <>An <code>act_…</code> token works, for its own account only.</>],
          ["Admin key only", <>The API&apos;s <code>ADMIN_API_KEY</code>. App keys get <code>401</code>.</>],
          ["No credential", "Open to anyone."],
        ]}
      />
      <p>
        Ids you choose for plans, entitlements, add-ons, incentives, offers and cancel flows are normalized:
        lowercased, spaces turned into underscores, and anything other than <code>a-z</code>, <code>0-9</code> and{" "}
        <code>_</code> removed. Use underscores in ids, since hyphens are dropped. Account ids are kept as you send
        them. Most <code>PATCH</code> routes merge the fields you send into the record, and none of them change its
        id.
      </p>

      {ENDPOINT_GROUPS.map((group) => (
        <Fragment key={group.title}>
          <H2>{group.title}</H2>
          {group.intro ? <p>{group.intro}</p> : null}
          <EndpointList endpoints={group.endpoints} />
        </Fragment>
      ))}
    </>
  );
}
