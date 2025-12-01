"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server action to refresh branch context after creating/updating branches
 * This helps ensure the branch selector and app context are updated
 */
export async function refreshBranchContext(organizationId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Get user's current preferences
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("default_branch_id")
      .eq("user_id", userId)
      .single();

    // If user doesn't have a default branch set, set the first available branch
    if (!preferences?.default_branch_id) {
      const { data: firstBranch } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (firstBranch) {
        await supabase
          .from("user_preferences")
          .update({ default_branch_id: firstBranch.id })
          .eq("user_id", userId);
      }
    }

    // Revalidate paths that depend on branch context
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization/branches");

    return { success: true };
  } catch (error) {
    console.error("Error refreshing branch context:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
