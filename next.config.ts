import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["avatars.githubusercontent.com", "zlcnlalwfmmtusigeuyk.supabase.co", "picsum.photos"],
  },
  async redirects() {
    return [
      // English: /dashboard/account -> /dashboard/account/preferences
      {
        source: '/:locale/dashboard/account',
        destination: '/:locale/dashboard/account/preferences',
        permanent: true,
      },
      // Polish: /dashboard/konto -> /dashboard/konto/ustawienia
      {
        source: '/:locale/dashboard/konto',
        destination: '/:locale/dashboard/konto/ustawienia',
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    },
    // Memory optimizations for Codespaces
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  typescript: {
    // Disable TypeScript type-checking during builds to avoid timeout - run separately with 'npm run type-check'
    ignoreBuildErrors: true,
  },
  // Suppress Supabase Edge Runtime warnings
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /node_modules\/@supabase\/realtime-js/ },
        { module: /node_modules\/@supabase\/supabase-js/ },
      ];
    }
    return config;
  },
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

