import path from "path";
import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: [
    "3000-firebase-coreframe-1761721056153.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev",
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
    return [
      {
        source: "/",
        destination: publicSiteUrl,
        permanent: true,
      },
      {
        source: "/en",
        destination: `${publicSiteUrl}/en`,
        permanent: true,
      },
      {
        source: "/features",
        destination: `${publicSiteUrl}/features`,
        permanent: true,
      },
      {
        source: "/en/features",
        destination: `${publicSiteUrl}/en/features`,
        permanent: true,
      },
      {
        source: "/funkcjonalonosci",
        destination: `${publicSiteUrl}/funkcjonalonosci`,
        permanent: true,
      },
      {
        source: "/pricing",
        destination: `${publicSiteUrl}/pricing`,
        permanent: true,
      },
      {
        source: "/en/pricing",
        destination: `${publicSiteUrl}/en/pricing`,
        permanent: true,
      },
      {
        source: "/cennik",
        destination: `${publicSiteUrl}/cennik`,
        permanent: true,
      },
      {
        source: "/tools/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/tools/svwms-wdd-matcher`,
        permanent: true,
      },
      {
        source: "/en/tools/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/en/tools/svwms-wdd-matcher`,
        permanent: true,
      },
      {
        source: "/narzedzia/svwms-wdd-matcher",
        destination: `${publicSiteUrl}/narzedzia/svwms-wdd-matcher`,
        permanent: true,
      },
      {
        source: "/maps/:path*",
        destination: `${publicSiteUrl}/maps/:path*`,
        permanent: true,
      },
      {
        source: "/en/maps/:path*",
        destination: `${publicSiteUrl}/en/maps/:path*`,
        permanent: true,
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
      allowedOrigins: ["localhost:3000"],
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
