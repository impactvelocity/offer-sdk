import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocsHeader, H2, H3, Step, Steps, Table, TermList } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Cancel flows",
  description: "Edit the questions, save offers and confirmation your cancel button shows, test them in a live preview, and read the results.",
};

export default function CancelFlowsAdminPage() {
  return (
    <>
      <DocsHeader
        title="Cancel flows"
        lead="A cancel flow asks why a customer is leaving, makes a save offer, and only then cancels. You edit it in the dashboard and the React SDK renders it in your app, so changes need no deploy."
      />

      <p>
        The dashboard manages one cancel flow per app, under <strong>Cancel flow</strong> in the app nav (
        <code>/apps/[appId]/cancel-flow</code>). That page shows how the flow is doing. The editor is at{" "}
        <code>/apps/[appId]/cancel-flow/edit</code>. Adding the cancel button to your app is covered in the SDK&apos;s{" "}
        <Link href="/docs/sdk/cancel-flows">Cancel flows</Link> page.
      </p>
      <Callout title="Cancel flows need the Offer API.">
        The in-memory mock doesn&apos;t run them, so the <strong>Cancel flow</strong> nav item is hidden when the
        dashboard runs with <code>OFFER_API_URL=mock</code>.
      </Callout>

      <H2>Set up the flow</H2>
      <Steps>
        <Step title="Create it from the template">
          <p>
            On an app without a flow, click <strong>Create cancel flow</strong>. The template asks “Why are you
            cancelling?” with six answers, offers 30% off for 3 payments to “It&apos;s too expensive” and a pause to
            “I&apos;m not using it enough” and “I only needed it for a short project”, then asks for confirmation. The
            editor opens.
          </p>
        </Step>
        <Step title="Edit and save">
          <p>
            Change the questions, offers and confirmation, check them in the preview, and click{" "}
            <strong>Save flow</strong>. If something is missing, a <strong>Before you can save</strong> list says
            what, and saving is disabled.
          </p>
        </Step>
        <Step title="Turn it on">
          <p>
            New flows start off. Click <strong>Turn on</strong> on the flow page. While a flow is off, the SDK&apos;s
            cancel button can&apos;t open it, but the editor preview still works. <strong>Turn off</strong> takes it
            down again.
          </p>
        </Step>
      </Steps>

      <H2>Steps</H2>
      <p>
        A flow always runs in this order: your questions, then the save offer (if you have one), then the
        confirmation.
      </p>
      <TermList
        items={[
          {
            term: "Question",
            children: (
              <>
                A title, an optional description and between 2 and 12 answers. Per answer, tick{" "}
                <strong>Ask for details</strong> to show a text box, or <strong>Skip offer</strong> to go straight to
                the confirmation.
              </>
            ),
          },
          {
            term: "Free text",
            children: (
              <>
                A title, an optional description and <strong>Placeholder</strong>, and a <strong>Required</strong>{" "}
                checkbox.
              </>
            ),
          },
          {
            term: "Save offer",
            children:
              "Shown after the questions, before the customer can cancel. Turn it on with the switch on its section. It is skipped when no offer applies to the customer.",
          },
          {
            term: "Confirmation",
            children: (
              <>
                <strong>Title</strong>, <strong>Description</strong> and <strong>Button</strong>. Pressing the button
                cancels the PayPal subscription and moves the account to the free plan.
              </>
            ),
          },
        ]}
      />
      <p>
        Add questions with <strong>Question</strong> or <strong>Free text</strong>, and reorder them with the arrows on
        each card. Answers decide which save offer shows, and they appear in the results and in webhooks.
      </p>
      <Callout title="Billing outside PayPal.">
        For accounts that don&apos;t pay through PayPal, the confirmation only marks the account as cancelled. Listen
        for the <code>cancel_flow.cancelled</code> webhook and cancel them in your own billing. See{" "}
        <Link href="/docs/api/webhooks">Webhooks</Link>.
      </Callout>

      <H2>Save offers</H2>
      <p>There are four kinds of save offer:</p>
      <Table
        mono={false}
        head={["Kind", "What the customer gets", "Settings"]}
        rows={[
          ["Discount", "A lower price for a few payments. The customer approves it on PayPal.", "Percent off (1 to 90) for a number of payments (1 to 24)"],
          ["Pause", "No billing for a few months, then billing resumes on the same plan.", "Months (1 to 12)"],
          ["Downgrade", "A move to a cheaper plan. The customer approves it on PayPal.", "Which paid plan"],
          ["Incentive", "Extra features or limits for a while, at the same price.", "Which incentive, and for how many months (1 to 24)"],
        ]}
      />
      <p>
        Under <strong>Offer for each answer</strong>, pick an offer (or <strong>No offer</strong>) for every answer that
        doesn&apos;t skip the offer. <strong>Everyone else</strong> covers answers without their own offer. When a
        customer gave several answers, the first answer with an offer wins. The section also has an optional{" "}
        <strong>Eyebrow</strong> (the short line above the offer, “Before you go” in the template) and the{" "}
        <strong>Decline button</strong> text, which defaults to “No thanks, continue cancelling”.
      </p>
      <p>
        An incentive offer applies the incentive right away and ends it after the chosen months. Discounts and
        downgrades change the PayPal subscription once the customer approves on PayPal.
      </p>

      <H3>Static and dynamic offers</H3>
      <p>
        By default the offer is static: the one you picked for the answer. Turn on <strong>Dynamic offers</strong> to
        let the agent choose instead. It reads why this customer is leaving, their plan, tenure and usage, picks the
        offer most likely to keep them, and writes its copy. It can only choose inside the guardrails you set:
      </p>
      <TermList
        items={[
          { term: "Agent may offer", children: "Which of the four kinds it can use." },
          { term: "Max % off", children: "The largest discount, from 1 to 90." },
          { term: "Max payments", children: "How many payments a discount can last, from 1 to 24." },
          { term: "Max pause (mo)", children: "The longest pause, from 1 to 12 months." },
          { term: "Max bonus (mo)", children: "The longest incentive, from 1 to 24 months." },
          { term: "Incentives it can give", children: "Shown when Incentive is allowed. Tick the incentives it may apply." },
          {
            term: "Plans it can move them to",
            children: "Shown when Downgrade is allowed. With none ticked, any cheaper plan.",
          },
          {
            term: "Instructions",
            children: "Optional. Your voice, and anything the agent should know about your customers.",
          },
        ]}
      />
      <p>
        The API enforces the guardrails itself. It re-checks the kind, the caps, the plan and the incentive the agent
        returns, and clamps or drops anything out of bounds. If the agent can&apos;t decide, the call fails or the API has
        no key, the customer gets the static offer for their answer.
      </p>
      <Callout tone="warning" title="Dynamic offers need ANTHROPIC_API_KEY on the API.">
        The key goes on the API service, which makes the call. The dashboard&apos;s own key only powers the{" "}
        <Link href="/docs/admin/agent">Agent</Link>. Without it, the editor shows a warning and the flow page lists
        dynamic offers as “On, but the API has no ANTHROPIC_API_KEY”. The API uses <code>claude-opus-5-5</code> unless
        you set <code>DECIDE_MODEL</code>.
      </Callout>

      <H3>Pauses</H3>
      <p>
        A pause stops billing and resumes it on schedule. By default the API runs the resume itself. Set both{" "}
        <code>RENDER_API_KEY</code> and <code>RENDER_WORKFLOW_SLUG</code> on the API to run pauses as Render Workflow
        tasks instead. The flow page&apos;s{" "}
        <strong>Pauses run on</strong> field shows which one is active. See <Link href="/docs/sponsors/render">Render</Link>.
      </p>

      <H2>Preview</H2>
      <p>
        The right side of the editor renders the flow with the real SDK components, using your unsaved steps. Nothing
        is saved or charged. The controls above it:
      </p>
      <TermList
        items={[
          {
            term: "Start at",
            children: (
              <>
                <strong>From the start</strong>, <strong>Jump to offer</strong> or <strong>Jump to confirmation</strong>.
              </>
            ),
          },
          { term: "Assumed answer", children: "The answer to use when you jump past the questions." },
          {
            term: "Price for account ID",
            children: "Optional. Prices the offer for a real account. Without it, the API uses a sample customer.",
          },
          {
            term: "Ask the agent",
            children: "Shown when dynamic offers are on. Calls the agent for each preview, so leave it off while you edit text.",
          },
        ]}
      />
      <p>
        Under the preview, a line says whether a fixed offer or the agent&apos;s pick is showing, quotes the
        agent&apos;s reasoning, or explains why it was skipped. The offer comes from{" "}
        <code>POST /apps/:appId/cancel-flows/:id/preview-offer</code>, so prices and copy match what a customer would
        get.
      </p>

      <H2>Results</H2>
      <p>The flow page shows the last 30 days:</p>
      <TermList
        items={[
          {
            term: "Totals",
            children: (
              <>
                <strong>Cancel attempts</strong> (and how many closed the flow), <strong>Saved</strong>,{" "}
                <strong>Save rate</strong> (of those who decided) and <strong>Monthly revenue kept</strong> (and lost).
              </>
            ),
          },
          {
            term: "Why customers leave",
            children: "Each answer with how often it was picked, how many of those were saved or cancelled, and the save rate.",
          },
          {
            term: "Save offers",
            children: "Each offer kind with times shown, accepted and the take rate. Offers the agent picked carry an Agent badge.",
          },
          {
            term: "Recent attempts",
            children: (
              <>
                The latest 25 sessions with account, reason, offer and outcome: <strong>In progress</strong>,{" "}
                <strong>Saved</strong>, <strong>Cancelled</strong> or <strong>Closed</strong>. Click a row to open the
                account.
              </>
            ),
          },
        ]}
      />
      <p>
        The side panel shows the status, whether dynamic offers are on, where pauses run, an outline of the flow, and an{" "}
        <strong>Add it to your app</strong> snippet. The snippet mints an account token on your server with the secret
        key, then renders <code>&lt;CancelFlow.Trigger&gt;</code> and <code>&lt;CancelFlow.Dialog&gt;</code> inside a{" "}
        <code>&lt;CancelFlowProvider&gt;</code>. The full setup is in <Link href="/docs/sdk/cancel-flows">Cancel flows</Link>{" "}
        for the SDK, and how AI is used is in <Link href="/docs/ai">AI features</Link>.
      </p>
    </>
  );
}
