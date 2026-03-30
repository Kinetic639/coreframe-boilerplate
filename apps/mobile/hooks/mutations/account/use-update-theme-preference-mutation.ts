import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { updateThemePreference } from "@/lib/mutations/account/update-theme-preference";
import { accountProfileQueryKey } from "@/hooks/queries/account/use-account-profile-query";

// ─── Input type ───────────────────────────────────────────────────────────────

export interface UpdateThemeInput {
  theme: "light" | "dark" | "system";
  currentDashboardSettings: Record<string, unknown> | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * TanStack Query mutation hook for persisting the user's theme preference.
 *
 * The theme tile on the account index screen calls this immediately on tap
 * (no separate Save button). The mutation is optimistic from a UX perspective —
 * the tile selection updates instantly in local state; the DB write happens
 * in the background.
 *
 * On success: invalidates the account profile query so rawDashboardSettings
 * stays in sync with the DB for future theme mutations.
 *
 * currentDashboardSettings is passed from AccountProfile.rawDashboardSettings
 * (already in query cache) to avoid a redundant read before the upsert.
 */
export function useUpdateThemePreferenceMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ theme, currentDashboardSettings }: UpdateThemeInput) =>
      updateThemePreference(mobileSupabase, userId, theme, currentDashboardSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountProfileQueryKey(userId) });
    },
  });
}
