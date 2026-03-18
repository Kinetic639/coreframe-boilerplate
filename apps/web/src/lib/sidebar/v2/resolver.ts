import type { SidebarResolverInput, SidebarModel, SidebarItem } from "@/lib/types/v2/sidebar";
import { checkPermission } from "@/lib/utils/permissions";

/**
 * Check if item should be visible based on visibility rules
 */
function isItemVisible(item: SidebarItem, input: SidebarResolverInput): boolean {
  if (!item.visibility) {
    return true; // Public item
  }

  const { visibility } = item;
  const { permissionSnapshot, entitlements } = input;

  // Check requiresPermissions (AND logic)
  if (visibility.requiresPermissions && visibility.requiresPermissions.length > 0) {
    const hasAllPermissions = visibility.requiresPermissions.every((permission) =>
      checkPermission(permissionSnapshot, permission)
    );
    if (!hasAllPermissions) {
      return false;
    }
  }

  // Check requiresAnyPermissions (OR logic)
  if (visibility.requiresAnyPermissions && visibility.requiresAnyPermissions.length > 0) {
    const hasAnyPermission = visibility.requiresAnyPermissions.some((permission) =>
      checkPermission(permissionSnapshot, permission)
    );
    if (!hasAnyPermission) {
      return false;
    }
  }

  // Check requiresModules (AND logic) — fail-closed if entitlements null
  if (visibility.requiresModules && visibility.requiresModules.length > 0) {
    if (!entitlements) {
      return false; // Fail-closed
    }
    const hasAllModules = visibility.requiresModules.every((module) =>
      entitlements.enabled_modules.includes(module)
    );
    if (!hasAllModules) {
      return false;
    }
  }

  // Check requiresAnyModules (OR logic) — fail-closed if entitlements null
  if (visibility.requiresAnyModules && visibility.requiresAnyModules.length > 0) {
    if (!entitlements) {
      return false; // Fail-closed
    }
    const hasAnyModule = visibility.requiresAnyModules.some((module) =>
      entitlements.enabled_modules.includes(module)
    );
    if (!hasAnyModule) {
      return false;
    }
  }

  return true;
}

/**
 * Determine WHY a non-visible item is restricted.
 * Mirrors the check order in isItemVisible so the first failure drives the reason.
 * Only called when isItemVisible already returned false.
 */
function getDisabledReason(
  item: SidebarItem,
  input: SidebarResolverInput
): "permission" | "entitlement" {
  const { visibility } = item;
  if (!visibility) return "permission"; // safe fallback; public items should never reach here

  const { permissionSnapshot, entitlements } = input;

  if (visibility.requiresPermissions && visibility.requiresPermissions.length > 0) {
    const ok = visibility.requiresPermissions.every((p) => checkPermission(permissionSnapshot, p));
    if (!ok) return "permission";
  }

  if (visibility.requiresAnyPermissions && visibility.requiresAnyPermissions.length > 0) {
    const ok = visibility.requiresAnyPermissions.some((p) =>
      checkPermission(permissionSnapshot, p)
    );
    if (!ok) return "permission";
  }

  // Reached here with isItemVisible=false → must be a module-gating failure
  void entitlements; // referenced for clarity; actual check was in isItemVisible
  return "entitlement";
}

/**
 * Filter sidebar items recursively
 *
 * IMPORTANT: This function ONLY handles VISIBILITY.
 * It does NOT compute active state (that's client-side, using router pathname).
 */
function filterItems(items: SidebarItem[], input: SidebarResolverInput): SidebarItem[] {
  return items
    .map((item): SidebarItem | null => {
      // Registry status="coming_soon": always shown disabled, regardless of visibility rules.
      // disabledReason is set explicitly in output; href is omitted to prevent navigation.
      if (item.status === "coming_soon") {
        let resolvedChildren: SidebarItem[] | undefined;
        if (item.children && item.children.length > 0) {
          resolvedChildren = filterItems(item.children, input);
        }
        return {
          ...item,
          href: undefined,
          disabledReason: "coming_soon",
          children: resolvedChildren,
        };
      }

      // Filter children first (if any)
      let filteredChildren: SidebarItem[] | undefined;
      if (item.children && item.children.length > 0) {
        filteredChildren = filterItems(item.children, input);
      }

      // Check visibility (permissions + entitlements)
      const visible = isItemVisible(item, input);
      if (!visible) {
        // showWhenDisabled: keep item as muted/disabled instead of pruning
        if (item.showWhenDisabled) {
          const disabledReason = getDisabledReason(item, input);
          return { ...item, href: undefined, children: filteredChildren, disabledReason };
        }
        return null; // Default: prune
      }

      // If parent has children, hide parent if all children hidden
      if (item.children && (!filteredChildren || filteredChildren.length === 0)) {
        return null; // Hide empty parent
      }

      // Return filtered item with children (NO active state)
      return { ...item, children: filteredChildren };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Resolve sidebar model from registry and input
 *
 * This is a PURE, DETERMINISTIC function:
 * - No side effects (no DB, no API, no filesystem)
 * - Same inputs → IDENTICAL output (every single time)
 * - No timestamps, no random values, no Date.now()
 * - No reading from process.env or global state
 *
 * CRITICAL: Determinism is REQUIRED for:
 * - Snapshot testing (tests must not fail on timestamp changes)
 * - Memoization (React useMemo must see stable data)
 * - SSR hydration (server and client must produce identical output)
 * - Debugging (comparing two models must be meaningful)
 */
export function resolveSidebarModel(
  input: SidebarResolverInput,
  registry: Pick<SidebarModel, "main" | "footer">
): SidebarModel {
  const main = filterItems(registry.main || [], input);
  const footer = filterItems(registry.footer || [], input);

  // IMPORTANT: Return ONLY filtered items.
  // No timestamps, no metadata, no debug info.
  // The model must be 100% deterministic.
  return {
    main,
    footer,
  };
}
