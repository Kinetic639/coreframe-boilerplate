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
    ignoreDuringBuilds: false,
  },
};
 
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

