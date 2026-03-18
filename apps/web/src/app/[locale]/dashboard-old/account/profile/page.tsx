import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import ProfilePageClient from "@/components/ProfilePageClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const locale = await getLocale();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/sign-in", locale });
  }

  // Fetch user profile data
  const { data: userData } = await supabase
    .from("public.users")
    .select("first_name, last_name, email, created_at, avatar_url")
    .eq("id", user.id)
    .single();

  // Fetch user roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select(
      `
      role:roles(name, scope),
      organization:organizations(name),
      branch:branches(name)
    `
    )
    .eq("user_id", user.id);

  return <ProfilePageClient user={user} userData={userData} userRoles={userRoles} />;
}
