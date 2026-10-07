import type { CSSProperties, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Diagram kit: the visual language for the abstract line illustrations (after modal.com's
 * Platform section). Isometric scenes drawn with three kinds of stroke and one marker family:
 *
 *   Edge   solid hairline, the visible outline of a shape
 *   Guide  dotted hairline, hidden edges and construction lines (marches on hover)
 *   Face   a solid surface: filled with the page color so it hides what's behind it
 *   Marker small colored vertex; one shape + tone per diagram, hollow for "off" states
 *   Tint   a flat wash of the diagram's tone that fades in on hover
 *   Move   a group that slides on hover (each diagram's signature motion)
 *
 * Inside a <DiagramReveal>, edges draw on, guides fade in and markers pop in when scrolled
 * into view. Hovering a `.group` with a `--tone` (see `.diagram-cell`) shades faces and edges in
 * that tone, fades in tints, pings the markers, marches the guides and slides <Move> groups.
 * Every diagram is a 320×300 viewBox; colors come from the `--diagram-*` / `--marker-*` tokens.
 */

export type Pt = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Project = (v: Vec3) => Pt;

const COS30 = Math.cos(Math.PI / 6);

/** Isometric projection: +x runs down-right, +y down-left, +z up. `scale` is px per unit. */
export function iso(scale: number, origin: Pt = [160, 150]): Project {
  return ([x, y, z]) => [origin[0] + (x - y) * COS30 * scale, origin[1] + (x + y) * 0.5 * scale - z * scale];
}

/** SVG path data through the points. */
export function path(points: readonly Pt[], close = false) {
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return close ? `${d} Z` : d;
}

/** Corners of a horizontal rectangle at height z, in order: back, right, front, left. */
export function rect([cx, cy]: Pt, [hx, hy]: Pt, z: number): Vec3[] {
  return [
    [cx - hx, cy - hy, z],
    [cx + hx, cy - hy, z],
    [cx + hx, cy + hy, z],
    [cx - hx, cy + hy, z],
  ];
}

/** A horizontal circle of radius r at height z, projected (an ellipse on screen). */
export function ring(p: Project, r: number, z = 0, [cx, cy]: Pt = [0, 0], steps = 96): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return p([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  });
}

/** Point on a horizontal circle at angle `deg` (0° = +x). */
export function onRing(r: number, deg: number, z = 0): Vec3 {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a), z];
}

/** Paths for an axis-aligned box: the three faces the viewer sees, plus edges split by visibility. */
export function boxParts(p: Project, at: Pt, size: Pt, [z0, z1]: Pt) {
  const [b0, r0, f0, l0] = rect(at, size, z0).map(p);
  const [b1, r1, f1, l1] = rect(at, size, z1).map(p);
  return {
    faces: [
      { side: "right", d: path([r1, f1, f0, r0], true) },
      { side: "left", d: path([f1, l1, l0, f0], true) },
      { side: "top", d: path([b1, r1, f1, l1], true) },
    ] as const,
    hidden: [path([l0, b0, r0]), path([b0, b1])],
    visible: [path([b1, r1, f1, l1], true), path([r1, r0, f0, l0, l1]), path([f1, f0])],
  };
}

export function Diagram({
  label,
  children,
  className,
  viewBox = "0 0 320 300",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  viewBox?: string;
}) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={label} fill="none" className={cn("diagram block w-full", className)}>
      {children}
    </svg>
  );
}

// pathLength=1 lets the reveal draw every line on with the same dash values.
export function Edge({ d, className }: { d: string; className?: string }) {
  return <path d={d} pathLength={1} className={cn("diagram-edge", className)} />;
}

export function Guide({ d }: { d: string }) {
  return <path d={d} className="diagram-guide" />;
}

/** A solid surface. `side` picks its hover shade: tops catch the most color, sides less. */
export function Face({ d, side = "top" }: { d: string; side?: "top" | "left" | "right" }) {
  return <path d={d} pathLength={1} data-side={side} className="diagram-face" />;
}

