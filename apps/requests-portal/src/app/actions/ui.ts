"use server";

import { requirePortalContext } from "@/server/portal-context";
import { isColorTheme, THEME_MODES, type ThemeMode } from "@/lib/ui-theme";
import type { Json } from "@repo/supabase/database";
import { createClient } from "@/utils/supabase/server";

/**
 * Saves light/dark mode and color theme where Ambra keeps them
 * (user_preferences.dashboard_settings.ui), keeping every other setting.
 */
export async function saveUiThemeAction(input: {
  mode?: ThemeMode;
  colorTheme?: string;
}): Promise<{ ok: boolean }> {
  const ctx = await requirePortalContext();
  const patch: Record<string, string> = {};
  if (input.mode && THEME_MODES.includes(input.mode)) patch.theme = input.mode;
  if (input.colorTheme && isColorTheme(input.colorTheme)) patch.colorTheme = input.colorTheme;
  if (Object.keys(patch).length === 0) return { ok: false };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("user_preferences")
    .select("dashboard_settings")
    .eq("user_id", ctx.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !row) return { ok: false };

  const settings = (row.dashboard_settings ?? {}) as { [key: string]: Json | undefined };
  const ui = (settings.ui ?? {}) as { [key: string]: Json | undefined };
  const now = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("user_preferences")
    .update({
      dashboard_settings: { ...settings, ui: { ...ui, ...patch }, updated_at: now },
      updated_at: now,
      updated_by: ctx.user.id,
    })
    .eq("user_id", ctx.user.id)
    .is("deleted_at", null);
  return { ok: !saveError };
}
