import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui"],
  async redirects() {
    return [
      { source: "/vendors", destination: `${publicSiteUrl}/vmi/vendors`, permanent: true },
      {
        source: "/vendors/:path*",
        destination: `${publicSiteUrl}/vmi/vendors/:path*`,
        permanent: true,
      },
      { source: "/products", destination: `${publicSiteUrl}/vmi/products`, permanent: true },
      {
        source: "/products/:path*",
        destination: `${publicSiteUrl}/vmi/products/:path*`,
        permanent: true,
      },
      {
        source: "/flyers/:path*",
        destination: `${publicSiteUrl}/vmi/flyers/:path*`,
        permanent: true,
      },
    ];
  },
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

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
