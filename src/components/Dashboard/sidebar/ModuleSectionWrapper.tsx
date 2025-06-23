// components/ModuleSectionWrapper.tsx
import { MenuItem, ModuleConfig } from "@/lib/types/module";
import { RoleCheck, Scope, UserRoleFromToken } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import ModuleSectionClient from "./ModuleSectionClient";

type Props = {
  module: ModuleConfig;
  accessToken: string;
  activeOrgId: string | null;
  activeBranchId: string | null;
};

function mapAllowedUsersToChecks(
  allowedUsers: MenuItem["allowedUsers"],
  activeOrgId: string | null,
  activeBranchId: string | null
): RoleCheck[] {
  if (!allowedUsers) return [];

  return allowedUsers.map((u) => ({
    role: u.role,
    scope: u.scope as Scope,
    id: u.scope === "org" ? (activeOrgId ?? undefined) : (activeBranchId ?? undefined),
  }));
}

function hasMatchingRole(userRoles: UserRoleFromToken[], checks: RoleCheck[]): boolean {
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

export default function ModuleSectionWrapper({
  module,
  accessToken,
  activeOrgId,
  activeBranchId,
}: Props) {
  const roles = getUserRolesFromJWT(accessToken);

  const visibleItems = module.items.filter((item) => {
    const checks = mapAllowedUsersToChecks(item.allowedUsers, activeOrgId, activeBranchId);
    return checks.length === 0 || hasMatchingRole(roles, checks);
  });

  return (
    <ModuleSectionClient
      module={{
        slug: module.slug,
        title: module.title,
        items: visibleItems,
      }}
    />
  );
}
