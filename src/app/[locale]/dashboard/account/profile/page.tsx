import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ACCOUNT_PROFILE_READ } from "@/lib/constants/permissions";
import { ProfileClient } from "./_components/profile-client";

export default async function ProfilePage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, ACCOUNT_PROFILE_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const t = await getTranslations("ProfilePage");

  return (
    <ProfileClient
      translations={{
        description: t("description"),
      }}
    />
  );
}
