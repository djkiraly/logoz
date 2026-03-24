import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Enable standalone output for Docker deployments
  output: "standalone",

  // Fix workspace root detection when multiple lockfiles exist
  outputFileTracingRoot: path.join(__dirname, "./"),

  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
