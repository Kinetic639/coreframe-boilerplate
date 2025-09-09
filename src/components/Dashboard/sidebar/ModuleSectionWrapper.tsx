// components/ModuleSectionWrapper.tsx
import { MenuItem, ModuleConfig, LinkMenuItem } from "@/lib/types/module";
import { RoleCheck, Scope, UserRoleFromToken } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { ModuleSection } from "./ModuleSection";
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

function filterAndTranslateMenuItems(
  items: MenuItem[],
  userRoles: UserRoleFromToken[],
  userPermissions: string[],
  activeOrgId: string | null,
  activeBranchId: string | null,
  translations: (key: string) => string
): MenuItem[] {
  return items
    .map((item) => {
      // Check permissions first
      if (item.requiredPermissions) {
        if (!hasRequiredPermissions(userPermissions, item.requiredPermissions)) {
          return null; // Filter out this item
        }
      } else if (item.allowedUsers) {
        const checks = mapAllowedUsersToChecks(item.allowedUsers, activeOrgId, activeBranchId);
        if (checks.length > 0 && !hasMatchingRole(userRoles, checks)) {
          return null; // Filter out this item
        }
      }

      // Process submenu if it exists
      let processedItem: MenuItem = {
        ...item,
        label: translateModuleLabel(item.label, translations),
      };

      if (isLinkMenuItem(item) && item.submenu) {
        const filteredSubmenu = filterAndTranslateMenuItems(
          item.submenu,
          userRoles,
          userPermissions,
          activeOrgId,
          activeBranchId,
          translations
        );

        // If no submenu items are visible, hide the parent
        if (filteredSubmenu.length === 0) {
          return null;
        }

        processedItem = {
          ...processedItem,
          submenu: filteredSubmenu,
        } as LinkMenuItem;
      }

      return processedItem;
    })
    .filter((item): item is MenuItem => item !== null);
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

  const visibleItems = filterAndTranslateMenuItems(
    module.items,
    roles,
    userPermissions,
    activeOrgId,
    activeBranchId,
    translations
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <ModuleSection
      module={{
        slug: module.slug,
        title: translateModuleLabel(module.title, translations),
        icon: module.icon,
        items: visibleItems,
      }}
    />
  );
}