/** A flat wash of the diagram's tone that fades in on hover (`strength` is its fill opacity). */
export function Tint({ d, strength = 0.12 }: { d: string; strength?: number }) {
  return <path d={d} className="diagram-tint" style={{ "--tint": strength } as CSSProperties} />;
}

/**
 * Slides its children vertically by `by` px (screen space) while the diagram's `.group` is hovered.
 * `delay` (s) also staggers the hover fill of the faces inside it.
 */
export function Move({ by = 0, delay = 0, children }: { by?: number; delay?: number; children: ReactNode }) {
  return (
    <g className="diagram-move" style={{ "--move": `${by}px`, "--d": `${delay}s` } as CSSProperties}>
      {children}
    </g>
  );
}

/**
 * A box. `solid` hides what's behind it (pass `hidden` to also dot its back edges),
 * `ghost` is all dotted (a shape that was, or will be).
 */
export function Box({
  p,
  at = [0, 0],
  size,
  z,
  variant = "solid",
  hidden = false,
}: {
  p: Project;
  at?: Pt;
  size: Pt;
  z: Pt;
  variant?: "solid" | "ghost";
  hidden?: boolean;
}) {
  const parts = boxParts(p, at, size, z);
  if (variant === "ghost") {
    return (
      <g>
        {[...parts.hidden, ...parts.visible].map((d) => (
          <Guide key={d} d={d} />
        ))}
      </g>
    );
  }
  return (
    <g>
      {hidden && parts.hidden.map((d) => <Guide key={d} d={d} />)}
      {parts.faces.map((f) => (
        <Face key={f.d} d={f.d} side={f.side} />
      ))}
    </g>
  );
}

export type MarkerShape = "square" | "diamond" | "hex" | "circle";
export type MarkerTone = "green" | "violet" | "orange" | "pink" | "blue";

/** Colored vertex. A page-colored halo cuts the lines it sits on; `hollow` marks an "off" state. */
export function Marker({
  at: [x, y],
  shape = "square",
  tone = "green",
  hollow = false,
  unlock = false,
}: {
  at: Pt;
  shape?: MarkerShape;
  tone?: MarkerTone;
  hollow?: boolean;
  /** Hollow marker that fills in while the diagram is hovered. */
  unlock?: boolean;
}) {
  const color = `var(--marker-${tone})`;
  const props = hollow
    ? { fill: "var(--diagram-bg)", stroke: color, strokeWidth: 1.25 }
    : { fill: color, stroke: "var(--diagram-bg)", strokeWidth: 3, paintOrder: "stroke" as const };
  const className = cn("diagram-marker", unlock && "diagram-unlock");
  // Lit markers send out a ping on hover, staggered by position so they don't pulse in unison.
  const ping = !hollow || unlock;
  return (
    <g style={{ "--tone": color } as CSSProperties}>
      {ping && (
        <circle
          cx={x}
          cy={y}
          r={5}
          className="diagram-ping"
          style={{ animationDelay: `${(Math.round(x + y) % 5) * 0.28}s` }}
        />
      )}
      <MarkerShape x={x} y={y} shape={shape} className={className} {...props} />
    </g>
  );
}

function MarkerShape({
  x,
  y,
  shape,
  ...props
}: { x: number; y: number; shape: MarkerShape } & Omit<SVGProps<SVGElement>, "ref">) {
  switch (shape) {
    case "square":
      return <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} {...props} />;
    case "diamond":
      return <path d={path([[x, y - 5.5], [x + 5.5, y], [x, y + 5.5], [x - 5.5, y]], true)} {...props} />;
    case "hex": {
      const pts = Array.from({ length: 6 }, (_, i): Pt => {
        const a = ((60 * i - 90) * Math.PI) / 180;
        return [x + 5 * Math.cos(a), y + 5 * Math.sin(a)];
      });
      return <path d={path(pts, true)} {...props} />;
    }
    case "circle":
      return <circle cx={x} cy={y} r={4.5} {...props} />;
  }
}
