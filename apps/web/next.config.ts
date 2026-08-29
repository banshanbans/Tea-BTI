import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@tea-bti/contracts"],
  devIndicators: false,
};

export default nextConfig;
