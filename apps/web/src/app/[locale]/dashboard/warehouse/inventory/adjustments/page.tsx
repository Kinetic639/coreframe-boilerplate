import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { WarehousePlaceholderPage } from "../../_components/warehouse-placeholder-page";

export default async function WarehouseInventoryAdjustmentsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.inventory.adjustments.title")}
      description={t("placeholder.moduleShell")}
      Icon={Settings}
    />
  );
}
