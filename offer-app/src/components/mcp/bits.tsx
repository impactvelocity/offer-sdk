import { CodeXml, Eye, MessageCircle, MousePointer2, Pencil, Plug, Sparkles, SquareTerminal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ACCESS_LEVELS, type AccessLevel, type ToolKind } from "@/components/developers/mcp-tools";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientId } from "./clients";

const clientIcons: Record<ClientId, ReactNode> = {
  claude: <Sparkles />,
  "claude-code": <SquareTerminal />,
  cursor: <MousePointer2 />,
  vscode: <CodeXml />,
  chatgpt: <MessageCircle />,
  other: <Plug />,
};

/** Neutral square tile per client (generic icons, not their logos). */
export function ClientIcon({ client, size = "md", className }: { client: ClientId; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-bg text-fg-icon shadow-xs",
        size === "sm" ? "size-6 [&_svg]:size-3.5" : "size-8 [&_svg]:size-4",
        className,
      )}
    >
      {clientIcons[client]}
    </span>
  );
}

const kinds: Record<ToolKind, { label: string; color: BadgeColor; icon: ReactNode }> = {
  read: { label: "Read", color: "blue", icon: <Eye /> },
  write: { label: "Write", color: "orange", icon: <Pencil /> },
  destructive: { label: "Destructive", color: "red", icon: <Trash2 /> },
};

export function KindBadge({ kind, className }: { kind: ToolKind; className?: string }) {
  const k = kinds[kind];
  return (
    <Badge color={k.color} icon={k.icon} className={className}>
      {k.label}
    </Badge>
  );
}

const accessColors: Record<AccessLevel, BadgeColor> = { read: "blue", write: "orange", full: "red" };

export function AccessBadge({ access }: { access: AccessLevel }) {
  return (
    <Badge color={accessColors[access]} dot>
      {ACCESS_LEVELS.find((l) => l.value === access)?.label}
    </Badge>
  );
}

export function statusColor(status: number): BadgeColor {
  if (status < 300) return "green";
  if (status < 500) return "orange";
  return "red";
}
