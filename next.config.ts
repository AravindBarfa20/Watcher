import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ["lucide-react", "@react-three/drei"] },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
