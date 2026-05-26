import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKET_TYPES_MANAGE } from "@/lib/constants/permissions";
import { getTranslations } from "next-intl/server";

export default async function HelpDeskTicketTypesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_ticket_types_manage_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.helpDesk");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pages.ticketTypes.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pages.ticketTypes.subtitle")}</p>
      </div>

      <div className="border-border bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground text-sm">{t("empty.noTicketTypes")}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t("empty.noTicketTypesDescription")}</p>
      </div>
    </div>
  );
}
