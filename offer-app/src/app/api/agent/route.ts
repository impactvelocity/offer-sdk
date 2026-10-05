import { createHmac } from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  generateText,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { WRITE_TOOLS, type WriteToolName } from "@/lib/agent/types";
import { agentAccess, agentError } from "@/server/agent/access";
import { titleFromText } from "@/lib/agent/title";
import { firstUserText, getThread, saveThread, THREAD_ID } from "@/server/agent/threads";
import { agentTools } from "@/server/agent/tools";
import { env } from "@/server/env";
import { OfferApiError } from "@/server/offer-api";
import { MOCK_ADMIN_KEY } from "@/server/offer-api/mock/routes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Chat endpoint for the Agent page (AI SDK UI message stream). Same access rule as the
// BFF, and each chat is a thread saved for the signed-in user: the incoming messages are
// saved before the model runs and the full conversation again when the response ends.

// Sonnet 5.5: half Opus 5.5's price, plenty for catalog lookups and edits.
const MODEL = "claude-sonnet-5-5";
const TITLE_MODEL = "claude-haiku-4-5-20251001";

const body = z.object({
  appId: z.string().min(1),
  /** The chat id from useChat, which is also the thread id. */
  id: z.string().regex(THREAD_ID),
  messages: z.array(z.custom<UIMessage>()).min(1),
});

// Every write tool stops for the user's approval in the chat before it runs.
const toolApproval = Object.fromEntries(WRITE_TOOLS.map((name) => [name, "user-approval"])) as Record<WriteToolName, "user-approval">;

// Approvals come back in client-sent history, so they're HMAC-signed when issued and
// verified before a write runs. Derived from a server secret unless one is set.
const approvalSecret = createHmac("sha256", env.AGENT_APPROVAL_SECRET ?? env.BETTER_AUTH_SECRET ?? env.OFFER_API_ADMIN_KEY ?? MOCK_ADMIN_KEY)
  .update("offer-agent-tool-approvals")
  .digest();

function instructions(appName: string, appId: string) {
  return `You are the assistant inside Offer SDK's dashboard, helping a team manage the "${appName}" app (id: ${appId}).

Offer SDK lets a team define a catalog once and change it per customer without shipping code:
- Plans bundle entitlements (features, or usage limits like "projects: 10") and carry pricing.
- Entitlements are either usage limits ("usage", counted against a max) or on/off features ("boolean").
- Add-ons are optional extras that plans and incentives can include.
- Incentives override an account's plan: higher or extra limits, plus add-ons. One per account.
- Accounts are the team's end customers. Each has one plan, optional add-ons and an optional incentive. The API calls them "namespaces"; always say "accounts".

Use the tools to look things up rather than guessing, and call several in parallel when they're independent. When the user wants to see, list or compare plans, entitlements, add-ons or incentives, call showCatalog so they get cards, then add a brief takeaway rather than repeating the cards.

You can change plans, entitlements, add-ons and incentives with the create/update/delete tools. Every change is shown to the user as a card they approve or decline before it runs, so:
- Look up the current records first, then call the write tool directly. Don't ask "shall I go ahead?" in text: the approval card is the confirmation.
- Send only the fields that change, and use existing ids exactly. New ids are lowercase snake_case.
- Batch related edits to one record into a single update call.
- If the user declines a change, don't retry it; ask what they'd like instead.
- After a change is applied, confirm it in one short sentence.
You can't change accounts yet; for that, point the user to the Accounts page.

Answer in short Markdown: lead with the answer, use tables for lists of records, and refer to records by name with the id in code formatting.`;
}

/** A short title for a new chat, from its first message. Null when the model call fails. */
async function generateTitle(anthropic: ReturnType<typeof createAnthropic>, firstMessage: string) {
  try {
    const { text } = await generateText({
      model: anthropic(TITLE_MODEL),
      instructions:
        "Write a title of 2 to 6 words for a chat that starts with the user's message below. Reply with the title only: no quotes, no trailing punctuation.",
      prompt: firstMessage.slice(0, 2000),
      maxOutputTokens: 30,
    });
    return text.trim().replace(/^["'“]+|["'”.]+$/g, "").slice(0, 80) || null;
  } catch (e) {
    console.error("[agent] title", e);
    return null;
  }
}

export async function POST(req: Request) {
  if (!env.ANTHROPIC_API_KEY) return agentError(503, "Set ANTHROPIC_API_KEY to enable the agent");

  const parsed = body.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) return agentError(400, "Invalid request");
  const { appId, id: threadId } = parsed.data;

  const access = await agentAccess(appId);
  if (access instanceof Response) return access;
  const { userId, appName } = access;

  const tools = agentTools(appId);
  const validated = await safeValidateUIMessages<UIMessage>({ messages: parsed.data.messages, tools });
  if (!validated.success) return agentError(400, "This chat has messages the agent can no longer read. Start a new chat.");
  const messages = validated.data;

  const isNew = !(await getThread(appId, userId, threadId));
  try {
    await saveThread(appId, userId, threadId, messages, isNew ? titleFromText(firstUserText(messages)) : undefined);
  } catch (e) {
    if (e instanceof OfferApiError) return agentError(e.status === 409 ? 403 : e.status, e.message);
    throw e;
  }

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  // Runs alongside the main response; it's saved with the finished conversation.
  const title = isNew ? generateTitle(anthropic, firstUserText(messages)) : null;

  const result = streamText({
    model: anthropic(MODEL),
    instructions: instructions(appName, appId),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    toolApproval,
    experimental_toolApprovalSecret: approvalSecret,
    stopWhen: stepCountIs(10),
    maxOutputTokens: 16000,
    abortSignal: req.signal,
    providerOptions: {
      anthropic: {
        // Show a summary of the thinking in the UI. Medium effort suits multistep tool use
        // (Sonnet 5.5 defaults to high).
        thinking: { type: "adaptive", display: "summarized" },
        effort: "medium",
        // Retry on another model if a safety classifier declines the request.
        fallbacks: "default",
      },
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onEnd: async ({ messages: finished }) => {
      try {
        await saveThread(appId, userId, threadId, finished, (await title) ?? undefined);
      } catch (e) {
        console.error("[agent] save thread", e);
      }
    },
    onError: (e) => {
      console.error("[agent]", e);
      return e instanceof Error ? e.message : "The agent hit an error";
    },
  });
}
