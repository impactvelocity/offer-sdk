import type { NextConfig } from "next";

// Analytics run only where DEMO_ENABLED is on (our hosted demo, and `next dev` by default, matching
// src/server/env.ts), so self-hosted installs never report to our PostHog. Inlined at build time.
const demoEnabled = (process.env.DEMO_ENABLED?.trim() || (process.env.NODE_ENV === "development" ? "true" : "false")) === "true";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_POSTHOG_ENABLED: String(demoEnabled) },
  // Keep the dev badge off the shell's rail (account menu lives bottom-left).
  devIndicators: { position: "bottom-right" },
  // The MCP consent page must never load in a frame (clickjacking an "Allow access" click).
  async headers() {
    return [
      {
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
