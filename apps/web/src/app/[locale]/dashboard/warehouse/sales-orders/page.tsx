import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseSalesOrdersPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.sales.orders")}
      description={t("placeholder.moduleShell")}
      Icon={FileText}
    />
  );
}
