import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ACCOUNT_PROFILE_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { ProfileClient } from "./_components/profile-client";

export default async function ProfilePage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, ACCOUNT_PROFILE_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  // Generate a short-lived signed URL for the avatar server-side.
  // Never expose the bucket as public — signed URLs are the only access path.
  let avatarSignedUrl: string | null = null;
  try {
    const supabase = await createClient();
    const userId = context.user.user.id;
    const { data: userRow } = await supabase
      .from("users")
      .select("avatar_path")
      .eq("id", userId)
      .maybeSingle();

    if (userRow?.avatar_path) {
      const { data } = await supabase.storage
        .from("user-avatars")
        .createSignedUrl(userRow.avatar_path, 3600);
      avatarSignedUrl = data?.signedUrl ?? null;
    }
  } catch {
    // Non-fatal — profile renders without avatar if URL generation fails
  }

  const t = await getTranslations("ProfilePage");

  return (
    <ProfileClient
      avatarSignedUrl={avatarSignedUrl}
      translations={{
        description: t("description"),
      }}
    />
  );
}
