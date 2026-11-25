import "server-only";

import { cache } from "react";
import { getAuthUser } from "@/server/auth/get-auth-user";
import { createClient } from "@/utils/supabase/server";
import {
  DEFAULT_TIME_ZONE,
  effectiveTimeZone,
  isValidTimeZone,
  resolveTimeZone,
} from "@/lib/date-time/time-zone";

/**
 * Time zones for the current request.
 *
 * - The organization's zone (organization_profiles.timezone, set by an admin)
 *   is the default for everyone in it. Business dates ("today" in planning,
 *   end-of-day due dates) are computed in it.
 * - A user's own zone (user_preferences.timezone) overrides it for display.
 *   NULL means "same as my organization".
 *
 * Timestamps stay in UTC in the database; zones apply only when showing or
 * interpreting them.
 */

export interface TimeZoneSettings {
  /** The organization's zone (or the app default). */
  organization: string;
  /** The user's own choice, or null when they follow the organization. */
  user: string | null;
  /** What times are displayed in: user → organization → app default. */
  effective: string;
}

const DEFAULT_SETTINGS: TimeZoneSettings = {
  organization: DEFAULT_TIME_ZONE,
  user: null,
  effective: DEFAULT_TIME_ZONE,
};

/** The organization's time zone, falling back to the app default. Cached per request. */
export const getOrganizationTimeZone = cache(async (orgId: string | null): Promise<string> => {
  if (!orgId) return DEFAULT_TIME_ZONE;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("timezone")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return DEFAULT_TIME_ZONE;
  return resolveTimeZone((data as { timezone?: string | null } | null)?.timezone);
});

/**
 * The signed-in user's zones. Without a session, the app default.
 * Cached per request, so next-intl's request config and pages share one read.
 */
export const getTimeZoneSettings = cache(async (): Promise<TimeZoneSettings> => {
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return DEFAULT_SETTINGS;

  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("timezone, organization_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const userZone = isValidTimeZone(prefs?.timezone) ? (prefs.timezone as string) : null;
  const organization = await getOrganizationTimeZone(prefs?.organization_id ?? null);

  return {
    organization,
    user: userZone,
    effective: effectiveTimeZone(userZone, organization),
  };
});
