import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev badge off the shell's rail (account menu lives bottom-left).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
