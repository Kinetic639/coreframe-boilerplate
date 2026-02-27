"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import {
  OrgProfileService,
  type UpdateOrgProfileInput,
} from "@/server/services/organization.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import { ORG_READ, ORG_UPDATE } from "@/lib/constants/permissions";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).nullable().optional(),
  name_2: z.string().max(200).nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only")
    .max(100)
    .nullable()
    .optional(),
  bio: z.string().max(500).nullable().optional(),
  website: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  theme_color: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(""), z.null()]).optional(),
  font_color: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(""), z.null()]).optional(),
});

export async function getOrgProfileAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canRead = checkPermission(context.user.permissionSnapshot, ORG_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgProfileService.getProfile(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateOrgProfileAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canUpdate = checkPermission(context.user.permissionSnapshot, ORG_UPDATE);
    if (!canUpdate) return { success: false, error: "Unauthorized" };

    const parsed = updateProfileSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // Normalize empty strings to null
    const input: UpdateOrgProfileInput = {
      ...parsed.data,
      website: parsed.data.website || null,
      theme_color: parsed.data.theme_color || null,
      font_color: parsed.data.font_color || null,
    };

    return await OrgProfileService.updateProfile(supabase, context.app.activeOrgId, input);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function uploadOrgLogoAction(formData: FormData) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canUpdate = checkPermission(context.user.permissionSnapshot, ORG_UPDATE);
    if (!canUpdate) return { success: false, error: "Unauthorized" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, error: "No file provided" };
    if (file.size > 5 * 1024 * 1024) return { success: false, error: "File must be under 5 MB" };
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      return { success: false, error: "Unsupported file type" };
    }

    return await OrgProfileService.uploadLogo(supabase, context.app.activeOrgId, file);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
