import { RoleCheck, UserRoleFromToken } from "@/lib/types/user";

export function hasMatchingRole(userRoles: UserRoleFromToken[], checks: RoleCheck[]): boolean {
  return checks.some((check) => {
    return userRoles.some((userRole) => {
      const sameRole = userRole.role === check.role;

      if (check.scope === "org" && check.id) {
        return sameRole && userRole.org_id === check.id;
      }

      if (check.scope === "branch" && check.id) {
        return sameRole && userRole.branch_id === check.id;
      }

      if (!check.scope && check.id) {
        return sameRole && (userRole.org_id === check.id || userRole.branch_id === check.id);
      }

      return sameRole;
    });
  });
}
