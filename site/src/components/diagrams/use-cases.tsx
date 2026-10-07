import { Box, boxParts, Diagram, Edge, Guide, iso, Marker, Move, onRing, path, rect, ring, Tint } from "./kit";

/*
 * Line diagrams for the use cases, drawn with the same kit as the Platform primitives. Each one
 * has a signature hover motion; colors come from the card's `--tone`.
 */

/** Funnel: four rings narrowing as they go down, like a cone. Hover: the rings spread apart. */
export function FunnelDiagram() {
  const p = iso(78, [160, 215]);
  const rings = [
    { r: 0.24, z: 0 },
    { r: 0.48, z: 0.45 },
    { r: 0.74, z: 0.9 },
    { r: 1, z: 1.35 },
  ];
  // The ring's screen-left and screen-right extremes, joined ring to ring to draw the cone's sides.
  const sides = [135, -45];
  return (
    <Diagram label="Four rings narrowing from top to bottom, like a funnel" viewBox="0 20 320 260">
      {rings.map((g, i) => {
        const next = rings[i + 1];
        return (
          <Move key={g.r} by={-7 * i} delay={i * 0.1}>
            <Tint d={path(ring(p, g.r, g.z), true)} strength={0.05 + i * 0.03} />
            <Edge d={path(ring(p, g.r, g.z), true)} />
            {next && sides.map((a) => <Guide key={a} d={path([p(onRing(g.r, a, g.z)), p(onRing(next.r, a, next.z))])} />)}
            <Marker at={p(onRing(g.r, 45, g.z))} shape="square" tone="green" />
          </Move>
        );
      })}
    </Diagram>
  );
}

/** Upsells at the limit: usage columns rising toward a dotted limit, the next plan above. Hover: the last column hits the limit. */
export function UpsellDiagram() {
  const S = 68;
  const p = iso(S, [160, 200]);
  const base = 0.14;
  const limit = 1.2;
  const cols = [0.35, 0.55, 0.78, 0.98];
  return (
    <Diagram label="Usage columns rising toward a dotted limit line, with the next plan above" viewBox="0 20 320 260">
      <Box p={p} size={[1, 0.55]} z={[0, base]} />
      <Tint d={path(rect([0, 0], [1, 0.55], limit).map(p), true)} strength={0.1} />
      <Guide d={path(rect([0, 0], [1, 0.55], limit).map(p), true)} />
      {cols.map((h, i) => {
        const x = -0.66 + i * 0.44;
        const last = i === cols.length - 1;
        const column = (
          <>
            <Box p={p} at={[x, 0]} size={[0.13, 0.13]} z={[base, base + h]} />
            {last ? <Marker at={p([x + 0.13, 0.13, base + h])} shape="square" tone="green" /> : null}
          </>
        );
        return last ? (
          <Move key={x} by={-(limit - base - h) * S}>
            {column}
          </Move>
        ) : (
          <g key={x}>{column}</g>
        );
      })}
      <Move by={-10}>
        <Box p={p} size={[0.7, 0.4]} z={[limit + 0.3, limit + 0.42]} variant="ghost" />
      </Move>
    </Diagram>
  );
}

/** Churn saves: an account at the edge of its plan, with credits and seats above it. Hover: they drop in. */
export function ChurnDiagram() {
  const S = 80;
  const p = iso(S, [160, 178]);
  const top = 0.62;
  const drop = 0.42;
  const extras = [
    { at: [0.2, 0.4] as const, z: top + drop },
    { at: [0.42, 0.18] as const, z: top + drop + 0.22 },
  ];
  return (
    <Diagram label="An account block near the edge of a slab, with two small blocks about to drop onto it" viewBox="0 20 320 260">
      <Box p={p} size={[0.85, 0.85]} z={[0, 0.14]} />
      {/* The way out: a dotted path off the front edge. */}
      <Guide d={path([p([0.6, 0.3, 0.14]), p([0.85, 0.3, 0.14]), p([1.3, 0.3, -0.25])])} />
      <Box p={p} at={[0.3, 0.3]} size={[0.28, 0.28]} z={[0.14, top]} />
      <Marker at={p([0.58, 0.58, top])} shape="circle" tone="pink" />
      {extras.map((e, i) => (
        <Move key={e.at.join()} by={(e.z - top) * S} delay={i * 0.1}>
          <Box p={p} at={e.at} size={[0.09, 0.09]} z={[e.z, e.z + 0.18]} />
          <Marker at={p([e.at[0] + 0.09, e.at[1] + 0.09, e.z + 0.18])} shape="circle" tone="pink" hollow unlock />
        </Move>
      ))}
    </Diagram>
  );
}

