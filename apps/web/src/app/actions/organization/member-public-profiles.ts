"use server";

import { z } from "zod";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { OrgMemberPublicProfileService } from "@/server/services/org-member-public-profile.service";
import { createClient } from "@/utils/supabase/server";

const listProfilesSchema = z.object({
  userIds: z.array(z.string().uuid()).max(100),
});

const getProfileSchema = z.object({
  userId: z.string().uuid(),
});

export async function listOrgMemberPublicProfilesAction(rawInput: unknown) {
  try {
    const parsed = listProfilesSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const supabase = await createClient();
    return await OrgMemberPublicProfileService.listProfiles(
      supabase,
      context.app.activeOrgId,
      parsed.data.userIds
    );
  } catch (error) {
    console.error("[listOrgMemberPublicProfilesAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function getOrgMemberPublicProfileAction(rawInput: unknown) {
  try {
    const parsed = getProfileSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const supabase = await createClient();
    return await OrgMemberPublicProfileService.getProfile(
      supabase,
      context.app.activeOrgId,
      parsed.data.userId
    );
  } catch (error) {
    console.error("[getOrgMemberPublicProfileAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}
