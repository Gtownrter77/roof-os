import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force the engine to drop Turbopack and use standard Webpack configurations
  webpack: (config) => {
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
