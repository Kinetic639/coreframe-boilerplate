import path from "path";
import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { readFileSync } from "node:fs";

// The Ambra system version (packages/app-version, docs/versioning.md) and the commit of this
// build, shown in the app and sent with reports. Both are fixed when the app is built.
const appVersion = (
  JSON.parse(
    readFileSync(path.join(__dirname, "../../packages/app-version/package.json"), "utf8")
  ) as { version: string }
).version;

// The public website (apps/public-web), resolved like @repo/app-urls' getAppUrl("site").
const publicSiteUrl =
  process.env.NEXT_PUBLIC_AMBRA_SITE_URL ??
  (process.env.NODE_ENV === "production" ? "https://ambra-system.com" : "http://127.0.0.1:3002");
const isProduction = process.env.NODE_ENV === "production";
const permanentPublicRedirects = isProduction;

export const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  reactStrictMode: true,
  transpilePackages: [
    "@repo/ui",
    "@repo/i18n",
    "@repo/rich-text",
    "@repo/app-urls",
    "@repo/app-version",
  ],
  allowedDevOrigins: [
    "localhost:3001",
    "127.0.0.1:3001",
    "localhost:3000",
    "127.0.0.1:3000",
    "3000-firebase-coreframe-1761721056153.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev",
    // Cloud Workstations (Firebase Studio) preview hostname. Port-prefixed
    // subdomain, so it must match the port the dev server actually runs on
    // (3001, per apps/web's own "dev" script) -- a stale "3000-..." entry
    // here silently does nothing for a server running on 3001.
    "3001-firebase-coreframe-1761721056153.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "zlcnlalwfmmtusigeuyk.supabase.co" },
      { protocol: "https", hostname: "rjeraydumwechpjjzrus.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  async redirects() {
    const localAppEntryRedirects = isProduction
      ? []
      : [
          {
            source: "/",
            destination: "/logowanie",
            permanent: false,
          },
          {
            source: "/en",
            destination: "/en/sign-in",
            permanent: false,
          },
        ];

    return [
      ...localAppEntryRedirects,
      // Auth-aware dashboard/sign-in routing still lives in src/utils/supabase/proxy.ts.
      // In local dev, the bare app root gets an explicit login redirect above so
      // the extracted public website can never steal the app entry point.
      {
        source: "/features",
        destination: `${publicSiteUrl}/features`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/en/features",
        destination: `${publicSiteUrl}/en/features`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/funkcjonalonosci",
        destination: `${publicSiteUrl}/funkcjonalonosci`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/pricing",
        destination: `${publicSiteUrl}/pricing`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/en/pricing",
        destination: `${publicSiteUrl}/en/pricing`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/cennik",
        destination: `${publicSiteUrl}/cennik`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/tools/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/tools/svwms-wdd-matcher`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/en/tools/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/en/tools/svwms-wdd-matcher`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/narzedzia/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/narzedzia/svwms-wdd-matcher`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/maps/:path*",
        destination: `${publicSiteUrl}/maps/:path*`,
        permanent: permanentPublicRedirects,
      },
      {
        source: "/en/maps/:path*",
        destination: `${publicSiteUrl}/en/maps/:path*`,
        permanent: permanentPublicRedirects,
      },
      // English: /en/dashboard/account -> /en/dashboard/account/preferences
      {
        source: "/en/dashboard/account",
        destination: "/en/dashboard/account/preferences",
        permanent: true,
      },
      // Polish (default locale, no prefix): /dashboard/konto -> /dashboard/konto/ustawienia
      {
        source: "/dashboard/konto",
        destination: "/dashboard/konto/ustawienia",
        permanent: true,
      },
    ];
  },
  // Externalize pdfjs-dist so Node.js loads it from node_modules (where
  // pdf.worker.mjs actually exists) rather than bundling it into SSR chunks.
  serverExternalPackages: ["pdfjs-dist", "pdfjs-dist/legacy/build/pdf.mjs"],
  // Set tracing root to the monorepo root so includes can reach pnpm's virtual store.
  // Globs in outputFileTracingIncludes are relative to the project root (apps/web),
  // so ../../ is needed to reach monorepo-level node_modules.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
  experimental: {
    serverActions: {
      // Next.js's Server Actions CSRF check compares the request's Origin
      // header against this list (see next/dist/server/app-render/action-
      // handler.js -- isCsrfOriginAllowed). Without the Cloud Workstations
      // hostname here, EVERY Server Action submitted through that preview
      // URL (sign-in included) is rejected with "Invalid Server Actions
      // request.", regardless of allowedDevOrigins above (that array only
      // governs asset/cross-origin dev warnings, not this check).
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "3000-firebase-coreframe-1761721056153.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev",
        "localhost:3001",
        "127.0.0.1:3001",
        "3001-firebase-coreframe-1761721056153.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev",
      ],
      bodySizeLimit: "50mb",
    },
    // Memory optimizations for Codespaces
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  typescript: {
    // Disable TypeScript type-checking during builds to avoid timeout - run separately with 'npm run type-check'
    ignoreBuildErrors: true,
  },
  // Suppress Supabase Edge Runtime warnings + prevent konva canvas SSR errors
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /node_modules\/@supabase\/realtime-js/ },
        { module: /node_modules\/@supabase\/supabase-js/ },
        { module: /pdfjs-dist/ },
      ];
      // Prevent react-konva / konva from trying to load the 'canvas' npm package
      // server-side. All Konva components use dynamic(..., { ssr: false }) so this is safe.
      config.externals = [...(config.externals ?? []), { canvas: "canvas" }];
    }
    return config;
  },
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
