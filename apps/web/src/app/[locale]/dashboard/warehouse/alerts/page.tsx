import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseAlertsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.alerts.title")}
      description={t("placeholder.moduleShell")}
      Icon={AlertTriangle}
    />
  );
}
