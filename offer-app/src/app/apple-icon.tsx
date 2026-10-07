import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the layers mark on the neon square, as in icon.svg. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#34d599" }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="#0f0f11" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z" />
          <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845" />
        </svg>
      </div>
    ),
    size,
  );
}
