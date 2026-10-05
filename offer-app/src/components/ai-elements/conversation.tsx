"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/conversation) onto the app's Button and tokens.

import { ArrowDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content className={cn("mx-auto flex w-full max-w-[760px] flex-col gap-7 px-6 py-8", className)} {...props} />
);

export type ConversationEmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div className={cn("flex size-full flex-col items-center justify-center gap-4 p-8 text-center", className)} {...props}>
    {icon ? <div className="text-fg-icon">{icon}</div> : null}
    <div className="space-y-1.5">
      <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
      {description ? <p className="text-sm text-fg-tertiary">{description}</p> : null}
    </div>
    {children}
  </div>
);

export const ConversationScrollButton = ({ className }: { className?: string }) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <Button
      icon
      size="sm"
      aria-label="Scroll to latest"
      className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md", className)}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown />
    </Button>
  );
};
