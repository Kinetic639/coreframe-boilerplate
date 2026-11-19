import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export type AuthUserResult = { data: { user: User | null }; error: Error | null };

/**
 * The signed-in user for this request, from the verified session token.
 *
 * `getClaims()` checks the access token's signature against the project's
 * signing keys (fetched once and cached per server instance) and its expiry,
 * without a request to Supabase Auth. `auth.getUser()` made that request on
 * every render and server action: about 39k calls a day, the largest single
 * source of Supabase traffic.
 *
 * Trade-off: a session revoked elsewhere (sign-out on another device, a ban)
 * stays usable until its access token expires, at most the JWT lifetime
 * (1 hour by default). Data access is unaffected: RLS and the permission
 * checks read `user_effective_permissions`, which is always current. Flows
 * where a revoked session must be refused at once (password and e-mail
 * changes, the admin panel, invitations, sign-in) keep calling
 * `supabase.auth.getUser()` directly.
 *
 * Shared through React's request cache, so it runs once per request.
 */
export const getAuthUser = cache(async (): Promise<AuthUserResult> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return { data: { user: null }, error: error ?? null };
  }

  // The token carries what the app reads from the user: id, e-mail and the
  // metadata objects. Fields that exist only on the Auth record (created_at,
  // identities, ...) are not available here; call auth.getUser() for those.
  const user = {
    id: claims.sub,
    aud: Array.isArray(claims.aud) ? (claims.aud[0] ?? "") : (claims.aud ?? ""),
    role: claims.role,
    email: claims.email,
    phone: claims.phone,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    is_anonymous: claims.is_anonymous,
    created_at: "",
  } as User;

  return { data: { user }, error: null };
});
