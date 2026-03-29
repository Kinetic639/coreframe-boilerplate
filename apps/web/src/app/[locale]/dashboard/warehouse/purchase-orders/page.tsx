import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehousePurchaseOrdersPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.purchases.orders")}
      description={t("placeholder.moduleShell")}
      Icon={FileText}
    />
  );
}
