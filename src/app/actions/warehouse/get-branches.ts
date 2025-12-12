"use server";

import { createClient } from "@/utils/supabase/server";

export async function getBranches(organizationId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("branches")
      .select("id, name, code, address")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Error fetching branches:", error);
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
    console.error("Error in getBranches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
    };
  }
}
