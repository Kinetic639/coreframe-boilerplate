import { createClient } from "@/lib/supabase/server";

export async function deleteUser(userId: string) {
  const supabase = await createClient();

  // First delete from user_roles table to maintain referential integrity
  const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", userId);

  if (roleError) {
    console.error("Error deleting user role:", roleError);
    throw new Error("Failed to delete user");
  }

  // Delete the user from auth schema
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Error deleting user:", error);
    throw new Error("Failed to delete user");
  }

  return true;
}
