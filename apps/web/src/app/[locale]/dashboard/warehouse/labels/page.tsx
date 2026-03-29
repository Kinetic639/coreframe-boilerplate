import { getTranslations } from "next-intl/server";
import { QrCode } from "lucide-react";
import { WarehousePlaceholderPage } from "../_components/warehouse-placeholder-page";

/**
 * /dashboard/warehouse/labels — Placeholder page (Warehouse V2 skeleton).
 * Labels and QR code management will be implemented in a later feature slice.
 */
export default async function WarehouseLabelsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <WarehousePlaceholderPage
      title={t("items.labels.title")}
      description={t("placeholder.moduleShell")}
      Icon={QrCode}
    />
  );
}
