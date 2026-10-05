"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BrandGradientDefs, svgId } from "./brand-gradient";

const W = 100;
const H = 32;
const PAD = 2;

/** Smooth path through the points (cardinal spline rendered as cubic béziers). */
function smooth(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1] ?? points[i];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[i + 2] ?? points[i + 1];
    const t = 0.18;
    d += ` C${x1 + (x2 - x0) * t},${y1 + (y2 - y0) * t} ${x2 - (x3 - x1) * t},${y2 - (y3 - y1) * t} ${x2},${y2}`;
  }
  return d;
}

/** Tiny trend line in the brand gradient, for stat tiles. Decorative: the tile states the number. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = svgId(useId());
  const { line, area } = useMemo(() => {
    if (values.length < 2) return { line: "", area: "" };
    const max = Math.max(...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * W,
      PAD + (1 - (v - min) / span) * (H - PAD * 2),
    ]) as [number, number][];
    const line = smooth(pts);
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  }, [values]);

  if (!line) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-8 w-24 overflow-visible", className)} aria-hidden>
      <BrandGradientDefs id={id} />
      <path d={area} fill={`url(#${id}-wash)`} mask={`url(#${id}-mask)`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
