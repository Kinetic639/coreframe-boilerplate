// components/HasAnyRoleServer.tsx
import { ReactNode } from "react";
import { RoleCheck } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";
import { createClient } from "@/lib/supabase/server";

type Props = {
  checks: RoleCheck[];
  children: ReactNode;
  fallback?: ReactNode;
};

export default async function HasAnyRoleServer({ checks, children, fallback = null }: Props) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const roles = token ? getUserRolesFromJWT(token) : [];

  const hasAccess = hasMatchingRole(roles, checks);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
