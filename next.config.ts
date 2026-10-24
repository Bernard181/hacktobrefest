import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 e binario nativo: nao pode ser bundlado pelo webpack/turbopack.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
