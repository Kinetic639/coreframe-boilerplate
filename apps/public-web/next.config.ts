import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const repoRoot = path.resolve(__dirname, "../..");
const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";
const erpAppUrl = process.env.NEXT_PUBLIC_ERP_APP_URL ?? "https://app.ambra-system.com";

const erpAuthRedirects = [
  { source: "/sign-in", destination: `${erpAppUrl}/sign-in` },
  { source: "/en/sign-in", destination: `${erpAppUrl}/en/sign-in` },
  { source: "/logowanie", destination: `${erpAppUrl}/logowanie` },
  { source: "/sign-up", destination: `${erpAppUrl}/sign-up` },
  { source: "/en/sign-up", destination: `${erpAppUrl}/en/sign-up` },
  { source: "/rejestracja", destination: `${erpAppUrl}/rejestracja` },
  { source: "/forgot-password", destination: `${erpAppUrl}/forgot-password` },
  { source: "/en/forgot-password", destination: `${erpAppUrl}/en/forgot-password` },
  { source: "/zapomnialem-hasla", destination: `${erpAppUrl}/zapomnialem-hasla` },
  { source: "/reset-password", destination: `${erpAppUrl}/reset-password` },
  { source: "/en/reset-password", destination: `${erpAppUrl}/en/reset-password` },
  { source: "/zresetuj-haslo", destination: `${erpAppUrl}/zresetuj-haslo` },
  { source: "/auth-code-error", destination: `${erpAppUrl}/auth-code-error` },
  { source: "/en/auth-code-error", destination: `${erpAppUrl}/en/auth-code-error` },
  { source: "/blad-uwierzytelniania", destination: `${erpAppUrl}/blad-uwierzytelniania` },
  { source: "/registration-disabled", destination: `${erpAppUrl}/registration-disabled` },
  { source: "/en/registration-disabled", destination: `${erpAppUrl}/en/registration-disabled` },
  { source: "/rejestracja-wylaczona", destination: `${erpAppUrl}/rejestracja-wylaczona` }
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui"],
  async redirects() {
    return [
      ...erpAuthRedirects.map((redirect) => ({ ...redirect, permanent: false })),
      { source: "/dashboard/:path*", destination: `${erpAppUrl}/dashboard/:path*`, permanent: false },
      { source: "/en/dashboard/:path*", destination: `${erpAppUrl}/en/dashboard/:path*`, permanent: false },
      { source: "/admin/:path*", destination: `${erpAppUrl}/admin/:path*`, permanent: false },
      { source: "/en/admin/:path*", destination: `${erpAppUrl}/en/admin/:path*`, permanent: false },
      { source: "/onboarding", destination: `${erpAppUrl}/onboarding`, permanent: false },
      { source: "/en/onboarding", destination: `${erpAppUrl}/en/onboarding`, permanent: false },
      { source: "/invite/:path*", destination: `${erpAppUrl}/invite/:path*`, permanent: false },
      { source: "/en/invite/:path*", destination: `${erpAppUrl}/en/invite/:path*`, permanent: false },
      { source: "/zaproszenie/:path*", destination: `${erpAppUrl}/zaproszenie/:path*`, permanent: false },
      { source: "/qr/:path*", destination: `${erpAppUrl}/qr/:path*`, permanent: false },
      { source: "/en/qr/:path*", destination: `${erpAppUrl}/en/qr/:path*`, permanent: false }
    ];
  },
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
        new URL(publicSiteUrl).hostname,
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
