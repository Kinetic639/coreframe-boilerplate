"use server";

import type { ProjectedEvent } from "@/server/audit/types";
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GetLatestActivityResult =
  | { success: true; data: { event: ProjectedEvent | null } }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Returns only the single most recent personal activity event.
 * Intended for the compact status-bar preview — minimises unnecessary data.
 *
 * Delegates entirely to getPersonalActivityAction() so all security,
 * visibility, and enrichment rules are applied identically.
 */
export async function getLatestActivityAction(): Promise<GetLatestActivityResult> {
  const result = await getPersonalActivityAction(1, 0);

  if (!result.success) {
    return { success: false, error: (result as { success: false; error: string }).error };
  }

  return {
    success: true,
    data: { event: result.data.events[0] ?? null },
  };
}
