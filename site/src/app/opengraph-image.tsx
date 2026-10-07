import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { iso, path, rect, type Pt } from "@/components/diagrams/kit";

export const alt = "Offer SDK: the agentic access and offer SDK for your app. Self-host it on Render in one click.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Site tokens (globals.css), written out because the image renders outside the page's CSS.
const CANVAS = "#0f0f11";
const NEON = "#34d599";
const FG = "#f4f4f5";
const MUTED = "#a1a1aa";
const BORDER = "#2a2a2e";

// lucide's Layers2, the logo mark in the header.
const LOGO_PATHS = [
  "M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z",
  "m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845",
];

/** The API diagram from the landing page (stacked engine layers on a ring), drawn flat for the image. */
function Stack() {
  const p = iso(120, [210, 250]);
  const T = 0.18;
  const half: Pt = [0.6, 0.6];
  const layers = [0, 0.36, 0.72];
  const ring = Array.from({ length: 96 }, (_, i): Pt => {
    const a = (i / 96) * Math.PI * 2;
    return p([1.3 * Math.cos(a), 1.3 * Math.sin(a), 0]);
  });
  return (
    <svg width="420" height="440" viewBox="0 0 420 440" fill="none">
      <path d={path(ring, true)} fill="rgba(52,213,153,0.06)" stroke={NEON} strokeOpacity={0.45} strokeDasharray="2 6" />
      <path d={path([p([0.6, 0, 0]), p([1.3, 0, 0])])} stroke={NEON} strokeOpacity={0.7} strokeWidth={1.5} />
      <path d={path([p([0, 0.6, 0]), p([0, 1.3, 0])])} stroke={NEON} strokeOpacity={0.7} strokeWidth={1.5} />
      {layers.map((z) => {
        const [, r0, f0, l0] = rect([0, 0], half, z).map(p);
        const [b1, r1, f1, l1] = rect([0, 0], half, z + T).map(p);
        return (
          <g key={z}>
            <path d={path([r1, f1, f0, r0], true)} fill={CANVAS} stroke={NEON} strokeWidth={1.5} />
            <path d={path([f1, l1, l0, f0], true)} fill={CANVAS} stroke={NEON} strokeWidth={1.5} />
            <path d={path([b1, r1, f1, l1], true)} fill="#13241d" stroke={NEON} strokeWidth={1.5} />
          </g>
        );
      })}
      {[p([0, 0, 0.9]), p([1.3, 0, 0]), p([0, 1.3, 0])].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} rx={2} fill={NEON} stroke={CANVAS} strokeWidth={4} />
      ))}
      <path d={path([p([0, 0, 0.9]), p([0, 0, 1.45])])} stroke={NEON} strokeOpacity={0.6} strokeDasharray="2 5" />
      <circle cx={p([0, 0, 1.45])[0]} cy={p([0, 0, 1.45])[1]} r={7} fill={NEON} stroke={CANVAS} strokeWidth={4} />
    </svg>
  );
}

export default async function OpengraphImage() {
  // Static cuts of the Cal Sans variable font (Satori can't read variable fonts).
  const fonts = join(process.cwd(), "src/assets/fonts");
  const [display, text] = await Promise.all([
    readFile(join(fonts, "CalSans-Display-Medium.ttf")),
    readFile(join(fonts, "CalSans-Text-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: CANVAS,
          fontFamily: "Cal Sans",
          color: FG,
          padding: "64px 72px",
        }}
      >
        {/* Neon glow behind the diagram (an SVG gradient: Satori's CSS radial gradients don't fade cleanly). */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <radialGradient id="glow" cx="940" cy="300" r="380" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={NEON} stopOpacity={0.22} />
              <stop offset="1" stopColor={NEON} stopOpacity={0} />
            </radialGradient>
          </defs>
          <rect width="1200" height="630" fill="url(#glow)" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={NEON} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {LOGO_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            <div style={{ fontFamily: "Cal Sans Display", fontSize: 38, letterSpacing: -0.5 }}>Offer SDK</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Cal Sans Display",
                fontSize: 70,
                lineHeight: 1.05,
                letterSpacing: 0.5,
              }}
            >
              <span>The Agentic Access &amp;</span>
              <span>Offer SDK for your app</span>
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.35, color: MUTED }}>
              Own the code that decides who gets what. One click puts it on your Render account.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: MUTED }}>
            {["API", "Admin App", "React SDK"].map((part) => (
              <div
                key={part}
                style={{ display: "flex", padding: "8px 16px", borderRadius: 999, border: `1.5px solid ${BORDER}` }}
              >
                {part}
              </div>
            ))}
            <div style={{ display: "flex", marginLeft: 12, color: NEON }}>offersdk.com</div>
          </div>
        </div>

        <div style={{ display: "flex", position: "absolute", right: 48, top: 96 }}>
          <Stack />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cal Sans Display", data: display, weight: 500, style: "normal" },
        { name: "Cal Sans", data: text, weight: 400, style: "normal" },
      ],
    },
  );
}
