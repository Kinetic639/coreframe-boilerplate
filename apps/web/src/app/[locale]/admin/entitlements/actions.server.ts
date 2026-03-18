"use server";

import { createClient } from "@/utils/supabase/server";
import { loadAppContextWithClient } from "@/lib/api/load-app-context-server";
import { EntitlementsAdminService } from "@/server/services/entitlements-admin.service";

export async function enforceAdminAccess() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const appContext = await loadAppContextWithClient(supabase);
  if (!appContext?.activeOrgId) {
    throw new Error("No active organization");
  }

  await EntitlementsAdminService.assertDevModeEnabled(supabase);
  await EntitlementsAdminService.assertOrgOwner(supabase, appContext.activeOrgId);

  return { supabase, orgId: appContext.activeOrgId };
}
