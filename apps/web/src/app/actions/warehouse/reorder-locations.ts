"use server";

import { createClient } from "@/utils/supabase/server";

export interface LocationReorderItem {
  id: string;
  sort_order: number;
}

export async function reorderLocations(
  branchId: string,
  locationUpdates: LocationReorderItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Validate that all locations belong to the specified branch
    const locationIds = locationUpdates.map((item) => item.id);
    const { data: existingLocations, error: validateError } = await supabase
      .from("locations")
      .select("id, branch_id, parent_id")
      .in("id", locationIds);

    if (validateError) {
      console.error("Error validating locations:", validateError);
      return { success: false, error: "Failed to validate locations" };
    }

    // Check if all locations belong to the specified branch
    const invalidLocations = existingLocations?.filter(
      (location) => location.branch_id !== branchId
    );

    if (invalidLocations && invalidLocations.length > 0) {
      return {
        success: false,
        error: "Some locations do not belong to the specified branch",
      };
    }

    // Group locations by parent_id to ensure we're only reordering siblings
    const locationsByParent = new Map<string | null, typeof existingLocations>();
    existingLocations?.forEach((location) => {
      const parentId = location.parent_id;
      if (!locationsByParent.has(parentId)) {
        locationsByParent.set(parentId, []);
      }
      locationsByParent.get(parentId)?.push(location);
    });

    // Validate that all locations being reordered have the same parent
    const parentIds = [...new Set(existingLocations?.map((loc) => loc.parent_id))];
    if (parentIds.length > 1) {
      return {
        success: false,
        error: "Cannot reorder locations with different parent locations",
      };
    }

    // Update sort order for each location
    const updatePromises = locationUpdates.map(
      (item) =>
        supabase
          .from("locations")
          .update({
            sort_order: item.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("branch_id", branchId) // Extra security check
    );

    const results = await Promise.all(updatePromises);

    // Check if any updates failed
    const failedUpdates = results.filter((result) => result.error);
    if (failedUpdates.length > 0) {
      console.error("Some location updates failed:", failedUpdates);
      return {
        success: false,
        error: "Failed to update some locations",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error reordering locations:", error);
    return {
      success: false,
      error: "An unexpected error occurred while reordering locations",
    };
  }
}
