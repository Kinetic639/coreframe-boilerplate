import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@repo/supabase/database";

export type PortalSupabase = SupabaseClient<Database>;

export const createClient = async (): Promise<PortalSupabase> => {
  const cookieStore = await cookies();

  // @supabase/ssr 0.6 predates supabase-js 2.110's client generics and resolves typed
  // tables to `never`; the runtime client is the same, so narrow it to the typed one.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component -- the proxy refreshes the session instead.
          }
        },
      },
    }
  ) as unknown as PortalSupabase;
};
