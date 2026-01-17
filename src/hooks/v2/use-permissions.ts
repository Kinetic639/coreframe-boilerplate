"use client";

import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { checkPermission, type PermissionSnapshot } from "@/lib/utils/permissions";

/**
 * Client-side permission checking hook for V2 architecture
 *
 * This hook provides a clean API for checking user permissions in React components.
 * It uses the PermissionSnapshot from the user store, which is hydrated from the server
 * and kept in sync via the PermissionsSync component.
 *
 * **Architecture Notes:**
 * - NO server-side fetching (uses snapshot from store)
 * - Supports wildcard patterns ("warehouse.*", "teams.members.*")
 * - Deny-first semantics (deny overrides allow)
 * - Reactive to permission changes via Zustand store
 * - Uses pure functions from @/lib/utils/permissions for testability
 *
 * @example
 * ```tsx
 * function ProductsPage() {
 *   const { can, cannot, canAny, canAll } = usePermissions();
 *
 *   if (cannot("warehouse.products.read")) {
 *     return <AccessDenied />;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Products</h1>
 *       {can("warehouse.products.create") && (
 *         <Button onClick={handleCreate}>Create Product</Button>
 *       )}
 *       {canAny(["warehouse.products.edit", "warehouse.products.delete"]) && (
 *         <BulkActions />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions() {
  const permissionSnapshot = useUserStoreV2((state) => state.permissionSnapshot);

  /**
   * Check if user has a specific permission
   *
   * Uses deny-first semantics:
   * 1. Check if denied (including wildcard matches) -> false
   * 2. Check if allowed (including wildcard matches) -> true
   * 3. Otherwise -> false
   *
   * @param permission - Permission to check (e.g., "warehouse.products.read")
   * @returns True if permission is allowed and not denied
   *
   * @example
   * ```tsx
   * const { can } = usePermissions();
   *
   * if (can("warehouse.products.edit")) {
   *   // User can edit products
   * }
   * ```
   */
  const can = (permission: string): boolean => {
    return checkPermission(permissionSnapshot, permission);
  };

  /**
   * Check if user does NOT have a specific permission
   *
   * This is a convenience method that returns the negation of can().
   * Improves code readability in conditional checks.
   *
   * @param permission - Permission to check (e.g., "warehouse.products.delete")
   * @returns True if permission is NOT allowed (denied or not granted)
   *
   * @example
   * ```tsx
   * const { cannot } = usePermissions();
   *
   * if (cannot("warehouse.products.delete")) {
   *   // Hide delete button
   *   return null;
   * }
   *
   * return <DeleteButton />;
   * ```
   */
  const cannot = (permission: string): boolean => {
    return !can(permission);
  };

  /**
   * Check if user has ANY of the specified permissions
   *
   * Returns true if at least one permission is allowed.
   *
   * @param permissions - Array of permissions to check
   * @returns True if user has at least one of the permissions
   *
   * @example
   * ```tsx
   * const { canAny } = usePermissions();
   *
   * if (canAny(["warehouse.products.edit", "warehouse.products.delete"])) {
   *   // User can either edit or delete products
   * }
   * ```
   */
  const canAny = (permissions: string[]): boolean => {
    return permissions.some((permission) => checkPermission(permissionSnapshot, permission));
  };

  /**
   * Check if user has ALL of the specified permissions
   *
   * Returns true only if all permissions are allowed.
   *
   * @param permissions - Array of permissions to check
   * @returns True if user has all of the permissions
   *
   * @example
   * ```tsx
   * const { canAll } = usePermissions();
   *
   * if (canAll(["warehouse.products.edit", "warehouse.inventory.manage"])) {
   *   // User has both permissions
   * }
   * ```
   */
  const canAll = (permissions: string[]): boolean => {
    return permissions.every((permission) => checkPermission(permissionSnapshot, permission));
  };

  /**
   * Get the current permission snapshot
   *
   * Useful for debugging or passing to other utilities.
   *
   * @returns Current permission snapshot with allow and deny lists
   *
   * @example
   * ```tsx
   * const { getSnapshot } = usePermissions();
   *
   * const snapshot = getSnapshot();
   * console.log("Allowed:", snapshot.allow);
   * console.log("Denied:", snapshot.deny);
   * ```
   */
  const getSnapshot = (): PermissionSnapshot => {
    return permissionSnapshot;
  };

  return {
    can,
    cannot,
    canAny,
    canAll,
    getSnapshot,
  };
}
