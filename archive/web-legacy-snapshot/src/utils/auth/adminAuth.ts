import { jwtDecode } from "jwt-decode";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export type CustomJwtPayload = {
  user_role?: string;
  roles?: {
    role: string;
    org_id: string | null;
    branch_id: string | null;
    team_id: string | null;
  }[];
} & Record<string, unknown>;

export async function checkAdminRole() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Check for admin role in JWT claims
  try {
    const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
    const userRole = jwt.user_role;

    if (userRole !== "admin") {
      // User doesn't have admin role, redirect to dashboard page
      redirect("/dashboard");
    }

    return { isAdmin: true, userRole, userId: session.user.id, userEmail: session.user.email };
  } catch (error) {
    console.error("Error decoding JWT:", error);
    redirect("/dashboard");
  }
}
