import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { QrCodesService } from "@/server/services/qr.service";
import { QrManagementClient } from "./_components/qr-management-client";

export default async function QrCodesPage() {
  const t = await getTranslations("modules.qr.page");
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? "";

  const result = orgId ? await QrCodesService.listWithStatus(supabase, orgId) : null;
  const initialCodes = result?.success ? result.data : [];

  const snapshot = context?.user.permissionSnapshot ?? { allow: [], deny: [] };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <QrManagementClient initialCodes={initialCodes} permissionSnapshot={snapshot} />
    </div>
  );
}
