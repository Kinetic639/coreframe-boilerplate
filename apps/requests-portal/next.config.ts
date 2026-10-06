import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const repoRoot = path.resolve(__dirname, "../..");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zapytania.ambra-system.com";

/** Ambra Zapytania -- doradcy -> dział części. Backend: the shared Ambra Supabase project. */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui", "@repo/i18n", "@repo/contracts", "@repo/domain"],
  allowedDevOrigins: ["localhost:3004", "127.0.0.1:3004", "*.cloudworkstations.dev", "*.idx.dev"],
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingRoot: repoRoot,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "rjeraydumwechpjjzrus.supabase.co" }],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3004",
        "127.0.0.1:3004",
        new URL(siteUrl).hostname,
        "*.cloudworkstations.dev",
        "*.idx.dev",
      ],
      bodySizeLimit: "10mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
