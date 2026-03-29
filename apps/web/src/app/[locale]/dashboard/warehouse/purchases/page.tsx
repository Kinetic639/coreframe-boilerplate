import { getTranslations } from "next-intl/server";
import { ShoppingBag } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehousePurchasesPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.purchases.title")}
      description={t("placeholder.moduleShell")}
      Icon={ShoppingBag}
    />
  );
}
