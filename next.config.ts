import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@napi-rs/canvas", "pdfjs-dist"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
