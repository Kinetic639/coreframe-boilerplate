"use server";

import { createClient } from "@/utils/supabase/server";
import { loadAppContextWithClient } from "@/lib/api/load-app-context-server";
import {
  EntitlementsAdminService,
  AdminActionError,
} from "@/server/services/entitlements-admin.service";

// ---------------------------------------------------------------------------
// Shared auth + enforcement helper
// ---------------------------------------------------------------------------

/**
 * Creates a single server Supabase client, authenticates, resolves org context,
 * and enforces dev mode + org owner.
 *
 * Returns the authenticated client and orgId for use by the calling action.
 * Throws on any failure (auth, org context, dev mode, ownership).
 */
export async function enforceAdminAccess() {
  const supabase = await createClient();

  // Authenticate via getUser() (validates JWT against Supabase Auth server)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  // Resolve org context using the same client (no duplicate client creation)
  const appContext = await loadAppContextWithClient(supabase);
  if (!appContext?.activeOrgId) {
    throw new Error("No active organization");
  }

  // Enforce dev mode + org owner (defense-in-depth, also checked in RPCs)
  await EntitlementsAdminService.assertDevModeEnabled(supabase);
  await EntitlementsAdminService.assertOrgOwner(supabase, appContext.activeOrgId);

  return { supabase, orgId: appContext.activeOrgId };
}

// ---------------------------------------------------------------------------
// Error handling helpers
// ---------------------------------------------------------------------------

/**
 * Type guard for AdminActionError with defensive shape checking.
 *
 * Checks both instanceof (normal case) and object shape (edge cases like
 * serialization boundaries, bundling issues).
 *
 * @param error - Unknown error value
 * @returns True if error is AdminActionError or has AdminActionError shape
 */
export function isAdminActionError(error: unknown): error is AdminActionError {
  // Fast path: instanceof check
  if (error instanceof AdminActionError) {
    return true;
  }

  // Defensive path: shape check for serialization edge cases
  return (
    error !== null &&
    typeof error === "object" &&
    "publicMessage" in error &&
    typeof (error as any).publicMessage === "string"
  );
}

/**
 * Log admin action errors with sanitized structured context for debugging.
 *
 * **Sanitization**:
 * - AdminActionError: logs only publicMessage + code (safe for logs)
 * - Generic Error: logs only name (NOT message, which may contain internals)
 * - Non-Error: logs type info only
 *
 * **Safe**: does not log tokens, full user objects, request headers, or raw DB/RPC messages.
 *
 * @param action - Action name (e.g., "actionSwitchPlan")
 * @param meta - Contextual metadata (orgId, input params)
 * @param error - Unknown error value
 */
export function logActionError(
  action: string,
  meta: Record<string, unknown>,
  error: unknown
): void {
  let errorInfo: Record<string, unknown>;

  if (isAdminActionError(error)) {
    // AdminActionError: log only safe public fields
    errorInfo = {
      name: "AdminActionError",
      publicMessage: error.publicMessage,
      code: error.code ?? undefined,
    };
  } else if (error instanceof Error) {
    // Generic Error: log only name (DO NOT log error.message — may contain internals)
    errorInfo = {
      name: error.name,
      isError: true,
    };
  } else {
    // Non-Error value: log type only
    errorInfo = {
      valueType: typeof error,
    };
  }

  console.error(`[EntitlementsAdmin] ${action} failed`, {
    ...meta,
    error: errorInfo,
  });
}
