import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "zlcnlalwfmmtusigeuyk.supabase.co" },
      { protocol: "https", hostname: "rjeraydumwechpjjzrus.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" }
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3001"],
      bodySizeLimit: "10mb"
    },
    optimizePackageImports: ["lucide-react"]
  }
} satisfies NextConfig;

export default nextConfig;
