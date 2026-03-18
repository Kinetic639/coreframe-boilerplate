import { createClient } from "@/utils/supabase/client";
import { AuthService } from "@/server/services/auth.service";

export async function getRolesClient(): Promise<
  { role: string; org_id: string | null; branch_id: string | null; team_id: string | null }[]
> {
  const supabase = createClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    console.error("Client session error:", error);
    return [];
  }

  // Use AuthService.getUserRoles instead of manual JWT decode
  const roles = AuthService.getUserRoles(session.access_token);

  return roles.map((role) => ({
    role: role.role,
    org_id: role.org_id,
    branch_id: role.branch_id,
    team_id: null,
  }));
}
