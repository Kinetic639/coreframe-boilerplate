import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["avatars.githubusercontent.com"],
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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    nextConfig.images?.domains?.push(hostname);
  } catch {
    // ignore invalid URL
  }
}

export default withNextIntl(nextConfig);

