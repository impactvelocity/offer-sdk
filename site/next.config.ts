import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Renamed pages: "Story" is now "Why Offer SDK", "Demo" is now "How it works".
    return [
      { source: "/story", destination: "/why", permanent: true },
      { source: "/demo", destination: "/how-it-works", permanent: true },
      // Claude moved out of the sponsors docs.
      { source: "/docs/sponsors/claude", destination: "/docs/ai", permanent: true },
    ];
  },
};

export default nextConfig;
