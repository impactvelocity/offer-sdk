"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/message) onto the app's Button, Tooltip and
// tokens. Markdown renders through Streamdown, which handles incomplete markdown mid-stream.

import type { UIMessage } from "ai";
import { memo, type ComponentProps, type HTMLAttributes } from "react";
import { Streamdown } from "streamdown";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & { from: UIMessage["role"] };

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-2",
      from === "user" ? "is-user ml-auto max-w-[85%] items-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export const MessageContent = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-3 text-sm text-fg",
      "group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-bg-muted group-[.is-user]:px-4 group-[.is-user]:py-2.5 group-[.is-user]:whitespace-pre-wrap",
      "group-[.is-assistant]:w-full",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const MessageActions = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex items-center gap-0.5", className)} {...props} />
);

export type MessageActionProps = Omit<ButtonProps, "ref"> & { tooltip?: string; label?: string };

export const MessageAction = ({ tooltip, label, children, variant = "ghost", size = "xs", ...props }: MessageActionProps) => {
  const button = (
    <Button icon variant={variant} size={size} aria-label={label || tooltip} {...props}>
      {children}
    </Button>
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
};

// Typography for the assistant's Markdown, in the app's tokens (Streamdown ships unstyled
// elements plus a few shadcn-named utilities, mapped in globals.css).
const prose = cn(
  "size-full text-sm leading-[1.65] text-fg [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2.5 [&_ul]:my-2.5 [&_ol]:my-2.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5",
  "[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold",
  "[&_strong]:font-semibold [&_a]:text-accent-fg [&_a]:underline [&_a]:underline-offset-2",
  "[&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:bg-bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:text-[13px]",
  "[&_table]:w-full [&_table]:text-[13px] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-border",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-fg-secondary [&_hr]:my-4",
);

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => <Streamdown className={cn(prose, className)} {...props} />,
  (prev, next) => prev.children === next.children && prev.isAnimating === next.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
