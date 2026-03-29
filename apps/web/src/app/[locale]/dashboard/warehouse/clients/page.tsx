import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseClientsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.sales.clients")}
      description={t("placeholder.moduleShell")}
      Icon={Users}
    />
  );
}
