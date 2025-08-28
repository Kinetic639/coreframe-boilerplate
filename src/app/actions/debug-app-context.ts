"use server";

import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { createClient } from "@/utils/supabase/server";

export async function debugAppContext() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "No session" };

  const userId = session.user.id;

  // Load ONLY app context - user context is separate store
  const appContext = await loadAppContextServer();

  return {
    userId,
    // FULL APP CONTEXT OBJECT - NO DUPLICATES
    appContext: appContext,

    // Status summary
    isWorking: !!appContext?.activeOrg,
    wouldRedirect: !appContext?.activeOrg,
    summary: {
      hasActiveOrg: !!appContext?.activeOrg,
      activeOrgName: appContext?.activeOrg?.name || null,
      activeOrgId: appContext?.activeOrgId || null,
      branchesCount: appContext?.availableBranches?.length || 0,
      modulesCount: appContext?.userModules?.length || 0,
    },
  };
}
