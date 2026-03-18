"use server";

import { createClient } from "@/utils/supabase/server";

export async function getLocations(branchId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("locations")
      .select("id, name, code, parent_location_id")
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("code");

    if (error) {
      console.error("Error fetching locations:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("Error in getLocations:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
    };
  }
}
