"use server";

import { createServiceClient } from "@/utils/supabase/service";

export async function testServiceRoleConnection() {
  try {
    const serviceSupabase = createServiceClient();

    // Test connection with a simple query
    const { data, error } = await serviceSupabase.from("organizations").select("id, name").limit(1);

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code,
      };
    }

    return {
      success: true,
      message: "Service role client connected successfully",
      sampleData: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
