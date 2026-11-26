import { getAuthCookieOptions } from "@repo/app-urls";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { buildClientInfo, CLIENT_INFO_PREFIX, fetchWithClientInfo } from "./request-source";

async function readClientInfo(): Promise<string> {
  try {
    return buildClientInfo(await headers());
  } catch {
    return `${CLIENT_INFO_PREFIX}; kind=unknown`;
  }
}

export const createClient = async () => {
  const cookieStore = await cookies();
  const clientInfo = await readClientInfo();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Shows in Supabase API logs as request.headers.x_client_info.
        // Set in fetch: @supabase/ssr overwrites X-Client-Info in global.headers.
        fetch: fetchWithClientInfo(clientInfo),
      },
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};
