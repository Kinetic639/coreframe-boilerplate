import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

/**
 * /dashboard/warehouse/locations — Placeholder page (Warehouse V2 skeleton).
 * Location management will be implemented in a later feature slice.
 */
export default async function WarehouseLocationsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.locations")}
      description={t("placeholder.moduleShell")}
      Icon={MapPin}
    />
  );
}
