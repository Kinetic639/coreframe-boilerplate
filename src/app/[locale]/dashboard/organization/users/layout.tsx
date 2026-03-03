import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ, BRANCH_ROLES_MANAGE } from "@/lib/constants/permissions";
import { UsersLayoutClient } from "./_components/users-layout-client";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
  const canBranchManage = checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);

  if (!canRead && !canBranchManage) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const t = await getTranslations("modules.organizationManagement");

  // Org admins (MEMBERS_READ) get the tab navigation.
  // Branch managers (BRANCH_ROLES_MANAGE only) go straight to children — they can only
  // reach /branch-access; the tab nav links point to pages they cannot access.
  const content = canRead ? (
    <UsersLayoutClient>
      <Suspense>{children}</Suspense>
    </UsersLayoutClient>
  ) : (
    <Suspense>{children}</Suspense>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("items.users.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {content}
    </div>
  );
}
