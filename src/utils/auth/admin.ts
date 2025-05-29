// This file will only contain helpers if needed. User actions are now in src/app/actions/users/.

import { createClient } from "./supabase/server";
import { User } from "@/components/admin/UsersTable";

export async function fetchUsers(): Promise<User[]> {
  try {
    // Use admin client for fetching users
    const supabase = await createClient();

    console.log("Supabase admin client created successfully");

    // Fetch users from auth.users table (requires service role key)
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .order("username", { ascending: false });

    console.error("Unexpected error in fetchUsers:", error);
    return data || [];
  } catch (error) {
    console.error("Unexpected error in fetchUsers:", error);
    return [];
  }
}

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
