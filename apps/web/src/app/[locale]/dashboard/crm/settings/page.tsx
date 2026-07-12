import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { CRM_READ } from "@/lib/constants/permissions";

export default async function CrmSettingsPage() {
  const locale = await getLocale();
  const t = await getTranslations("modules.crm");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, CRM_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "crm_read_required" },
      },
      locale,
    });
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{t("pages.settings.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("pages.settings.description")}
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("messages.notesLater")}
      </div>
    </div>
  );
}
