import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import { readFileSync } from "node:fs";

// The Ambra system version (packages/app-version, docs/versioning.md) and the commit of this
// build, shown in the app and sent with reports. Both are fixed when the app is built.
const appVersion = (
  JSON.parse(
    readFileSync(path.join(__dirname, "../../packages/app-version/package.json"), "utf8")
  ) as { version: string }
).version;

const repoRoot = path.resolve(__dirname, "../..");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zapytania.ambra-system.com";

/** Ambra Zapytania -- doradcy -> dział części. Backend: the shared Ambra Supabase project. */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  reactStrictMode: true,
  transpilePackages: [
    "@repo/ui",
    "@repo/i18n",
    "@repo/contracts",
    "@repo/domain",
    "@repo/rich-text",
    "@repo/app-urls",
  ],
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