/** Partner bundles: a partner linked by a route to their bundle. Hover: the add-on lifts and the route lights up. */
export function PartnerDiagram() {
  const p = iso(70, [170, 178]);
  const pkg = boxParts(p, [0.4, -0.15], [0.42, 0.42], [0, 0.95]);
  const route = [p([-0.75, 0.75, 0]), p([0.4, 0.75, 0]), p([0.4, 0.27, 0])];
  return (
    <Diagram label="A small partner block linked by a route to a glass box holding a plan and an add-on" viewBox="0 20 320 260">
      <Edge d={path(route)} />
      <Box p={p} at={[-0.9, 0.75]} size={[0.14, 0.14]} z={[0, 0.5]} />
      <Marker at={p([-0.76, 0.89, 0.5])} shape="square" tone="blue" />
      <Marker at={route[1]!} shape="square" tone="blue" hollow unlock />
      {pkg.hidden.map((d) => (
        <Guide key={d} d={d} />
      ))}
      <Box p={p} at={[0.45, -0.1]} size={[0.3, 0.3]} z={[0, 0.24]} />
      <Move by={-14}>
        <Box p={p} at={[0.3, -0.25]} size={[0.14, 0.14]} z={[0.24, 0.56]} />
      </Move>
      {pkg.faces.map((f) => (
        <Tint key={f.d} d={f.d} strength={f.side === "top" ? 0.1 : 0.06} />
      ))}
      {pkg.visible.map((d) => (
        <Edge key={d} d={d} />
      ))}
      <Marker at={p([0.82, -0.57, 0.95])} shape="square" tone="blue" />
    </Diagram>
  );
}

/** Time-limited promos: a price block on a clock dial. Hover: the dial lights up and the expired outline sinks. */
export function PromoDiagram() {
  const S = 78;
  const p = iso(S, [160, 165]);
  const R = 1.1;
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  const end = onRing(R * 0.82, -60);
  return (
    <Diagram label="A price block standing on a clock dial, with a dotted outline of the expired price above it" viewBox="0 20 320 260">
      <Tint d={path(ring(p, R), true)} strength={0.08} />
      <Edge d={path(ring(p, R), true)} />
      {ticks.map((a) => (
        <Guide key={a} d={path([p(onRing(R * 0.9, a)), p(onRing(R, a))])} />
      ))}
      <Edge d={path([p([0, 0, 0]), p(end)])} />
      <Marker at={p(end)} shape="hex" tone="orange" />
      <Move by={14}>
        <Box p={p} size={[0.22, 0.22]} z={[0.55, 0.95]} variant="ghost" />
      </Move>
      <Box p={p} size={[0.22, 0.22]} z={[0, 0.55]} />
      <Marker at={p([0.22, 0.22, 0.55])} shape="hex" tone="orange" />
    </Diagram>
  );
}

/** Pricing tests: package A and package B side by side, split by a dotted line. Hover: B pulls ahead. */
export function AbTestDiagram() {
  const S = 76;
  const p = iso(S, [160, 192]);
  const base = 0.12;
  return (
    <Diagram label="Two blocks side by side on a slab split by a dotted line, one taller than the other" viewBox="0 20 320 260">
      <Box p={p} size={[1, 0.55]} z={[0, base]} />
      <Guide d={path([p([0, -0.55, base]), p([0, 0.55, base])])} />
      <Box p={p} at={[-0.45, 0]} size={[0.24, 0.24]} z={[base, 0.75]} />
      <Marker at={p([-0.21, 0.24, 0.75])} shape="diamond" tone="violet" hollow />
      <Move by={-16}>
        <Box p={p} at={[0.45, 0]} size={[0.24, 0.24]} z={[base, 0.9]} />
        <Marker at={p([0.69, 0.24, 0.9])} shape="diamond" tone="violet" />
      </Move>
    </Diagram>
  );
}
