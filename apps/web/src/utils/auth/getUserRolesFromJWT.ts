import { UserRoleFromToken } from "@/lib/types/user";
import { AuthService } from "@/server/services/auth.service";

export function getUserRolesFromJWT(accessToken: string): UserRoleFromToken[] {
  return AuthService.getUserRoles(accessToken).map((role) => ({
    role: role.role ?? role.name,
    org_id: role.org_id,
    branch_id: role.branch_id,
    team_id: null,
  }));
}
