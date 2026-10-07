import { Box, boxParts, Diagram, Edge, Guide, iso, Marker, Move, onRing, path, rect, ring, Tint } from "./kit";

/** Plans: tiers stacked into a stepped pyramid. Hover: the tiers lift apart and fill bottom to top. */
export function PlansDiagram() {
  const S = 80;
  const p = iso(S, [160, 174]);
  const T = 0.16;
  const LIFT = 8; // px per tier on hover
  const tiers = [
    { h: 1, z: 0 },
    { h: 0.72, z: 0.5 },
    { h: 0.44, z: 1 },
  ];
  return (
    <Diagram label="Three plan tiers stacked into a stepped pyramid">
      {tiers.map((t, i) => {
        const next = tiers[i + 1];
        return (
          <Move key={t.h} by={-LIFT * i} delay={i * 0.12}>
            <Box p={p} size={[t.h, t.h]} z={[t.z, t.z + T]} />
            {/* Guides to the next tier run on into it by one lift, hidden by its faces until it rises. */}
            {next &&
              rect([0, 0], [next.h, next.h], t.z + T).map((c) => (
                <Guide key={c.join()} d={path([p(c), p([c[0], c[1], next.z + LIFT / S])])} />
              ))}
            <Marker at={p([t.h, t.h, t.z + T])} shape="square" tone="green" />
          </Move>
        );
      })}
    </Diagram>
  );
}

/** Entitlements: one plan resolves into a ring of features. Hover: the ring lights up and the locked ones unlock. */
export function EntitlementsDiagram() {
  const p = iso(92, [160, 164]);
  const R = 1.2;
  const granted = [true, true, false, true, true, false, true, false];
  const nodes = granted.map((on, i) => ({ on, at: onRing(R, i * 45 + 22.5) }));
  return (
    <Diagram label="A plan connected to a ring of features, some granted and some not">
      <Tint d={path(ring(p, R), true)} strength={0.06} />
      <Tint d={path(ring(p, R * 0.52), true)} strength={0.14} />
      <Edge d={path(ring(p, R), true)} />
      <Guide d={path(ring(p, R * 0.52), true)} />
      {nodes.map((n) => {
        const d = path([p([0, 0, 0]), p(n.at)]);
        return n.on ? (
          <Edge key={d} d={d} />
        ) : (
          <g key={d}>
            <Guide d={d} />
            <Edge d={d} className="diagram-unlock-line" />
          </g>
        );
      })}
      <Box p={p} size={[0.26, 0.26]} z={[0, 0.52]} />
      <Guide d={path([p([0, 0, 0.52]), p([0, 0, 1.15])])} />
      <Marker at={p([0, 0, 1.15])} shape="diamond" tone="violet" />
      {nodes.map((n) => (
        <Marker key={n.at.join()} at={p(n.at)} shape="diamond" tone="violet" hollow={!n.on} unlock={!n.on} />
      ))}
    </Diagram>
  );
}

/** Add-ons: a module above a socket on the base plan. Hover: the socket lights up and the module drops in. */
export function AddonsDiagram() {
  const S = 85;
  const p = iso(S, [160, 171]);
  const at = [0.35, -0.3] as const;
  const size = [0.32, 0.32] as const;
  const top = 0.28;
  const hover = 0.75;
  const socket = rect(at, size, top);
  return (
    <Diagram label="A small module above a socket on top of a base slab">
      <Box p={p} size={[0.95, 0.95]} z={[0, top]} />
      <Tint d={path(socket.map(p), true)} strength={0.4} />
      <Guide d={path(socket.map(p), true)} />
      {socket.map((c) => (
        <Guide key={c.join()} d={path([p(c), p([c[0], c[1], hover])])} />
      ))}
      <Move by={(hover - top) * S}>
        <Box p={p} at={at} size={size} z={[hover, hover + 0.4]} />
      </Move>
      {socket.map((c) => (
        <Marker key={c.join()} at={p(c)} shape="hex" tone="orange" />
      ))}
    </Diagram>
  );
}

/** Incentives: a dotted ghost of the old price above the new, lower one. Hover: the savings light up and the old price drops. */
export function IncentivesDiagram() {
  const S = 80;
  const p = iso(S, [160, 179]);
  const size = [0.42, 0.42] as const;
  const was = 1.3;
  const now = 0.7;
  return (
    <Diagram label="A tall dotted outline above a shorter solid block, showing a price drop">
      <Tint d={path(rect([0, 0], [1, 1], 0).map(p), true)} strength={0.08} />
      <Edge d={path(rect([0, 0], [1, 1], 0).map(p), true)} />
      {/* The slice of price that was taken off. */}
      {boxParts(p, [0, 0], size, [now, was]).faces.map((f) => (
        <Tint key={f.d} d={f.d} strength={f.side === "top" ? 0.16 : 0.08} />
      ))}
      <Box p={p} size={size} z={[0, was]} variant="ghost" />
      <Box p={p} size={size} z={[0, now]} />
      {/* Skip the corners that would land on top of each other in the middle. The old-price
          markers come first so the new-price ones stay on top when they drop. */}
      <Move by={(was - now) * S}>
        {rect([0, 0], size, was)
          .filter((_, i) => i !== 2)
          .map((c) => (
            <Marker key={c.join()} at={p(c)} shape="circle" tone="pink" hollow />
          ))}
      </Move>
      {rect([0, 0], size, now)
        .filter((_, i) => i !== 0)
        .map((c) => (
          <Marker key={c.join()} at={p(c)} shape="circle" tone="pink" />
        ))}
    </Diagram>
  );
}

/** Offers: a plan and an add-on packed together into one glass box. Hover: the glass tints and the add-on lifts. */
export function OffersDiagram() {
  const p = iso(72, [160, 177]);
  const pkg = boxParts(p, [0, 0], [0.75, 0.75], [0, 1.5]);
  return (
    <Diagram label="A plan and an add-on packed inside a glass box">
      {pkg.hidden.map((d) => (
        <Guide key={d} d={d} />
      ))}
      <Box p={p} at={[0.1, 0.1]} size={[0.5, 0.5]} z={[0, 0.3]} />
      <Move by={-18}>
        <Box p={p} at={[-0.08, -0.08]} size={[0.22, 0.22]} z={[0.3, 0.74]} />
      </Move>
      {pkg.faces.map((f) => (
        <Tint key={f.d} d={f.d} strength={f.side === "top" ? 0.1 : 0.06} />
      ))}
      {pkg.visible.map((d) => (
        <Edge key={d} d={d} />
      ))}
      {/* The front corner would sit on the add-on, so only the outer three are marked. */}
      {rect([0, 0], [0.75, 0.75], 1.5)
        .filter((_, i) => i !== 2)
        .map((c) => (
          <Marker key={c.join()} at={p(c)} shape="square" tone="blue" />
        ))}
    </Diagram>
  );
}
