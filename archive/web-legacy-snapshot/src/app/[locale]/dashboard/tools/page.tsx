import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ToolsCatalogService, UserToolsService } from "@/server/services/tools.service";
import { ToolsUnifiedClient } from "./_components/tools-unified-client";

/**
 * /dashboard/tools — Unified tools page with My Tools / All Tools tabs.
 *
 * SSR: loads catalog + user's enabled tools, passes both as initial data.
 */
export default async function ToolsPage() {
  const t = await getTranslations("modules.tools");
  const supabase = await createClient();
  const context = await loadDashboardContextV2();

  const userId = context?.user?.user?.id ?? "";

  const [myToolsResult, catalogResult] = await Promise.all([
    userId
      ? UserToolsService.listUserEnabledTools(supabase, userId)
      : Promise.resolve({ success: true as const, data: [] }),
    ToolsCatalogService.listCatalog(supabase),
  ]);

  const myTools = myToolsResult.success ? myToolsResult.data : [];
  const catalog = catalogResult.success ? catalogResult.data : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ToolsUnifiedClient initialMyTools={myTools} initialCatalog={catalog} />
    </div>
  );
}
