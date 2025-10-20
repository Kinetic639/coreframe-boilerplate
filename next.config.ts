import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["avatars.githubusercontent.com", "zlcnlalwfmmtusigeuyk.supabase.co", "picsum.photos"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    }
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true, // Disable ESLint during builds - run separately with 'npm run lint'
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
};
 
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

