import type { ReactNode } from "react";

/**
 * Section opener, after neon.com: one large left-aligned statement where the title reads bright
 * and the lead continues it in a quieter tone.
 */
export function SectionHeading({
  title,
  lead,
  className,
}: {
  title: ReactNode;
  /** Continues the title in the same sentence size, dimmed. */
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="max-w-4xl font-display text-2xl font-medium tracking-wider text-balance sm:text-3xl lg:text-4xl">
        <span className="text-fg">{title}</span>
        {lead ? <span className="text-fg-muted"> {lead}</span> : null}
      </h2>
    </div>
  );
}
