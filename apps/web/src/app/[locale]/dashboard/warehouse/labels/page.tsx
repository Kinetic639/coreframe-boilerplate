import { getTranslations } from "next-intl/server";
import { QrCode } from "lucide-react";

/**
 * /dashboard/warehouse/labels — Placeholder page (Warehouse V2 skeleton).
 * Labels and QR code management will be implemented in a later feature slice.
 */
export default async function WarehouseLabelsPage() {
  const t = await getTranslations("modules.warehouse");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("items.labels.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <QrCode className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
      </div>
    </div>
  );
}
