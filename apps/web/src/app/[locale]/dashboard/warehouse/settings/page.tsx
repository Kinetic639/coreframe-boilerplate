import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

/**
 * /dashboard/warehouse/settings — Placeholder page (Warehouse V2 skeleton).
 * Warehouse settings will be implemented in a later feature slice.
 */
export default async function WarehouseSettingsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.settings.title")}
      description={t("placeholder.moduleShell")}
      Icon={Settings}
    />
  );
}
