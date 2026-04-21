import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig = {
  reactStrictMode: true,
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
      // English: /en/dashboard/account -> /en/dashboard/account/preferences
      {
        source: '/en/dashboard/account',
        destination: '/en/dashboard/account/preferences',
        permanent: true,
      },
      // Polish (default locale, no prefix): /dashboard/konto -> /dashboard/konto/ustawienia
      {
        source: '/dashboard/konto',
        destination: '/dashboard/konto/ustawienia',
        permanent: true,
      },
    ];
  },
  serverExternalPackages: ["pdfjs-dist", "pdfjs-dist/legacy/build/pdf.mjs"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
      bodySizeLimit: "50mb",
    },
    // Memory optimizations for Codespaces
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
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
