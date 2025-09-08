// components/ModuleSectionWrapper.tsx
import { MenuItem, ModuleConfig, LinkMenuItem } from "@/lib/types/module";
import { RoleCheck, Scope, UserRoleFromToken } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import ModuleSectionClient from "./ModuleSectionClient";
import { translateModuleLabel } from "@/utils/i18n/translateModuleLabel";

type Props = {
  module: ModuleConfig;
  accessToken: string;
  activeOrgId: string | null;
  activeBranchId: string | null;
  userPermissions: string[];
  translations: (key: string) => string;
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

function hasRequiredPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;

  // User must have ALL required permissions (AND logic)
  return requiredPermissions.every((permission) => userPermissions.includes(permission));
}

function isLinkMenuItem(item: MenuItem): item is LinkMenuItem {
  return (item as LinkMenuItem).path !== undefined;
}

export default function ModuleSectionWrapper({
  module,
  accessToken,
  activeOrgId,
  activeBranchId,
  userPermissions,
  translations,
}: Props) {
  const roles = getUserRolesFromJWT(accessToken);

  const visibleItems = module.items
    .filter((item) => {
      // Check permission-based access first (preferred)
      if (item.requiredPermissions) {
        const hasAccess = hasRequiredPermissions(userPermissions, item.requiredPermissions);
        if (!hasAccess) return false;
      }
      // Fallback to role-based access for backward compatibility
      else if (item.allowedUsers) {
        const checks = mapAllowedUsersToChecks(item.allowedUsers, activeOrgId, activeBranchId);
        const hasAccess = checks.length === 0 || hasMatchingRole(roles, checks);
        if (!hasAccess) return false;
      }

      // If the item has submenu, filter it too
      if (isLinkMenuItem(item) && item.submenu) {
        const visibleSubmenu = item.submenu.filter((subitem) => {
          // Check permission-based access first (preferred)
          if (subitem.requiredPermissions) {
            return hasRequiredPermissions(userPermissions, subitem.requiredPermissions);
          }

          // Fallback to role-based access for backward compatibility
          if (subitem.allowedUsers) {
            const checks = mapAllowedUsersToChecks(
              subitem.allowedUsers,
              activeOrgId,
              activeBranchId
            );
            return checks.length === 0 || hasMatchingRole(roles, checks);
          }

          // If no restrictions, show the subitem
          return true;
        });

        // Update the item's submenu to only show visible items
        item.submenu = visibleSubmenu;

        // Hide the parent item if no submenu items are visible
        if (visibleSubmenu.length === 0) return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      label: translateModuleLabel(item.label, translations),
      // Ensure submenu is properly filtered and translated
      ...(isLinkMenuItem(item) && item.submenu
        ? {
            submenu: item.submenu
              .filter((subitem) => {
                if (subitem.requiredPermissions) {
                  return hasRequiredPermissions(userPermissions, subitem.requiredPermissions);
                }
                if (subitem.allowedUsers) {
                  const checks = mapAllowedUsersToChecks(
                    subitem.allowedUsers,
                    activeOrgId,
                    activeBranchId
                  );
                  return checks.length === 0 || hasMatchingRole(roles, checks);
                }
                return true;
              })
              .map((subitem) => ({
                ...subitem,
                label: translateModuleLabel(subitem.label, translations),
              })),
          }
        : {}),
    }));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <ModuleSectionClient
      module={{
        slug: module.slug,
        title: translateModuleLabel(module.title, translations),
        icon: module.icon,
        items: visibleItems,
      }}
      activeBranchId={activeBranchId}
      activeOrgId={activeOrgId}
    />
  );
}
