import { jwtDecode } from "jwt-decode";
import { CustomJwtPayload } from "@/lib/api/load-user-context-server";
import { createClient } from "@/lib/supabase/client";

export async function getRolesClient(): Promise<
  { role: string; org_id: string | null; branch_id: string | null; team_id: string | null }[]
> {
  const supabase = createClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    console.error("Client session error:", error);
    return [];
  }

  try {
    const decoded = jwtDecode<CustomJwtPayload>(session.access_token);
    return (decoded.roles || []).map((role) => ({
      role: role.role,
      org_id: role.org_id,
      branch_id: role.branch_id,
      team_id: null,
    }));
  } catch (err) {
    console.error("Error decoding JWT on client:", err);
    return [];
  }
}
