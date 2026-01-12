/**
 * Permission Matching Utilities
 *
 * Pure functions for checking permissions with wildcard support.
 * These functions implement deny-first semantics and wildcard matching.
 *
 * Wildcard semantics (compatible with existing PermissionService):
 * - `*` matches any characters including dots (greedy matching)
 * - "warehouse.*" matches "warehouse.products.read", "warehouse.inventory.view", etc.
 * - "warehouse.products.*" matches "warehouse.products.read", "warehouse.products.create", etc.
 * - "*" matches any permission
 * - Exact match: "warehouse.products.read" only matches that exact permission
 *
 * Note: This implementation uses regex-based wildcard matching for backward compatibility
 * with the existing PermissionService. Wildcards are greedy and match across segment boundaries.
 *
 * Performance: Uses a regex cache to avoid repeated compilation of the same patterns.
 */

import type { PermissionSnapshot } from "@/lib/types/permissions";

// Re-export the type for convenience
export type { PermissionSnapshot };

/**
 * Regex cache for wildcard patterns
 * Prevents repeated compilation of the same permission patterns
 */
const regexCache = new Map<string, RegExp>();

/**
 * Get a cached regex for a wildcard pattern
 *
 * @param patternWithWildcard - Pattern string with wildcards (e.g., "warehouse.*")
 * @returns Compiled and cached RegExp object
 */
function getCachedRegex(patternWithWildcard: string): RegExp {
  // Guard against empty string (would match everything)
  if (!patternWithWildcard) {
    throw new Error("getCachedRegex: pattern cannot be empty");
  }

  const cached = regexCache.get(patternWithWildcard);
  if (cached) return cached;

  const escaped = patternWithWildcard
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\*/g, ".*"); // Convert * to .*

  const re = new RegExp(`^${escaped}$`);
  regexCache.set(patternWithWildcard, re);
  return re;
}

/**
 * Check if a permission exists in the permission snapshot
 *
 * Uses deny-first semantics:
 * 1. Check if denied (including wildcard matches) -> false
 * 2. Check if allowed (including wildcard matches) -> true
 * 3. Otherwise -> false
 *
 * @param snapshot - Permission snapshot with allow and deny lists
 * @param requiredPermission - Permission to check for
 * @returns True if permission is allowed and not denied
 *
 * @example
 * ```typescript
 * const snapshot = {
 *   allow: ["warehouse.*", "teams.members.read"],
 *   deny: ["warehouse.products.delete"]
 * };
 *
 * checkPermission(snapshot, "warehouse.products.read");   // true (allow wildcard)
 * checkPermission(snapshot, "warehouse.products.delete"); // false (explicit deny)
 * checkPermission(snapshot, "teams.members.read");        // true (exact allow)
 * checkPermission(snapshot, "teams.members.create");      // false (not allowed)
 * ```
 */
export function checkPermission(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
  // Deny-first: if any deny pattern matches, return false
  if (matchesAnyPattern(snapshot.deny, requiredPermission)) {
    return false;
  }

  // Then check allow patterns
  return matchesAnyPattern(snapshot.allow, requiredPermission);
}

/**
 * Check if any pattern in the array matches the required permission
 *
 * Supports wildcard patterns:
 * - "warehouse.*" matches any permission starting with "warehouse."
 * - "warehouse.products.*" matches any permission starting with "warehouse.products."
 * - "*" matches everything
 *
 * @param patterns - Array of permission patterns (can include wildcards)
 * @param required - Required permission to check
 * @returns True if any pattern matches the required permission
 *
 * @example
 * ```typescript
 * matchesAnyPattern(["warehouse.*"], "warehouse.products.read"); // true
 * matchesAnyPattern(["warehouse.products.*"], "warehouse.products.read"); // true
 * matchesAnyPattern(["*"], "any.permission.here"); // true
 * matchesAnyPattern(["teams.*"], "warehouse.products.read"); // false
 * ```
 */
export function matchesAnyPattern(patterns: string[], required: string): boolean {
  for (const p of patterns) {
    // Exact match or universal wildcard
    if (p === "*" || p === required) return true;

    // Skip non-wildcard patterns
    if (!p.includes("*")) continue;

    // Use cached regex for wildcard patterns
    if (getCachedRegex(p).test(required)) return true;
  }
  return false;
}

/**
 * Clear the regex cache
 *
 * **FOR TESTING ONLY**
 *
 * This should be called in test cleanup (afterEach) to prevent cache pollution
 * between tests and potential memory leaks in long-running test suites.
 *
 * @internal
 *
 * @example
 * ```typescript
 * import { afterEach } from "vitest";
 * import { clearPermissionRegexCache } from "@/lib/utils/permissions";
 *
 * afterEach(() => {
 *   clearPermissionRegexCache();
 * });
 * ```
 */
export function clearPermissionRegexCache(): void {
  regexCache.clear();
}
