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
 * 2. If item has children, skip exact match — active state is children-only.
 *    StartsWith still applies so parents remain active on dynamic sub-routes
 *    not covered by a specific child (e.g. next-intl pattern `/dashboard/tools/[slug]`).
 * 3. Exact match: item.match.exact === pathname  (leaf items only)
 * 4. StartsWith match: segment-aware prefix (uses isPrefixMatch)
 * 5. No match rule and no children → false
 */
export function isItemActive(item: SidebarItem, pathname: string): boolean {
  const hasChildren = item.children && item.children.length > 0;

  // Check children first (recursive)
  if (hasChildren) {
    if (item.children!.some((child) => isItemActive(child, pathname))) return true;
    // When children exist, skip exact match — only startsWith falls through.
    // This prevents a parent's own /exact/url from lighting up the parent when
    // the user is not on any of its children.
    if (!item.match?.startsWith) return false;
    return isPrefixMatch(pathname, item.match.startsWith);
  }

  // No match rule → not active
  if (!item.match) return false;

  // Exact match (leaf items)
  if (item.match.exact !== undefined) {
    return pathname === item.match.exact;
  }

  // Segment-aware prefix match
  if (item.match.startsWith !== undefined) {
    return isPrefixMatch(pathname, item.match.startsWith);
  }

  return false;
}
