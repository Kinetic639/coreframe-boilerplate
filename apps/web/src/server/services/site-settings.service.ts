import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export interface SiteSettings {
  announcementBannerEnabled: boolean;
  pricingPageEnabled: boolean;
}

const DEFAULTS: SiteSettings = {
  announcementBannerEnabled: true,
  pricingPageEnabled: true,
};

export const SiteSettingsService = {
  async getSettings(supabase: SupabaseClient<Database>): Promise<SiteSettings> {
    const { data, error } = await supabase
      .from("app_config")
      .select("announcement_banner_enabled, pricing_page_enabled")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return DEFAULTS;

    return {
      announcementBannerEnabled: data.announcement_banner_enabled,
      pricingPageEnabled: data.pricing_page_enabled,
    };
  },

  async updateSettings(
    serviceClient: SupabaseClient<Database>,
    patch: Partial<SiteSettings>
  ): Promise<{ success: true } | { success: false; error: string }> {
    const update: Database["public"]["Tables"]["app_config"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (patch.announcementBannerEnabled !== undefined) {
      update.announcement_banner_enabled = patch.announcementBannerEnabled;
    }
    if (patch.pricingPageEnabled !== undefined) {
      update.pricing_page_enabled = patch.pricingPageEnabled;
    }

    const { error } = await serviceClient.from("app_config").update(update).eq("id", 1);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
