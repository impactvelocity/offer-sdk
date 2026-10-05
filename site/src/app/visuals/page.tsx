import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Diagram, Edge, Face, Guide, Marker, type MarkerShape, type MarkerTone } from "@/components/diagrams/kit";
import { DiagramReveal } from "@/components/diagrams/reveal";
import { primitives, toneStyle } from "@/components/platform-primitives";

export const metadata: Metadata = {
  title: "Visual language",
  robots: { index: false },
};

const tones: { tone: MarkerTone; shape: MarkerShape; use: string }[] = [
  { tone: "violet", shape: "square", use: "Plans" },
  { tone: "teal", shape: "diamond", use: "Entitlements" },
  { tone: "orange", shape: "hex", use: "Add-ons" },
  { tone: "pink", shape: "circle", use: "Incentives" },
  { tone: "blue", shape: "square", use: "Offers" },
];

/** Prototyping page for the line-diagram style: the kit's parts, then every diagram at full size. */
export default function VisualsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-accent-fg">Prototype</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Visual language</h1>
      <p className="mt-4 max-w-2xl text-fg-muted">
        Abstract isometric line diagrams, one per primitive. Build them from the kit in{" "}
        <code className="text-sm text-fg-secondary">src/components/diagrams/kit.tsx</code>: solid edges for what you
        see, dotted guides for hidden edges and construction, faces to hide what&apos;s behind, and one marker shape and
        tone per diagram. They draw on when scrolled into view; hover one to see its motion.
      </p>

      <section className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Swatch name="Edge" note="Solid hairline · visible outlines">
          <Edge d="M20 30 L140 30" />
        </Swatch>
        <Swatch name="Guide" note="Dotted · hidden edges, construction">
          <Guide d="M20 30 L140 30" />
        </Swatch>
        <Swatch name="Face" note="Page-colored fill · hides what's behind">
          <Guide d="M20 30 L140 30" />
          <Face d="M60 12 L100 12 L100 48 L60 48 Z" />
        </Swatch>
        <Swatch name="Marker" note="Filled = on · hollow = off">
          <Marker at={[64, 30]} shape="diamond" tone="teal" />
          <Marker at={[96, 30]} shape="diamond" tone="teal" hollow />
        </Swatch>
      </section>

      <section className="mt-px grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
        {tones.map((t) => (
          <Swatch key={t.tone} name={t.use} note={`--marker-${t.tone} · ${t.shape}`}>
            <Edge d="M20 30 L140 30" />
            <Marker at={[50, 30]} shape={t.shape} tone={t.tone} />
            <Marker at={[80, 30]} shape={t.shape} tone={t.tone} />
            <Marker at={[110, 30]} shape={t.shape} tone={t.tone} hollow />
          </Swatch>
        ))}
      </section>

      <section className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
        {primitives.map(({ title, body, tone, Diagram: Illustration }, i) => (
          <figure
            key={title}
            style={toneStyle(tone)}
            className={`diagram-cell group bg-canvas p-8 ${i === primitives.length - 1 ? "md:col-span-2" : ""}`}
          >
            <DiagramReveal className="mx-auto max-w-[420px]">
              <Illustration />
            </DiagramReveal>
            <figcaption className="mt-6">
              <span className="font-medium text-fg">{title}</span>
              <span className="mt-1 block text-sm text-fg-muted">{body}</span>
            </figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}

function Swatch({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <div className="group bg-canvas p-5">
      <Diagram label={name} viewBox="0 0 160 60" className="h-[60px] w-[160px]">
        {children}
      </Diagram>
      <p className="mt-3 text-sm font-medium text-fg">{name}</p>
      <p className="text-xs text-fg-muted">{note}</p>
    </div>
  );
}
