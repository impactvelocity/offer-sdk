import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ArchitectureDiagram } from "@/components/docs/architecture";
import { DOCS_NAV } from "@/components/docs/nav";
import { Card, CardGrid, DocsHeader, H2, TermList } from "@/components/docs/prose";
import { DEVPOST_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Docs",
  description: "What Offer SDK is, how its API, dashboard and React SDK fit together, and where to start.",
};

export default function DocsOverviewPage() {
  return (
    <>
      <DocsHeader
        title="Offer SDK documentation"
        lead="A self-hosted API, dashboard and React SDK for plans, entitlements and offers. Integrate once, then change what any account can do from the dashboard, with no deploy."
      />

      <p>
        Most apps hardcode pricing: a plan name checked in a dozen places, a trial extended by editing a row, a
        partner discount handled with an <code>if</code> statement. Offer SDK moves those decisions into records you
        edit in a dashboard. Your app asks one question, “what can this account do?”, and gets back one answer that
        already includes the plan, any add-ons, the offer it bought through and any incentive on top.
      </p>

      <H2>The three parts</H2>
      <TermList
        items={[
          {
            term: "Offer API",
            children:
              "A Hono service on Bun with Postgres. It stores every app, account, plan and offer, resolves access, prices checkouts through PayPal and sends signed webhooks.",
          },
          {
            term: "Dashboard",
            children:
              "A Next.js app (offer-app) where your team edits the catalog, builds offers and cancel flows, reads analytics, manages keys and webhooks, and chats with an agent that can make changes for you.",
          },
          {
            term: "React SDK",
            children:
              "Providers and hooks that read an account's access in your app, plus headless components for a checkout page and a cancel flow that you style like the rest of your product.",
          },
        ]}
      />

      <H2>How it fits together</H2>
      <p>
        You deploy all of it yourself: the API, the dashboard, a Render Workflows service and a Postgres database,
        from one Blueprint. Your app talks to the API with app keys; the dashboard talks to it with a shared admin key.
      </p>
      <ArchitectureDiagram />

      <H2>Built for the PayPal AI Hackathon</H2>
      <p>
        Offer SDK is an entry in the <a href={DEVPOST_URL}>PayPal AI Hackathon</a>. PayPal handles every payment,
        Render hosts the stack and runs pauses as Workflows, Zapier carries webhooks to other apps, and Postman has a
        request for every API route. <Link href="/docs/sponsors">How sponsors are used</Link> covers each one, and{" "}
        <Link href="/docs/ai">AI features</Link> covers where Claude picks save offers and runs the dashboard agent.
      </p>

      {DOCS_NAV.slice(1).map((group) => (
        <Fragment key={group.title}>
          <H2>{group.title}</H2>
          <CardGrid>
            {group.items.map((item) => (
              <Card key={item.href} href={item.href} title={item.title}>
                {item.description}
              </Card>
            ))}
          </CardGrid>
        </Fragment>
      ))}
    </>
  );
}
