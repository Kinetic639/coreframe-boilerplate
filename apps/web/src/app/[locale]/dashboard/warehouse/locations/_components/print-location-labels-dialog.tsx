"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrLabelPrintPanel } from "@/components/features/qr/qr-label-print-panel";
import { getLocationLabelFields } from "../_lib/label-fields";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationIds: string[];
  locationsById: Map<string, { name: string }>;
};

export function PrintLocationLabelsDialog({
  open,
  onOpenChange,
  locationIds,
  locationsById,
}: Props) {
  const t = useTranslations("warehouseLocations.listView");
  const tQr = useTranslations("ambraLocations.qr");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {t("printDialogTitle")} ({locationIds.length})
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {open ? (
            <QrLabelPrintPanel
              targetType="warehouse.location"
              targetIds={locationIds}
              items={locationIds.map((id) => ({
                id,
                primaryText: locationsById.get(id)?.name ?? id,
              }))}
              availableFields={getLocationLabelFields(tQr)}
              exportEndpoint="/api/warehouse/locations/export-labels"
              idsBodyKey="locationIds"
              fileNamePrefix="location-labels"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
