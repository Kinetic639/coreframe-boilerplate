"use server";

import { loadUserContextServer } from "@/lib/api/load-user-context-server";

export async function debugUserContext() {
  try {
    console.log("🔍 Starting debugUserContext...");

    const userContext = await loadUserContextServer();
    console.log("🔍 UserContext result:", {
      hasUser: !!userContext?.user,
      rolesCount: userContext?.roles?.length || 0,
      permissionsCount: userContext?.permissions?.length || 0,
      permissions: userContext?.permissions || [],
    });
    return userContext;
  } catch (error) {
    console.error("❌ Error in debugUserContext:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
    };
  }
}
