import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
