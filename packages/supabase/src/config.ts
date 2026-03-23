/**
 * Supabase connection configuration interfaces.
 *
 * These interfaces document the env var contract that all Supabase clients
 * (web browser, web SSR, future mobile) must satisfy.
 *
 * Runtime client creation remains app-local. This package defines only the
 * shape of the configuration each adapter receives — not how it obtains it.
 *
 * Note on env var naming:
 *   - apps/web reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - future apps/mobile will read from its own env var convention
 *   The shared interface intentionally uses platform-neutral field names.
 */

/**
 * Public (client-side) Supabase configuration.
 * Safe to expose to browser and mobile runtimes.
 */
export interface SupabaseClientConfig {
  /** Project URL (e.g. https://<ref>.supabase.co) */
  url: string;
  /** Anon/publishable key — RLS is enforced, safe to embed */
  anonKey: string;
}

/**
 * Server-only Supabase service-role configuration.
 * NEVER expose to browser or mobile runtimes.
 * Bypasses Row Level Security — must remain server-side only.
 */
export interface SupabaseServiceConfig {
  /** Project URL */
  url: string;
  /** Service role key — bypasses RLS, treat as a server secret */
  serviceRoleKey: string;
}
