import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const repoRoot = path.resolve(__dirname, "../..");

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: [
    "localhost:3002",
    "127.0.0.1:3002",
    "192.168.1.45",
    "192.168.1.45:3002",
    "*.cloudworkstations.dev",
    "*.idx.dev"
  ],
  turbopack: {
    root: repoRoot
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "zlcnlalwfmmtusigeuyk.supabase.co" },
      { protocol: "https", hostname: "rjeraydumwechpjjzrus.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" }
    ]
  },
  serverExternalPackages: ["pdfjs-dist", "pdfjs-dist/legacy/build/pdf.mjs"],
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3002",
        "127.0.0.1:3002",
        "192.168.1.45",
        "192.168.1.45:3002",
        "ambra-system.com",
        "www.ambra-system.com",
        "*.cloudworkstations.dev",
        "*.idx.dev"
      ],
      bodySizeLimit: "10mb"
    },
    optimizePackageImports: ["lucide-react"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /node_modules\/@supabase\/realtime-js/ },
        { module: /node_modules\/@supabase\/supabase-js/ },
        { module: /pdfjs-dist/ }
      ];
      config.externals = [...(config.externals ?? []), { canvas: "canvas" }];
    }
    return config;
  }
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
