// components/HasAnyRoleServer.tsx
import { ReactNode } from "react";
import { RoleCheck } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";
import { createClient } from "@/utils/supabase/server";

type Props = {
  checks: RoleCheck[];
  children: ReactNode;
  fallback?: ReactNode;
};

export default async function HasAnyRoleServer({ checks, children, fallback = null }: Props) {
  const supabase = await createClient();

  // Use getUser() for server-side JWT validation (not getSession() which is cookie-only).
  // If the user is not authenticated or the token is invalid, fail closed.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <>{fallback}</>;
  }

  // Session is safe to read after getUser() has validated the JWT.
  // We need the raw access_token to decode embedded role claims.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const roles = token ? getUserRolesFromJWT(token) : [];

  const hasAccess = hasMatchingRole(roles, checks);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
