import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd() + "/../..",
  poweredByHeader: false,
  serverExternalPackages: ["@evidencebridge/db", "@prisma/client"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
