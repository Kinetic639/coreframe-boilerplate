import { createClient } from "@/utils/supabase/server";

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();

  // Check if user already has a role
  const { data: existingRole, error: checkError } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking user role:", checkError);
    throw new Error("Failed to check user role");
  }

  if (existingRole) {
    // Update existing role
    const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);

    if (error) {
      console.error("Error updating user role:", error);
      throw new Error("Failed to update user role");
    }
  } else {
    // Insert new role
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });

    if (error) {
      console.error("Error adding user role:", error);
      throw new Error("Failed to add user role");
    }
  }

  return true;
}
