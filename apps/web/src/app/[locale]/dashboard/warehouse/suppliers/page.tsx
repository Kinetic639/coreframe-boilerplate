import { getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseSuppliersPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.suppliers.title")}
      description={t("placeholder.moduleShell")}
      Icon={Truck}
    />
  );
}
