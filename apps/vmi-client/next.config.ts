import type { NextConfig } from "next";
import path from "node:path";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "zlcnlalwfmmtusigeuyk.supabase.co" },
      { protocol: "https", hostname: "rjeraydumwechpjjzrus.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    serverActions: {
      // Zezwól na Server Actions z domen IDX i Cloud Workstations
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "*.cloudworkstations.dev",
        "*.idx.dev"
      ],
      bodySizeLimit: "10mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
} satisfies NextConfig;

export default nextConfig;
