import Loader from "@/components/ui/Loader";
import { createClient } from "@/utils/supabase/server";

export default async function Loading() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let logoUrl: string | null = null;
  let orgName: string | null = null;

  if (session) {
    const userId = session.user.id;

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    const orgId = preferences?.organization_id;

    if (orgId) {
      const { data: org } = await supabase
        .from("organization_profiles")
        .select("logo_url, name, name_2")
        .eq("organization_id", orgId)
        .single();

      logoUrl = org?.logo_url ?? null;
      orgName = org?.name ?? null;
      orgName2 = org?.name_2 ?? null;
      console.log("orgName2", orgName2);
    }
  }

  return <Loader logoUrl={logoUrl} orgName={orgName} orgName2={orgName2} />;
}
