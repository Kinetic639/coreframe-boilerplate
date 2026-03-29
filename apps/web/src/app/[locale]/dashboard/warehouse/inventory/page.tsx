import { getTranslations } from "next-intl/server";
import { Archive } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseInventoryPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.inventory.title")}
      description={t("placeholder.moduleShell")}
      Icon={Archive}
    />
  );
}
