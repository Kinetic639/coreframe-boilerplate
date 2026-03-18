import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ToolsCatalogService, UserToolsService } from "@/server/services/tools.service";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ToolsCatalogClient } from "../_components/tools-catalog-client";

/**
 * /dashboard/tools/all — Full catalog page.
 *
 * SSR: loads catalog + user's current enabled-tools state for "enabled" badges.
 * Hands data to ToolsCatalogClient for search/filter + enable toggles.
 */
export default async function ToolsCatalogPage() {
  const t = await getTranslations("modules.tools");
  const supabase = await createClient();
  const context = await loadDashboardContextV2();

  const userId = context?.user?.user?.id ?? "";

  const [catalogResult, myToolsResult] = await Promise.all([
    ToolsCatalogService.listCatalog(supabase),
    userId
      ? UserToolsService.listUserEnabledTools(supabase, userId)
      : Promise.resolve({ success: true as const, data: [] }),
  ]);

  const catalog = catalogResult.success ? catalogResult.data : [];
  const myTools = myToolsResult.success ? myToolsResult.data : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("pages.catalog.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.catalog.subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/tools">{t("items.myTools")}</Link>
        </Button>
      </div>

      {/* Client component with SSR initial data */}
      <ToolsCatalogClient initialCatalog={catalog} initialMyTools={myTools} />
    </div>
  );
}
