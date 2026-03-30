import { getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

/**
 * /dashboard/warehouse/items — Placeholder page (Warehouse V2 skeleton).
 * Item catalog will be implemented in a later feature slice.
 */
export default async function WarehouseItemsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.products.title")}
      description={t("placeholder.moduleShell")}
      Icon={Package}
    />
  );
}
