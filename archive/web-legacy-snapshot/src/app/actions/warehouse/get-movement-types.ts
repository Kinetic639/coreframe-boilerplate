"use server";

import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/../supabase/types/types";

type MovementType = Database["public"]["Tables"]["movement_types"]["Row"];

export async function getMovementTypes() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .order("code");

    if (error) {
      console.error("Error fetching movement types:", error);
      return {
        success: false,
        error: error.message,
        data: [] as MovementType[],
      };
    }

    return {
      success: true,
      data: data as MovementType[],
    };
  } catch (error) {
    console.error("Error in getMovementTypes:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [] as MovementType[],
    };
  }
}
