import { RoleCheck } from "@/lib/types/user";
import { UserRole } from "./getUserRolesFromJWT";

export function hasMatchingRole(userRoles: UserRole[], checks: RoleCheck[]): boolean {
  return checks.some((check) => {
    return userRoles.some((userRole) => {
      const sameRole = userRole.role === check.role;

      // Jeśli check.scope i check.id są określone, porównujemy z odpowiednim polem
      if (check.scope === "org" && check.id) {
        return sameRole && userRole.org_id === check.id;
      }

      if (check.scope === "branch" && check.id) {
        return sameRole && userRole.branch_id === check.id;
      }

      // Jeżeli check.id jest określone, ale bez scope – porównujemy oba ID
      if (!check.scope && check.id) {
        return sameRole && (userRole.org_id === check.id || userRole.branch_id === check.id);
      }

      // Jeżeli ani scope ani id nie są określone – porównujemy tylko nazwę roli
      return sameRole;
    });
  });
}
