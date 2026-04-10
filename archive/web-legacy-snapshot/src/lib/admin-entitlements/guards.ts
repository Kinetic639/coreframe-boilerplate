import { redirect } from "@/i18n/navigation";
import type { AdminEntitlements } from "@/lib/types/admin-entitlements";

/**
 * Admin access guard — throws if user is not enabled for admin access.
 *
 * Use this when you want an explicit error rather than a redirect.
 * Type predicate narrows the type to AdminEntitlements (non-null, enabled).
 */
export function requireAdminAccess(
  entitlements: AdminEntitlements | null
): asserts entitlements is AdminEntitlements {
  if (!entitlements?.enabled) {
    throw new Error("Admin access required");
  }
}

/**
 * Admin access guard — redirects to /dashboard/start if user is not enabled.
 *
 * Use this in Server Component pages/layouts to silently redirect
 * non-admin users back to the main dashboard.
 */
export function requireAdminOrRedirect(
  entitlements: AdminEntitlements | null,
  locale: string
): void {
  if (!entitlements?.enabled) {
    redirect({ href: "/dashboard/start", locale });
  }
}

/**
 * Map an AdminEntitlements error to a user-facing message.
 * Useful for error boundaries or admin-specific error pages.
 */
export function mapAdminEntitlementError(error: unknown): string {
  if (error instanceof Error && error.message === "Admin access required") {
    return "You do not have permission to access the admin panel.";
  }
  return "An unexpected error occurred while verifying admin access.";
}
