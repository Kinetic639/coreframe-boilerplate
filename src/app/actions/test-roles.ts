"use server";

import { createClient } from "@/lib/supabase/server";

// Simple test function to check roles access without complex permission logic
export async function testRolesAccess() {
  const supabase = await createClient();

  try {
    // console.log("🔍 Testing direct roles access...");

    // Test basic roles query
    const { data: roles, error } = await supabase
      .from("roles")
      .select("id, name, organization_id, is_basic")
      .is("deleted_at", null)
      .limit(5);

    if (error) {
      console.error("❌ Roles query error:", error);
      return { success: false, error: error.message, data: null };
    }

    // console.log("✅ Roles query successful:", roles);
    return { success: true, error: null, data: roles };
  } catch (err) {
    console.error("❌ Exception in testRolesAccess:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      data: null,
    };
  }
}
