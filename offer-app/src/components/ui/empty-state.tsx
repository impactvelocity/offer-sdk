import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Line-art illustration in the spirit of Attio's empty states, with the page's icon in the centre. */
function Illustration({ icon }: { icon: ReactNode }) {
  const id = `es${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="relative h-[88px] w-[200px]">
      <svg viewBox="0 0 200 88" fill="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-from)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--brand-to)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-from)" stopOpacity="0.1" />
            <stop offset="1" stopColor="var(--brand-to)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M62 44H30M138 44h22" stroke="var(--border-strong)" strokeDasharray="3 3" />
        <path d="M100 22V8M100 80V66" stroke="var(--border)" strokeDasharray="3 3" />
        <path
          d="M170 30.5 182 37.4v13.2L170 57.5l-12-6.9V37.4z"
          fill="var(--bg)"
          stroke="var(--border-strong)"
        />
        <path d="M24 32.5 34.4 38.5v12L24 56.5l-10.4-6v-12z" fill="var(--bg)" stroke="var(--border-strong)" />
        <circle cx="100" cy="44" r="34" stroke="var(--border)" />
        <circle cx="100" cy="44" r="24" fill={`url(#${id}-wash)`} stroke={`url(#${id}-ring)`} />
      </svg>
      <div className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-[color-mix(in_oklch,var(--brand-from)_35%,transparent)] bg-bg text-brand-from shadow-xs [&_svg]:size-4">
        {icon}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-16", className)}>
      {compact ? (
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-border bg-bg text-fg-icon shadow-xs [&_svg]:size-4">
          {icon}
        </div>
      ) : (
        <Illustration icon={icon} />
      )}
      <h3 className={cn("text-lg font-semibold text-fg", !compact && "mt-6")}>{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-fg-tertiary">{description}</p> : null}
      {action ? <div className="mt-5 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
