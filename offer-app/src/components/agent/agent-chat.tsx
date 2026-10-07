"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { Check, Copy, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolGroup, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { titleFromText } from "@/lib/agent/title";
import { isWriteTool, type ChangeResult, type WriteToolName } from "@/lib/agent/types";
import { keys } from "@/lib/api/hooks";
import type { AgentTools } from "@/server/agent/tools";
import { CatalogCards, type CatalogOutput } from "./catalog-cards";
import { ChangeCard } from "./change-card";
import { useThreadCache } from "./use-threads";

export type AgentMessage = UIMessage<unknown, UIDataTypes, InferUITools<AgentTools>>;
type Part = AgentMessage["parts"][number];
type ToolPart = Extract<Part, { type: `tool-${string}` }>;

/**
 * Text and reasoning render as-is. Lookups fold into one collapsed group per run; changes
 * (approval cards) and showCatalog (record cards) always render inline.
 */
type Segment =
  | { kind: "part"; part: Part }
  | { kind: "tools"; parts: ToolPart[] }
  | { kind: "change"; part: ToolPart }
  | { kind: "catalog"; part: ToolPart };

function segment(parts: Part[]): Segment[] {
  const out: Segment[] = [];
  for (const part of parts) {
    // Step boundaries and empty thinking blocks don't break up a run of tool calls.
    if (part.type === "step-start" || (part.type === "reasoning" && !part.text && part.state !== "streaming")) continue;
    if (isToolUIPart(part)) {
      const name = getToolName(part);
      if (isWriteTool(name)) out.push({ kind: "change", part: part as ToolPart });
      else if (name === "showCatalog") out.push({ kind: "catalog", part: part as ToolPart });
      else {
        const last = out.at(-1);
        if (last?.kind === "tools") last.parts.push(part as ToolPart);
        else out.push({ kind: "tools", parts: [part as ToolPart] });
      }
    } else {
      out.push({ kind: "part", part });
    }
  }
  return out;
}

const TOOL_LABELS: Partial<Record<keyof AgentTools, string>> = {
  getAppOverview: "Looked at the app overview",
  getCatalog: "Read the catalog",
  searchAccounts: "Searched accounts",
  findAccountsNearLimits: "Checked accounts against their limits",
  getAccount: "Opened an account",
  getUsage: "Checked usage",
  getTopAccounts: "Ranked accounts by usage",
};

const CATALOG_LOADING: Record<CatalogOutput["kind"], string> = {
  plans: "Loading plans…",
  entitlements: "Loading entitlements…",
  addons: "Loading add-ons…",
  incentives: "Loading incentives…",
};

function ToolCall({ part }: { part: ToolPart }) {
  const name = getToolName(part) as keyof AgentTools;
  return (
    <Tool>
      <ToolHeader title={TOOL_LABELS[name] ?? name} state={part.state} />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  );
}

const SUGGESTIONS = [
  "Show me our plans",
  "Which accounts are closest to their limits?",
  "Raise the Pro plan's AI credits by 50%",
  "Create a Black Friday incentive that doubles AI credits",
];

