import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Code, DocsHeader, H2, H3, Step, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Cancel flows",
  description: "Add a cancel button that asks why, shows a save offer, and cancels or pauses the PayPal subscription.",
};

const mintToken = `curl -X POST http://localhost:6767/apps/$APP_ID/namespaces/user_42/token \\
  -H "Authorization: Bearer $OFFER_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "ttl_seconds": 3600 }'`;

const tokenResponse = `{
  "account_id": "user_42",
  "token": "act_eyJhIjoiYXBwX0FiQ2RFZiIsIm4iOiJ1c2VyXzQyIiwiZSI6MTc5MDg1OTYwMH0.Xk2…",
  "expires_at": "2026-10-01T13:00:00.000Z"
}`;

const serverPage = `// app/account/page.tsx
import { OfferClient } from "@offer/sdk";
import { requireUser } from "@/lib/session"; // your own auth helper
import { CancelButton } from "./cancel-button";

const offer = new OfferClient({ baseUrl: process.env.OFFER_API_URL, apiKey: process.env.OFFER_SECRET_KEY });

export default async function AccountPage() {
  const user = await requireUser();
  const appId = process.env.OFFER_APP_ID!;

  // Minted on every render with the secret key. Only the token reaches the browser.
  const { token } = await offer.request<{ token: string; expires_at: string }>(
    \`/apps/\${appId}/namespaces/\${encodeURIComponent(user.id)}/token\`,
    { method: "POST", body: JSON.stringify({ ttl_seconds: 3600 }) },
  );

  return <CancelButton apiUrl={process.env.OFFER_API_URL!} appId={appId} token={token} />;
}`;

const clientButton = `// app/account/cancel-button.tsx
"use client";

import { CancelFlow, CancelFlowProvider } from "@offer/sdk/cancel";
import { useRouter } from "next/navigation";

export function CancelButton(props: { apiUrl: string; appId: string; token: string }) {
  const router = useRouter();
  return (
    <CancelFlowProvider {...props} onSaved={() => router.refresh()} onCancelled={() => router.refresh()}>
      <CancelFlow.Trigger className="link-danger">Cancel subscription</CancelFlow.Trigger>
      <CancelFlow.Dialog className="cancel-dialog" />
    </CancelFlowProvider>
  );
}`;

const customOffer = `// import { CancelFlow, offerSummary } from "@offer/sdk/cancel";
<CancelFlow.Dialog className="cancel-dialog">
  <CancelFlow.Close />
  <CancelFlow.Question />
  <CancelFlow.Text />
  <CancelFlow.Offer>
    {(offer, step, { accept, decline, phase }) => (
      <div className="save-offer" data-kind={offer.kind}>
        <h2>{offer.headline}</h2>
        <p>{offer.body}</p>
        <p>{offerSummary(offer)}</p>
        <button type="button" disabled={phase !== "ready"} onClick={() => void accept()}>{offer.cta}</button>
        <button type="button" onClick={() => void decline()}>{step.decline_label ?? "No thanks"}</button>
      </div>
    )}
  </CancelFlow.Offer>
  <CancelFlow.Confirm />
  <CancelFlow.Done />
  <CancelFlow.Error />
</CancelFlow.Dialog>`;

const transportType = `export interface CancelTransport {
  start(flow?: string | null): Promise<CancelSession>;
  answer(sessionId: string, body: { step: string; answer?: string | null; text?: string | null }): Promise<CancelSession>;
  back(sessionId: string): Promise<CancelSession>;
  decline(sessionId: string): Promise<CancelSession>;
  accept(sessionId: string, urls?: { return_url?: string; cancel_url?: string }): Promise<CancelSession>;
  cancel(sessionId: string): Promise<CancelSession>;
  close(sessionId: string): Promise<CancelSession>;
}`;

const transportUse = `import { CancelClient, CancelFlow, CancelFlowProvider, type CancelTransport } from "@offer/sdk/cancel";

// Logs every step, then calls the API as usual.
function loggingTransport(inner: CancelTransport): CancelTransport {
  return {
    start: (flow) => inner.start(flow),
    answer: (id, body) => {
      analytics.track("cancel_flow_answer", body);
      return inner.answer(id, body);
    },
    back: (id) => inner.back(id),
    decline: (id) => inner.decline(id),
    accept: (id, urls) => inner.accept(id, urls),
    cancel: (id) => inner.cancel(id),
    close: (id) => inner.close(id),
  };
}

const transport = loggingTransport(new CancelClient({ apiUrl, appId, token }));

<CancelFlowProvider transport={transport}>
  <CancelFlow.Trigger />
  <CancelFlow.Dialog />
</CancelFlowProvider>`;

