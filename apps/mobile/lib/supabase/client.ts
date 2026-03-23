import { createClient } from "@supabase/supabase-js";
import type { SupabaseClientConfig } from "@repo/supabase/config";

import { expoSecureStoreAdapter } from "./storage-adapter";

/**
 * Mobile Supabase client configuration.
 *
 * Reads EXPO_PUBLIC_* env vars (set in .env.local or EAS secrets).
 * These are inlined at build time by the Expo bundler — safe to read
 * from process.env on both iOS and Android.
 *
 * Mobile-local: client creation stays in apps/mobile.
 * @repo/supabase provides the SupabaseClientConfig interface contract only.
 */
const config: SupabaseClientConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
};

/**
 * Singleton Supabase client for apps/mobile.
 *
 * Auth config:
 * - storage: expo-secure-store (encrypted device keychain)
 * - autoRefreshToken: true (silent refresh before expiry)
 * - persistSession: true (survives app backgrounding / restart)
 * - detectSessionInUrl: false (no browser URL bar on native)
 */
export const mobileSupabase = createClient(config.url, config.anonKey, {
  auth: {
    storage: expoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
