import type { SidebarItem } from "@/lib/types/v2/sidebar";

/**
 * Segment-aware prefix matching.
 *
 * Returns true if `pathname` is equal to `prefix` OR starts with `prefix/`.
 * Prevents false positives like `/dashboard/organizationx` matching
 * a prefix rule of `/dashboard/organization`.
 */
export function isPrefixMatch(pathname: string, prefix: string): boolean {
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname === normalized || pathname.startsWith(normalized + "/");
}

/**
 * Determines if a sidebar item is active based on the current pathname.
 *
 * Rules (checked in priority order):
 * 1. If any child is active (recursive) → parent is active
 * 2. Exact match: item.match.exact === pathname
 * 3. StartsWith match: segment-aware prefix (uses isPrefixMatch)
 * 4. No match rule and no children → false
 *
 * Note: when an item has both children AND a match rule (e.g. the tools group
 * which gains children via pinned-tools injection), both are checked. This
 * allows the parent to stay active on dynamic sub-routes even when no specific
 * child's exact match fires (e.g. next-intl returns the route pattern
 * `/dashboard/tools/[slug]` rather than the resolved slug).
 */
export function isItemActive(item: SidebarItem, pathname: string): boolean {
  // Check children first (recursive)
  if (item.children && item.children.length > 0) {
    if (item.children.some((child) => isItemActive(child, pathname))) return true;
    // Fall through to own match rule — handles dynamic sub-routes where a
    // child's exact slug match may not fire but the parent's startsWith does.
  }

  // No match rule → not active
  if (!item.match) return false;

  // Exact match
  if (item.match.exact !== undefined) {
    return pathname === item.match.exact;
  }

  // Segment-aware prefix match
  if (item.match.startsWith !== undefined) {
    return isPrefixMatch(pathname, item.match.startsWith);
  }

  return false;
}
