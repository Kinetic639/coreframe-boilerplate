import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";
import { SiteSettingsService, type SiteSettings } from "./site-settings.service";

export const SITE_SETTINGS_CACHE_TAG = "site-settings";

/**
 * Site settings for public pages and sign-up, shared across requests.
 *
 * The public layout read `app_config` on every render (up to a dozen reads a
 * second during a page load). The row changes only from the admin page, which
 * invalidates this tag, so a five-minute cache is a safe upper bound.
 */
export const getCachedSiteSettings: () => Promise<SiteSettings> = unstable_cache(
  async () => SiteSettingsService.getSettings(createServiceClient()),
  ["site-settings:v1"],
  { revalidate: 300, tags: [SITE_SETTINGS_CACHE_TAG] }
);
