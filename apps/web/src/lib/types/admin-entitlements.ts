/**
 * AdminEntitlements
 *
 * Mirrors the `admin_entitlements` table row.
 * Loaded server-side via AdminEntitlementsService.
 * Controls whether a user has access to Admin Dashboard V2.
 */
export interface AdminEntitlements {
  user_id: string;
  enabled: boolean;
  updated_at: string;
}
