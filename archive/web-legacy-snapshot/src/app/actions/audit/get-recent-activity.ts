"use server";

import type { ProjectedEvent } from "@/server/audit/types";
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GetRecentActivityResult =
  | { success: true; data: { events: ProjectedEvent[] } }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Returns a small slice of recent personal activity (up to 10 items).
 * Intended for the Recent Activity Drawer in the dashboard header.
 *
 * Delegates entirely to getPersonalActivityAction() so all security,
 * visibility, and enrichment rules are applied identically.
 */
export async function getRecentActivityAction(): Promise<GetRecentActivityResult> {
  const result = await getPersonalActivityAction(10, 0);

  if (!result.success) {
    return { success: false, error: (result as { success: false; error: string }).error };
  }

  return {
    success: true,
    data: { events: result.data.events },
  };
}
