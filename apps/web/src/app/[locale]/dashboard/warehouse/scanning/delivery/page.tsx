import { getTranslations } from "next-intl/server";
import { ScanLine } from "lucide-react";
import { WarehousePlaceholderPage } from "../../_components/warehouse-placeholder-page";

export default async function WarehouseDeliveryScanningPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.scanning.delivery")}
      description={t("placeholder.moduleShell")}
      Icon={ScanLine}
    />
  );
}
