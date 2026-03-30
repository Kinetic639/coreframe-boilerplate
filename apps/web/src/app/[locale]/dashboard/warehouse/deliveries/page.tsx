import { getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

/**
 * /dashboard/warehouse/deliveries — Placeholder page (Warehouse V2 skeleton).
 * Delivery intake will be implemented in a later feature slice.
 */
export default async function WarehouseDeliveriesPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.deliveries.title")}
      description={t("placeholder.moduleShell")}
      Icon={Inbox}
    />
  );
}
