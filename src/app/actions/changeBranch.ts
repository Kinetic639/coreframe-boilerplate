// app/actions/changeBranch.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function changeBranch(branchId: string) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Unauthorized");

  const userId = session.user.id;

  const { error } = await supabase
    .from("user_preferences")
    .update({ default_branch_id: branchId })
    .eq("user_id", userId);

  if (error) throw error;

  return { success: true };
}
