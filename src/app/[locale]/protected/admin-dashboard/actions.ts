"use server";

import { updateUserRole, deleteUser } from "@/utils/admin";
import { revalidatePath } from "next/cache";
import { checkAdminRole } from "@/utils/auth/adminAuth";

// Update a user's role (admin/specialist)
export async function updateUserRoleAction(formData: FormData) {
  // Check if the current user has admin privileges
  await checkAdminRole();

  const userId = formData.get("userId") as string;
  const role = formData.get("role") as string;

  if (!userId || !role) {
    return { error: "User ID and role are required" };
  }

  try {
    await updateUserRole(userId, role);
    revalidatePath("/[locale]/protected/admin-dashboard");
    return { success: "User role updated successfully" };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { error: "Failed to update user role" };
  }
}

// Delete a user
export async function deleteUserAction(formData: FormData) {
  // Check if the current user has admin privileges
  await checkAdminRole();

  const userId = formData.get("userId") as string;

  if (!userId) {
    return { error: "User ID is required" };
  }

  try {
    await deleteUser(userId);
    revalidatePath("/[locale]/protected/admin-dashboard");
    return { success: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { error: "Failed to delete user" };
  }
}
