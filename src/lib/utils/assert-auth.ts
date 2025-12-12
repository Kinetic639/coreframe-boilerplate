import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

/**
 * Simple auth helper (no middleware).
 * Returns user + supabase client or throws.
 */
export async function assertAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { user, supabase };
}

/**
 * Get user + organization context.
 */
export async function getUserContext() {
  const { user, supabase } = await assertAuth();
  const appContext = await loadAppContextServer();

  if (!appContext?.activeOrgId) {
    throw new Error("No organization context");
  }

  // TODO: Get user role and permissions from database when needed
  // For now, we'll fetch them separately if required
  return {
    user,
    supabase,
    organizationId: appContext.activeOrgId,
    branchId: appContext.activeBranchId,
    userRole: "user" as string, // Placeholder - will be fetched when needed
    permissions: [] as string[], // Placeholder - will be fetched when needed
  };
}
