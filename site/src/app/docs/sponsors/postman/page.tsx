import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Callout, Code, DocsHeader, H2, Step, Steps, Table, TermList } from "@/components/docs/prose";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata: Metadata = {
  title: "Postman",
  description:
    "A Postman collection with a request for every Offer API route, a Quickstart folder that sets up an app as it runs, and a Clean up folder that removes it.",
};

const COLLECTION = "/postman/offer-api.postman_collection.json";
const ENVIRONMENT = "/postman/offer-api.postman_environment.json";

export default function PostmanDocsPage() {
  return (
    <>
      <DocsHeader
        title="Postman"
        lead="The Offer API ships a Postman collection with a request for every route. Import it, run the Quickstart folder, and every other request has an app, keys and ids to work with."
      />

      <H2>Download</H2>
      <div className="docs-block flex flex-wrap gap-3">
        <a href={COLLECTION} download className={buttonVariants({ variant: "primary" })}>
          <Download />
          Collection
        </a>
        <a href={ENVIRONMENT} download className={buttonVariants({ variant: "secondary" })}>
          <Download />
          Environment for a deployed API
        </a>
      </div>
      <ul>
        <li>
          <strong>Collection</strong> (<code>offer-api.postman_collection.json</code>): every route in folders by
          resource, with example bodies, the right key per request, and scripts that save ids and keys as you go. It
          points at the local API by default.
        </li>
        <li>
          <strong>Environment</strong> (<code>offer-api.postman_environment.json</code>): only needed for a deployed API.
          It overrides <code>baseUrl</code> and <code>adminKey</code>.
        </li>
      </ul>
      <p>
        Both files live in <code>api/postman/</code> in the repo. Postman&apos;s <strong>Import</strong> also accepts
        the download links as a URL.
      </p>

      <H2>Get started</H2>
      <Steps>
        <Step title="Import the collection">
          <p>
            In Postman, choose <strong>Import</strong> and drop in <code>offer-api.postman_collection.json</code>. It
            shows up as <strong>Offer API</strong>.
          </p>
        </Step>
        <Step title="Point it at your API">
          <p>
            For a local API (<code>pnpm dev:api</code>) there is nothing to set: <code>baseUrl</code> starts as{" "}
            <code>http://localhost:6767</code> and <code>adminKey</code> as the local <code>dev-admin-key</code>.
          </p>
          <p>
            For a deployed API, import <code>offer-api.postman_environment.json</code>, select{" "}
            <strong>Offer API (deployed)</strong> in the environment menu, and set <code>baseUrl</code> to your API&apos;s
            URL and <code>adminKey</code> to its <code>ADMIN_API_KEY</code>.
          </p>
        </Step>
        <Step title="Run Quickstart">
          <p>
            Open the <strong>Quickstart</strong> folder and send its requests in order, or press <strong>Run</strong> on
            the folder to send them all. <strong>Create an app</strong> saves the new app&apos;s id, secret key and
            publishable key into the collection variables. The rest creates a <code>posts</code> entitlement, a Free plan
            with 3 posts and a Pro plan with 100, an account called <code>user_42</code>, one recorded post, and an
            upgrade to Pro.
          </p>
        </Step>
        <Step title="Use the other folders">
          <p>
            Every other request now has an app and data to act on. Requests that create something save its id, so the
            next request in the folder uses it.
          </p>
        </Step>
      </Steps>
      <Callout title="Already have an app?">
        Skip Quickstart and set <code>appId</code>, <code>secretKey</code> and <code>publicKey</code> in the
        collection&apos;s <strong>Variables</strong> tab. The keys are under <strong>Developers → API keys</strong> in
        the dashboard.
      </Callout>

      <H2>Folders</H2>
      <TermList
        items={[
          { term: "Quickstart", children: "Creates an app and a small catalog, then reads and changes an account. Run it first." },
          { term: "Service", children: "Health check, the OpenAPI document, the reference page and the webhook event catalog. No key." },
          { term: "Apps", children: "Read and update the app, and rotate its keys. Rotating saves the new key." },
          {
            term: "Entitlements, Add-ons, Incentives, Plans",
            children: "The catalog: create, read and update records, and attach entitlements and add-ons to plans and incentives.",
          },
          { term: "Accounts, Usage", children: "Search and change accounts, mint account tokens, read access, and move usage counters." },
          {
            term: "Offers, Checkouts, Subscriptions, PayPal",
            children: (
              <>
                Selling through PayPal. These need a PayPal sandbox connection: set <code>paypalClientId</code> and{" "}
                <code>paypalClientSecret</code>, then send <strong>PayPal → Connect PayPal</strong>.
              </>
            ),
          },
          {
            term: "Cancel flows, Cancel sessions",
            children: "Create a flow from the template, preview its save offer, and walk a session through it with an account token.",
          },
          { term: "Analytics, Webhooks and events", children: "Usage reports, webhook endpoints, test sends, delivery logs and the event log." },
          { term: "Admin", children: "Workspaces, history import, pauses and agent threads. These use the admin key." },
          { term: "Clean up", children: "Deletes what the other folders created, ending with the app. Run it last, or skip it to keep the data." },
        ]}
      />

      <H2>Keys</H2>
      <p>
        The collection sends the app&apos;s secret key by default. Requests that a browser or another service would
        make send a different key, set on their <strong>Authorization</strong> tab:
      </p>
      <Table
        head={["Variable", "Key", "Used by"]}
        rows={[
          ["secretKey", <code key="k">key_…</code>, "Every request that doesn't say otherwise."],
          ["publicKey", <code key="k">pub_…</code>, "Browser routes: plan reads, usage, pricing, public offers and checkouts."],
          [
            "accountToken",
            <code key="k">act_…</code>,
            <>
              Cancel sessions. Send <strong>Accounts → Mint an account token</strong> first; tokens last an hour.
            </>,
          ],
          ["adminKey", <code key="k">ADMIN_API_KEY</code>, "The Admin folder and some of Clean up."],
        ]}
      />
      <p>
        Each request&apos;s description says which other keys it accepts. <Link href="/docs/api">Authentication</Link>{" "}
        explains what each key can do.
      </p>
      <Callout tone="warning" title="The variables hold real keys after a run.">
        Clear <code>secretKey</code>, <code>publicKey</code>, <code>accountToken</code> and <code>adminKey</code> before
        you export or share the collection.
      </Callout>

      <H2>Variables</H2>
      <Table
        mono={false}
        head={["Variable", "Starts as", "Set by"]}
        rows={[
          [<><code>baseUrl</code></>, <><code>http://localhost:6767</code></>, "You, or the environment."],
          [<><code>adminKey</code></>, <><code>dev-admin-key</code></>, "You, or the environment."],
          [<><code>appId</code>, <code>secretKey</code>, <code>publicKey</code></>, <>Empty</>, "Quickstart → Create an app."],
          [<><code>accountId</code></>, <><code>user_42</code></>, "You. The account most requests act on."],
          [<><code>freePlanId</code>, <code>planId</code></>, <><code>free</code>, <code>pro</code></>, "You."],
          [<><code>entitlementId</code>, <code>addonId</code>, <code>incentiveId</code></>, <><code>posts</code>, <code>priority_support</code>, <code>launch_boost</code></>, "You."],
          [<><code>offerId</code>, <code>flowId</code></>, <><code>launch</code>, <code>default</code></>, "You. Creating the cancel flow saves its id."],
          [<><code>checkoutId</code>, <code>sessionId</code>, <code>reportId</code>, <code>webhookId</code>, <code>deliveryId</code></>, <>Empty</>, "The request that creates each one."],
          [<><code>accountToken</code></>, <>Empty</>, "Accounts → Mint an account token."],
          [<><code>webhookUrl</code></>, <><code>https://example.com/offer-webhooks</code></>, "You. Point it at a receiver you can watch, such as webhook.site."],
          [<><code>paypalClientId</code>, <code>paypalClientSecret</code></>, <>Empty</>, "You, from a PayPal sandbox REST app."],
        ]}
      />

      <H2>Run the whole collection</H2>
      <p>
        The folders are ordered so the collection runs top to bottom: Quickstart sets up, the resource folders build on
        it, and Clean up removes everything. Use <strong>Run</strong> on the collection in Postman, or Newman, Postman&apos;s
        command-line runner:
      </p>
      <Code lang="bash" code="npx newman run api/postman/offer-api.postman_collection.json" />
      <p>
        Every request carries one test: no <code>5xx</code>. Some requests answer <code>404</code> or <code>409</code>{" "}
        on purpose in a full run. Requests that create a record Quickstart already made return <code>409</code>, and
        without PayPal connected, publishing, checkouts, subscriptions and save offers return <code>409</code> too.
      </p>

      <H2>Keep it in step with the API</H2>
      <p>
        The collection is generated. Requests are defined in <code>api/postman/requests.ts</code>, and the generator reads
        the API&apos;s own route table, so it refuses to build if a route has no request or a request has no route.
      </p>
      <Code
        lang="bash"
        code={`
cd api
bun run postman
# or, with the API running in Docker
docker compose exec api bun run postman`}
      />
      <p>
        <code>api/test/postman.test.ts</code> runs the same check in the API&apos;s test suite, and also fails when the
        committed JSON is out of date. Adding a route without a Postman request fails the tests.
      </p>
    </>
  );
}
