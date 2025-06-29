import { createClientServer } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";
import { CustomJwtPayload } from "@/utils/auth/adminAuth";

export async function getRolesServer(): Promise<
  { role: string; org_id: string | null; branch_id: string | null; team_id: string | null }[]
> {
  const supabase = await createClientServer();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    console.error("Session error:", error);
    return [];
  }

  try {
    const decoded = jwtDecode<CustomJwtPayload>(session.access_token);
    return decoded.roles || [];
  } catch (err) {
    console.error("Error decoding JWT:", err);
    return [];
  }
}
