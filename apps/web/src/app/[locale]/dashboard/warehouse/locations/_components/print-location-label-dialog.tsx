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
  locationId: string;
  locationName: string;
  locationCode: string | null;
};

export function PrintLocationLabelDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  locationCode,
}: Props) {
  const t = useTranslations("ambraLocations.qr");
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
            {t("printDialogTitle")} — {locationName}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <LabelDesigner
            items={[{ id: locationId, primaryText: locationName }]}
            canExport
            format="pdf"
            availableFields={getLocationLabelFields(t)}
            exportEndpoint="/api/warehouse/locations/export-labels"
            idsBodyKey="locationIds"
            fileNamePrefix={`location-${locationCode ?? locationId}`}
            initialConfig={defaultConfig ?? undefined}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
