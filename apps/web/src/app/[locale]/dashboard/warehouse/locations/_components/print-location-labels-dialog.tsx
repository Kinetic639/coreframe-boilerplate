"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLocationLabelSettingsAction } from "@/app/actions/warehouse/location-label-settings";
import type { LabelConfig } from "@/lib/qr/label-config";
import { getLocationLabelFields } from "../_lib/label-fields";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

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
  const [defaultConfig, setDefaultConfig] = useState<LabelConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    getLocationLabelSettingsAction().then((result) => {
      if (result.success) setDefaultConfig((result.data as LabelConfig | null) ?? null);
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {t("printDialogTitle")} ({locationIds.length})
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <LabelDesigner
            items={locationIds.map((id) => ({
              id,
              primaryText: locationsById.get(id)?.name ?? id,
            }))}
            canExport
            format="pdf"
            availableFields={getLocationLabelFields(tQr)}
            exportEndpoint="/api/warehouse/locations/export-labels"
            idsBodyKey="locationIds"
            fileNamePrefix="location-labels"
            initialConfig={defaultConfig ?? undefined}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
