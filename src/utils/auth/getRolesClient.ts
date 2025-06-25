import { jwtDecode } from "jwt-decode";
import { CustomJwtPayload } from "@/utils/auth/adminAuth";

export async function getRolesClient(): Promise<
  { role: string; org_id: string | null; branch_id: string | null; team_id: string | null }[]
> {
  const supabase = createBrowserClient();

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
    return decoded.roles || [];
  } catch (err) {
    console.error("Error decoding JWT on client:", err);
    return [];
  }
}
