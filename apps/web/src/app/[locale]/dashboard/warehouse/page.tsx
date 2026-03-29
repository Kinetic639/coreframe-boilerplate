import { getTranslations } from "next-intl/server";
import { Package } from "lucide-react";

/**
 * /dashboard/warehouse — Root page.
 * Renders the products placeholder. The sidebar links directly to
 * /dashboard/warehouse/products in normal navigation; this page serves
 * as the fallback for direct /dashboard/warehouse access.
 *
 * Redirect to /dashboard/warehouse/products will be wired here once
 * the typed routes file is regenerated (next dev / next build).
 */
export default async function WarehousePage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("items.products.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Package className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
      </div>
    </div>
  );
}
