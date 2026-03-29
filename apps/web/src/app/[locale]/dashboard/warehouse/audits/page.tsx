import { getTranslations } from "next-intl/server";
import { ClipboardCheck } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseAuditsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.audits.title")}
      description={t("placeholder.moduleShell")}
      Icon={ClipboardCheck}
    />
  );
}
