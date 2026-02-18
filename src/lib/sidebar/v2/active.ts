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
 * 1. Parent active if any child is active (recursive)
 * 2. Exact match: item.match.exact === pathname
 * 3. StartsWith match: segment-aware prefix (uses isPrefixMatch)
 * 4. No match rule and no children → false
 */
export function isItemActive(item: SidebarItem, pathname: string): boolean {
  // Parent is active if any child is active (recursive)
  if (item.children && item.children.length > 0) {
    return item.children.some((child) => isItemActive(child, pathname));
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
