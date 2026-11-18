import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * The signed-in user, checked against Supabase Auth once per request.
 *
 * The app and user context loaders and the server actions all need it; each
 * used to call `auth.getUser()` on its own (a network round trip to Supabase
 * Auth, about 130 ms each, three or four times per request). Shared through
 * React's request cache, it is one call.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
