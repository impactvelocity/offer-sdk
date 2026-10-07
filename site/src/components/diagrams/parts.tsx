import { Box, boxParts, Diagram, Edge, Guide, iso, Marker, Move, onRing, path, rect, ring, Tint } from "./kit";

/*
 * Line diagrams for the three parts you deploy (API, admin app, React SDK), drawn with the same
 * kit as the use cases. Each one has a signature hover motion; colors come from the card's `--tone`.
 */

/** API: a stack of engine layers on a ring, routing entitlements and offers out. Hover: the layers spread. */
export function ApiDiagram() {
  const S = 78;
  const p = iso(S, [160, 182]);
  const R = 1.3;
  const T = 0.18;
  const LIFT = 7; // px per layer on hover
  const layers = [0, 0.3, 0.6];
  const top = layers.at(-1)! + T;
  return (
    <Diagram label="Three engine layers stacked on a ring, with routes out to an entitlement and an offer" viewBox="0 20 320 260">
      <Tint d={path(ring(p, R), true)} strength={0.07} />
      <Guide d={path(ring(p, R), true)} />
      <Edge d={path([p([0.6, 0, 0]), p([R, 0, 0])])} />
      <Edge d={path([p([0, 0.6, 0]), p([0, R, 0])])} />
      {layers.map((z, i) => {
        const next = layers[i + 1];
        return (
          <Move key={z} by={-LIFT * i} delay={i * 0.1}>
            <Box p={p} size={[0.6, 0.6]} z={[z, z + T]} />
            {/* Guides to the next layer run on into it by one lift, hidden by its faces until it rises. */}
            {next !== undefined &&
              rect([0, 0], [0.6, 0.6], z + T).map((c) => (
                <Guide key={c.join()} d={path([p(c), p([c[0], c[1], next + LIFT / S])])} />
              ))}
          </Move>
        );
      })}
      <Move by={-LIFT * (layers.length - 1)}>
        <Guide d={path([p([0, 0, top]), p([0, 0, top + 0.5])])} />
        <Marker at={p([0, 0, top + 0.5])} shape="circle" tone="green" />
      </Move>
      <Marker at={p(onRing(R, 0))} shape="square" tone="green" />
      <Marker at={p(onRing(R, 90))} shape="diamond" tone="green" hollow unlock />
    </Diagram>
  );
}

/** Admin app: a panel with usage columns on it. Hover: the columns rise by different amounts, like live data. */
export function AdminDiagram() {
  const S = 86;
  const p = iso(S, [160, 192]);
  const base = 0.12;
  const cols = [
    { x: -0.72, h: 0.35, lift: 5 },
    { x: -0.36, h: 0.6, lift: 12 },
    { x: 0, h: 0.45, lift: 7 },
    { x: 0.36, h: 0.8, lift: 14 },
    { x: 0.72, h: 1.0, lift: 18 },
  ];
  return (
    <Diagram label="A flat panel with five usage columns of different heights" viewBox="0 20 320 260">
      <Box p={p} size={[1.05, 0.62]} z={[0, base]} />
      <Tint d={path(rect([0, 0], [1.05, 0.62], base).map(p), true)} strength={0.08} />
      <Guide d={path(rect([0, 0], [0.92, 0.5], base).map(p), true)} />
      {cols.map((c, i) => {
        const last = i === cols.length - 1;
        return (
          <g key={c.x}>
            {/* Hidden behind the column until it rises. */}
            <Guide d={path([p([c.x + 0.12, 0.12, base]), p([c.x + 0.12, 0.12, base + c.lift / S])])} />
            <Move by={-c.lift} delay={i * 0.06}>
              <Box p={p} at={[c.x, 0]} size={[0.12, 0.12]} z={[base, base + c.h]} />
              <Marker
                at={p([c.x + 0.12, 0.12, base + c.h])}
                shape="hex"
                tone="violet"
                hollow={!last}
                unlock={!last}
              />
            </Move>
          </g>
        );
      })}
    </Diagram>
  );
}

/** React SDK: app components inside a provider, with a lid above. Hover: the lid drops on and the components light up. */
export function SdkDiagram() {
  const S = 80;
  const p = iso(S, [160, 188]);
  const base = 0.12;
  const wall = 0.82;
  const shell = boxParts(p, [0, 0], [0.66, 0.66], [base, wall]);
  const parts = [
    { at: [-0.32, -0.32] as const, h: 0.5 },
    { at: [0.3, -0.24] as const, h: 0.34 },
    { at: [-0.24, 0.3] as const, h: 0.42 },
    { at: [0.28, 0.28] as const, h: 0.24 },
  ];
  const lid = 0.4; // gap above the walls, closed on hover
  return (
    <Diagram label="Four app components on a base, inside a glass provider with a lid hovering above" viewBox="0 20 320 260">
      <Box p={p} size={[0.82, 0.82]} z={[0, base]} />
      {shell.hidden.map((d) => (
        <Guide key={d} d={d} />
      ))}
      {parts.map((c) => (
        <g key={c.at.join()}>
          <Box p={p} at={c.at} size={[0.12, 0.12]} z={[base, base + c.h]} />
          <Marker at={p([c.at[0] + 0.12, c.at[1] + 0.12, base + c.h])} shape="square" tone="blue" hollow unlock />
        </g>
      ))}
      {shell.faces.map((f) => (
        <Tint key={f.d} d={f.d} strength={f.side === "top" ? 0.1 : 0.05} />
      ))}
      {shell.visible.map((d) => (
        <Edge key={d} d={d} />
      ))}
      <Move by={lid * S}>
        <Box p={p} size={[0.66, 0.66]} z={[wall + lid, wall + lid + 0.08]} variant="ghost" />
        <Marker at={p([0.66, 0.66, wall + lid + 0.08])} shape="square" tone="blue" />
      </Move>
    </Diagram>
  );
}