export function AgentChat({
  appId,
  appName,
  threadId,
  initialMessages,
  enabled,
  onFirstMessage,
}: {
  appId: string;
  appName?: string;
  threadId: string;
  initialMessages: AgentMessage[];
  enabled: boolean;
  /** Called when a brand-new chat sends its first message (the thread now exists). */
  onFirstMessage?: () => void;
}) {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();
  const threads = useThreadCache(appId);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent", body: { appId } }), [appId]);

  const { messages, sendMessage, status, stop, regenerate, error, addToolApprovalResponse } = useChat<AgentMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    // After the user approves or declines every pending change, continue the turn.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message, messages: all }) => {
      threads.setMessages(threadId, all);
      void threads.refreshList();
      // A change ran: refresh the dashboard's catalog (nav counts, plan pages, …).
      if (message.parts.some((p) => isToolUIPart(p) && isWriteTool(getToolName(p)) && p.state === "output-available")) {
        void queryClient.invalidateQueries({ queryKey: keys.app(appId) });
      }
    },
  });

  // Keep the cached thread current when leaving mid-stream, so switching back shows it all.
  const latest = useRef(messages);
  useEffect(() => {
    latest.current = messages;
  }, [messages]);
  useEffect(() => () => threads.setMessages(threadId, latest.current), [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (messages.length === 0) {
      threads.addOptimistic(threadId, titleFromText(trimmed));
      onFirstMessage?.();
    }
    void sendMessage({ text: trimmed });
    setInput("");
  };

  const respond = (id: string, approved: boolean) => void addToolApprovalResponse({ id, approved });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <ConversationEmptyState
          icon={
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-vertical text-accent-contrast shadow-sm [&_svg]:size-5">
              <Sparkles />
            </div>
          }
          title={appName ? `Ask about ${appName}` : "Ask the agent"}
          description="It can look up and change your plans, entitlements, add-ons and incentives. You approve every change."
          className="flex-1"
        >
          <Suggestions className="mt-2 max-w-[640px]">
            {SUGGESTIONS.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={send} />
            ))}
          </Suggestions>
        </ConversationEmptyState>
      ) : (
        <Conversation>
          <ConversationContent>
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                streaming={busy && index === messages.length - 1}
                isLast={index === messages.length - 1}
                onRegenerate={() => void regenerate()}
                onRespond={respond}
              />
            ))}
            {status === "submitted" && messages.at(-1)?.role === "user" ? (
              <Shimmer className="text-sm">Working on it…</Shimmer>
            ) : null}
            {error ? (
              <Callout
                tone="danger"
                title="Something went wrong"
                action={
                  <Button size="xs" onClick={() => void regenerate()}>
                    <RotateCw />
                    Retry
                  </Button>
                }
              >
                {error.message}
              </Callout>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div className="mx-auto w-full max-w-[760px] px-6 pb-5">
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={appName ? `Ask about ${appName}…` : "Ask anything…"}
            disabled={!enabled}
            autoFocus
          />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onStop={stop} disabled={!enabled || !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  streaming,
  isLast,
  onRegenerate,
  onRespond,
}: {
  message: AgentMessage;
  streaming: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  return (
    <Message from={message.role}>
      <MessageContent>
        {segment(message.parts).map((seg, i) => {
          const key = `${message.id}-${i}`;
          if (seg.kind === "change") {
            const { part } = seg;
            return (
              <ChangeCard
                key={part.toolCallId}
                part={{
                  name: getToolName(part) as WriteToolName,
                  state: part.state,
                  input: part.input,
                  output: part.state === "output-available" ? (part.output as ChangeResult) : undefined,
                  errorText: part.errorText,
                  approval: part.approval,
                }}
                canRespond={isLast && !streaming}
                onRespond={onRespond}
              />
            );
          }
          if (seg.kind === "catalog") {
            const { part } = seg;
            if (part.state === "output-available") return <CatalogCards key={part.toolCallId} output={part.output as CatalogOutput} />;
            if (part.state === "output-error") return <ToolCall key={part.toolCallId} part={part} />;
            const kind = (part.input as { kind?: CatalogOutput["kind"] } | undefined)?.kind;
            return (
              <Shimmer key={part.toolCallId} className="text-sm">
                {kind ? CATALOG_LOADING[kind] : "Loading…"}
              </Shimmer>
            );
          }
          if (seg.kind === "tools") {
            return seg.parts.length === 1 ? (
              <ToolCall key={key} part={seg.parts[0]} />
            ) : (
              <ToolGroup key={key} count={seg.parts.length} states={seg.parts.map((p) => p.state)}>
                {seg.parts.map((p) => (
                  <ToolCall key={p.toolCallId} part={p} />
                ))}
              </ToolGroup>
            );
          }
          const { part } = seg;
          if (part.type === "text") {
            return message.role === "user" ? (
              <span key={key}>{part.text}</span>
            ) : (
              <MessageResponse key={key} isAnimating={streaming && part.state === "streaming"}>
                {part.text}
              </MessageResponse>
            );
          }
          if (part.type === "reasoning") {
            return <Reasoning key={key} text={part.text} isStreaming={part.state === "streaming"} />;
          }
          return null;
        })}
      </MessageContent>
      {message.role === "assistant" && text && !streaming ? (
        <MessageActions className="-ml-1.5">
          <MessageAction
            tooltip={copied ? "Copied" : "Copy"}
            onClick={() => {
              void navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </MessageAction>
          {isLast ? (
            <MessageAction tooltip="Regenerate" onClick={onRegenerate}>
              <RotateCw />
            </MessageAction>
          ) : null}
        </MessageActions>
      ) : null}
    </Message>
  );
}
