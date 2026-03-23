/**
 * Permission Snapshot Factories
 *
 * Reusable builders for PermissionSnapshot test fixtures.
 * Used by @repo/domain tests and apps/web tests.
 */

import type { PermissionSnapshot } from "@repo/contracts/permissions";

/**
 * Build a PermissionSnapshot with explicit allow and deny arrays.
 *
 * @example
 * makePermissionSnapshot(["members.read", "branches.view.any"])
 * makePermissionSnapshot(["warehouse.*"], ["warehouse.products.delete"])
 */
export function makePermissionSnapshot(
  allow: string[] = [],
  deny: string[] = []
): PermissionSnapshot {
  return { allow, deny };
}

/**
 * Build a PermissionSnapshot that allows the given slugs (no denies).
 *
 * @example
 * makePermissionSnapshotAllowing("members.read", "invites.create")
 */
export function makePermissionSnapshotAllowing(...slugs: string[]): PermissionSnapshot {
  return { allow: slugs, deny: [] };
}

/**
 * Build an empty PermissionSnapshot (no allow, no deny).
 * Represents a user with no permissions.
 */
export function makeEmptyPermissionSnapshot(): PermissionSnapshot {
  return { allow: [], deny: [] };
}

/**
 * Build a PermissionSnapshot with a wildcard allow (grants everything).
 * Useful for tests that need an unrestricted viewer.
 */
export function makeAdminPermissionSnapshot(): PermissionSnapshot {
  return { allow: ["*"], deny: [] };
}
