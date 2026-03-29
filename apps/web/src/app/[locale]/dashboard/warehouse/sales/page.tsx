import { getTranslations } from "next-intl/server";
import { ShoppingCart } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

export default async function WarehouseSalesPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.sales.title")}
      description={t("placeholder.moduleShell")}
      Icon={ShoppingCart}
    />
  );
}
