import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
