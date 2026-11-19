import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

/**
 * Creates a Supabase client with service role permissions.
 * This client bypasses Row Level Security (RLS) policies.
 * ONLY use after proper permission validation.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    // Shows in Supabase API logs as request.headers.x_client_info.
    global: { headers: { "X-Client-Info": "ambra-web; kind=service" } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
