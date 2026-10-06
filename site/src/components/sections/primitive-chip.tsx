import type { MarkerTone } from "@/components/diagrams/kit";

export type Primitive = "Plans" | "Entitlements" | "Add-ons" | "Incentives" | "Offers";

// Same tone per primitive as the Platform diagrams.
const tones: Record<Primitive, MarkerTone> = {
  Plans: "violet",
  Entitlements: "teal",
  "Add-ons": "orange",
  Incentives: "pink",
  Offers: "blue",
};

/** Small chip naming a primitive, with its diagram color as a dot. */
export function PrimitiveChip({ name }: { name: Primitive }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-xs text-fg-secondary">
      <span className="size-1.5 rounded-full" style={{ background: `var(--marker-${tones[name]})` }} />
      {name}
    </span>
  );
}
