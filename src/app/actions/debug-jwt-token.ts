"use server";

import { createClient } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";

export async function debugJwtToken() {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        success: false,
        error: "No active session or access token",
      };
    }

    // Decode the JWT token to see what's inside
    let decodedToken;
    try {
      decodedToken = jwtDecode(session.access_token);
    } catch (err) {
      return {
        success: false,
        error: `Failed to decode JWT: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }

    // Test the RLS policies directly
    const { data: testQuery, error: testError } = await supabase
      .from("user_role_assignments")
      .select("id, user_id, role_id, scope, scope_id")
      .limit(1);

    return {
      success: true,
      sessionExists: !!session,
      userId: session.user.id,
      tokenPayload: decodedToken,
      testQueryResult: testQuery,
      testQueryError: testError?.message || null,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
