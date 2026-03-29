import { getTranslations } from "next-intl/server";
import { Warehouse } from "lucide-react";
import { WarehousePlaceholderPage } from "./_components/warehouse-placeholder-page";

export default async function WarehousePage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("title")}
      description={t("placeholder.moduleShell")}
      Icon={Warehouse}
    />
  );
}
