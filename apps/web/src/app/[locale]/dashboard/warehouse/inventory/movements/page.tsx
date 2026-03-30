import { getTranslations } from "next-intl/server";
import { ArrowRightLeft } from "lucide-react";
import { WarehousePlaceholderPage } from "../../_components/warehouse-placeholder-page";

export default async function WarehouseInventoryMovementsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.inventory.movements")}
      description={t("placeholder.moduleShell")}
      Icon={ArrowRightLeft}
    />
  );
}
