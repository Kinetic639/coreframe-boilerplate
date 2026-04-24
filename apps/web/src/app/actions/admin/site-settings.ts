"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { AdminEntitlementsService } from "@/server/services/admin-entitlements.service";
import { SiteSettingsService, type SiteSettings } from "@/server/services/site-settings.service";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const entitlements = await AdminEntitlementsService.loadAdminEntitlements(supabase, user.id);
  if (!entitlements?.enabled) throw new Error("Not authorized");
}

export async function getSiteSettingsAction(): Promise<SiteSettings> {
  await requireAdmin();
  return SiteSettingsService.getSettings(createServiceClient());
}

export async function updateSiteSettingsAction(
  patch: Partial<SiteSettings>
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAdmin();
  const result = await SiteSettingsService.updateSettings(createServiceClient(), patch);
  if (result.success) {
    revalidatePath("/", "layout");
  }
  return result;
}
