import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SDK is imported straight from ../offer-app/src/sdk (see tsconfig paths).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