const sessionView = `{
  "id": "cxl_Q2wErTyUiOpAsDfG",
  "status": "open",
  "flow": { "id": "default", "name": "Cancel flow" },
  "step": { "id": "offer", "type": "offer", "title": "Before you go", "decline_label": null },
  "progress": { "index": 1, "total": 3 },
  "can_go_back": true,
  "offer": {
    "kind": "discount",
    "source": "dynamic",
    "details": { "percent": 30, "cycles": 3, "price": 34.3, "regular_price": 49, "currency": "USD", "interval": "month" },
    "headline": "Stay for 30% less",
    "body": "Keep everything you've built for $34.30/month for the next 3 months.",
    "cta": "Keep my plan for less",
    "status": "shown"
  },
  "approve_url": null,
  "result": null,
  "account": {
    "id": "user_42",
    "plan_name": "Pro",
    "subscription": { "price": 49, "currency": "USD", "interval": "month", "renews_at": "2026-11-01T12:00:00.000Z" }
  }
}`;

export default function SdkCancelFlowsPage() {
  return (
    <>
      <DocsHeader
        title="Cancel flows"
        lead="A cancel button that runs the flow you set up in the dashboard: ask why the customer is leaving, show a save offer, then cancel, pause or change their PayPal subscription."
      />

      <p>
        What the flow asks and offers lives in the dashboard, so you can change it without a deploy. Your code adds a
        button and a dialog, and your server mints a short-lived token for the signed-in account. Set up the steps,
        questions and save offers in <Link href="/docs/admin/cancel-flows">Dashboard: Cancel flows</Link>.
      </p>
      <p>
        The SDK lives in <code>offer-app/src/sdk/cancel</code>. The dashboard imports it as{" "}
        <code>@/sdk/cancel</code>; in your app, map <code>@offer/sdk/cancel</code> to it as shown in{" "}
        <Link href="/docs/sdk">Access and entitlements</Link>.
      </p>

      <H2>Add a cancel button</H2>
      <Steps>
        <Step title="Activate a flow">
          <p>
            Create a flow in the dashboard and set it to active. Without a <code>flow</code> prop, the SDK runs the
            app&apos;s active flow, preferring the one with id <code>default</code>. Account tokens can only start
            active flows.
          </p>
        </Step>
        <Step title="Mint an account token on your server">
          <p>
            Call <code>POST /apps/:appId/namespaces/:accountId/token</code> with the secret key. The token can act for
            that one account and nothing else, so it is safe in the browser. The publishable key can&apos;t start a
            cancel flow.
          </p>
          <Code lang="bash" code={mintToken} />
          <Code title="201 Created" lang="json" code={tokenResponse} />
        </Step>
        <Step title="Render the provider">
          <p>
            Pass the token to a client component. <code>CancelFlow.Trigger</code> opens the flow and{" "}
            <code>CancelFlow.Dialog</code> shows it in a modal <code>&lt;dialog&gt;</code>.
          </p>
          <Code title="app/account/page.tsx" lang="tsx" code={serverPage} />
          <Code title="app/account/cancel-button.tsx" lang="tsx" code={clientButton} />
        </Step>
      </Steps>
      <p>
        The dashboard&apos;s <code>/demo/account</code> page is this pattern end to end, with the token minted on the
        server and the flow styled as a sample app.
      </p>

      <H2>Account tokens</H2>
      <Table
        head={["Detail", "Value"]}
        rows={[
          ["Format", <>
            <code>act_&lt;payload&gt;.&lt;signature&gt;</code>: the app id, account id and expiry, signed with
            HMAC-SHA256 using the app&apos;s secret key.
          </>],
          ["Lifetime", <>
            <code>ttl_seconds</code> from 60 to 86,400. The default is 3,600 (one hour).
          </>],
          ["Revoking", "Regenerating the app's secret key invalidates every token at once."],
          ["Can call", <>
            Every <code>/apps/:appId/cancel-sessions</code> route for its own account, and{" "}
            <code>GET</code> on its own <code>/plan</code>, <code>/full-plan</code> and <code>/subscription</code>.
          </>],
        ]}
      />
      <p>
        The provider doesn&apos;t refresh tokens. Mint one when you render the page, with a lifetime longer than a
        visit. A session from another account answers <code>404</code>, so a token can&apos;t find out that other
        sessions exist.
      </p>
      <Callout tone="warning" title="Mint tokens on your server only.">
        Minting needs the secret key, which can change any record in the app. Check that the signed-in user owns the
        account before you mint a token for it.
      </Callout>

      <H2>CancelFlowProvider</H2>
      <Table
        head={["Prop", "Type", "Description"]}
        rows={[
          ["apiUrl", "string", "The Offer API's public URL."],
          ["appId", "string", "The app the account belongs to."],
          ["token", "string", "The account token from your server."],
          ["flow", "string | null", "A specific flow id. Defaults to the app's active flow."],
          ["transport", "CancelTransport", "Replaces the API client. With it, apiUrl, appId and token are optional."],
          ["returnUrl", "string", "Where PayPal sends the customer after approving a new price. Defaults to the current page."],
          ["paypal", "\"redirect\" | \"new-tab\" | \"manual\"", "How to open PayPal's approval page. redirect (the default) uses this tab; manual leaves it to you through session.approve_url."],
          ["onSaved", "(session) => void", "The customer accepted the save offer. Runs before any PayPal redirect."],
          ["onCancelled", "(session) => void", "The customer confirmed the cancellation."],
          ["onClose", "(session | null) => void", "The dialog closed. An unfinished session is recorded as abandoned."],
          ["fetch", "typeof fetch", "Optional custom fetch."],
        ]}
      />

      <H2>Components</H2>
      <p>
        <code>CancelFlow.*</code> components render plain, unstyled markup with <code>data-*</code> attributes for
        state, and take <code>className</code>. <code>CancelFlow.Dialog</code> renders <code>CancelFlow.Steps</code>{" "}
        when you give it no children. Pass children to lay out the pieces yourself.
      </p>
      <Table
        head={["Component", "Renders"]}
        rows={[
          ["CancelFlow.Trigger", "A button that opens the flow and starts a session. Children default to “Cancel subscription”."],
          ["CancelFlow.Dialog", "A modal <dialog> while the flow is open. Escape or a backdrop click closes it."],
          ["CancelFlow.Steps", "Whichever step is current, then the outcome, with close and error."],
          ["CancelFlow.Question", "The question, its answers as radio buttons, and a text box when the answer asks for detail."],
          ["CancelFlow.Text", "A free-text step."],
          ["CancelFlow.Offer", "The save offer with accept and decline buttons."],
          ["CancelFlow.Confirm", "The last step, with the button that cancels for real."],
          ["CancelFlow.Done", "What happened: saved, paused or cancelled, and a PayPal link when approval is pending."],
          ["CancelFlow.Progress", "One span per step, marked data-done or data-current."],
          ["CancelFlow.Back, Close, Error", "The back button (when the session can go back), a close button and the last error."],
        ]}
      />
      <p>
        <code>Question</code>, <code>Text</code>, <code>Offer</code>, <code>Confirm</code> and <code>Done</code> also
        take a function as <code>children</code> with the step (or offer, or session) and the full context.{" "}
        <code>offerSummary(offer)</code> turns an offer&apos;s numbers into one line, such as &ldquo;$34.30/month for
        3 months, then $49&rdquo;.
      </p>
      <Code title="A custom offer step" lang="tsx" code={customOffer} />
      <Table
        head={["Attribute", "On"]}
        rows={[
          ["data-phase", "Steps: idle, loading, ready, working or redirecting."],
          ["data-step-type", "Steps: question, text, offer or confirm, then the session status. loading before the session starts."],
          ["data-cancel-step", "Each step's root element."],
          ["data-kind, data-source", "The offer step: the offer kind, and static or dynamic."],
          ["data-status", "Done: saved or cancelled."],
          ["data-selected", "The chosen answer."],
          ["data-cancel-primary", "The main button of a step."],
          ["data-cancel-secondary", "The way out: decline, keep the subscription, done."],
          ["data-cancel-danger", "The button that cancels."],
        ]}
      />

      <H3>useCancelFlow()</H3>
      <p>
        Returns the provider&apos;s state for a fully custom UI: <code>isOpen</code>, <code>phase</code>,{" "}
        <code>session</code>, <code>step</code>, <code>offer</code>, <code>error</code>, the current{" "}
        <code>choice</code> and <code>text</code>, and the actions <code>open</code>, <code>close</code>,{" "}
        <code>choose</code>, <code>setText</code>, <code>submit</code>, <code>back</code>, <code>accept</code>,{" "}
        <code>decline</code> and <code>confirmCancel</code>.
      </p>

      <H2>Steps and sessions</H2>
      <p>
        Each click is one API call, and each call returns the session as the customer should see it. A flow has four
        kinds of step: <code>question</code>, <code>text</code>, <code>offer</code> and <code>confirm</code>.
        Answers can branch to different steps. When the customer reaches the offer step, the API works out the offer
        for their answers. If no offer applies to this account, the step is skipped.
      </p>
      <Code title="POST /apps/:appId/cancel-sessions/:sessionId/answer" lang="json" code={sessionView} />
      <p>
        <code>source: &quot;dynamic&quot;</code> means Claude picked the offer for this customer, within the
        guardrails set on the flow. That needs <code>ANTHROPIC_API_KEY</code> on the API and dynamic offers turned on
        for the step. Otherwise the flow shows its static offer for the answers given.
      </p>
      <Table
        head={["Session status", "Meaning"]}
        rows={[
          ["open", "In progress."],
          ["saved", "The customer accepted the save offer."],
          ["cancelled", "The customer confirmed the cancellation."],
          ["abandoned", "The customer closed the flow before finishing."],
        ]}
      />

      <H2>Outcomes</H2>
      <p>
        Accepting the offer ends the session as <code>saved</code>. What happens to the subscription depends on the
        offer&apos;s kind.
      </p>
      <Table
        head={["Outcome", "What the API does", "Customer action"]}
        rows={[
          [
            "discount",
            "Changes the PayPal subscription to the discounted price for a number of renewals. The change applies once PayPal reports it.",
            "Approves the new price on PayPal.",
          ],
          [
            "downgrade",
            "Moves the subscription to a cheaper plan. It takes effect at the renewal date.",
            "Approves the new price on PayPal.",
          ],
          [
            "pause",
            "Suspends billing in PayPal for 1 to 12 months and moves the account to the free plan, if the app has one. It resumes on its own at resume_at, through a Render Workflow when one is configured.",
            "None.",
          ],
          [
            "incentive",
            "Applies an incentive to the account for a number of months, through incentive_expires_at.",
            "None.",
          ],
          [
            "cancel",
            "The confirm step. Cancels the PayPal subscription and moves the account to the free plan, if the app has one. Accounts billed elsewhere are only marked, so cancel those on the webhook.",
            "Confirms.",
          ],
        ]}
      />
      <p>
        For discounts and downgrades, the session comes back with <code>approve_url</code>. The provider opens it
        according to the <code>paypal</code> prop, and PayPal sends the customer back to <code>returnUrl</code>.
      </p>
      <p>
        The API sends <code>cancel_flow.saved</code> or <code>cancel_flow.cancelled</code> with the session, the
        answers and the offer. Pauses also send <code>subscription.paused</code>, and later{" "}
        <code>subscription.resumed</code>. See <Link href="/docs/api/webhooks">Webhooks</Link>.
      </p>

      <H2>The transport prop</H2>
      <p>
        The provider talks to the API through a <code>CancelTransport</code>. By default it builds a{" "}
        <code>CancelClient</code> from <code>apiUrl</code>, <code>appId</code> and <code>token</code>. Pass your own to
        wrap the client, or to run the flow without the API.
      </p>
      <Code title="offer-app/src/sdk/cancel/types.ts" lang="ts" code={transportType} />
      <Code title="Wrapping the API client" lang="tsx" code={transportUse} />
      <p>
        The dashboard&apos;s live preview uses a transport that walks unsaved steps in the browser and asks the API
        only for the offer. Nothing is saved and nobody is charged. It passes <code>paypal=&quot;manual&quot;</code>{" "}
        so accepting an offer never leaves the page.
      </p>

      <H2>Without React</H2>
      <p>
        The flow is plain HTTP, so your server or another frontend can drive it with an account token, or with the
        secret key and an <code>account</code> in the start body.
      </p>
      <Table
        head={["Route", "Body", "Does"]}
        rows={[
          ["POST /apps/:appId/cancel-sessions", "{ flow?, account? }", "Starts a session on the active flow, or on flow."],
          ["GET /apps/:appId/cancel-sessions/:sessionId", "", "The current session."],
          ["POST …/:sessionId/answer", "{ step, answer?, text? }", "Answers the current question or text step. step must match the current step."],
          ["POST …/:sessionId/back", "", "Goes back one step."],
          ["POST …/:sessionId/decline", "", "Turns down the offer."],
          ["POST …/:sessionId/accept", "{ return_url?, cancel_url? }", "Accepts the offer."],
          ["POST …/:sessionId/cancel", "", "Cancels, from the confirm step."],
          ["POST …/:sessionId/close", "", "Marks an open session abandoned."],
        ]}
      />
      <p>
        A call that doesn&apos;t fit the current step returns <code>409</code>. With the secret key,{" "}
        <code>GET /apps/:appId/cancel-sessions</code> lists recent sessions with every answer and why the offer was
        chosen.
      </p>
    </>
  );
}
