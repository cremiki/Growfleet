import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produce un server Node autonomo: utile per il deploy su VPS (Docker / systemd)
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
