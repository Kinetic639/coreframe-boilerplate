"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Tag } from "lucide-react";
import { saveLocationLabelSettingsAction } from "@/app/actions/warehouse/location-label-settings";
import type { LabelConfig } from "@/lib/qr/label-config";
import { getLocationLabelFields } from "@/app/[locale]/dashboard/warehouse/ambra-locations/_lib/label-fields";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

type Props = {
  initialConfig: LabelConfig | null;
  canManage: boolean;
};

export function LocationLabelDefaultsSettings({ initialConfig, canManage }: Props) {
  const t = useTranslations("warehouseLocations.labelSettings");
  const tQr = useTranslations("ambraLocations.qr");

  async function handleSaveTemplate(config: LabelConfig) {
    const result = await saveLocationLabelSettingsAction(config);
    if (!result.success) {
      toast.error((result as { success: false; error: string }).error || t("saveFailed"));
      return;
    }
    toast.success(t("saveSuccess"));
  }

  return (
    <section className="grid gap-4 rounded-md border border-border p-4">
      <header className="flex items-start gap-3">
        <Tag className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </header>

      <div className="h-[720px] min-h-0">
        <LabelDesigner
          items={[]}
          canExport={canManage}
          format="pdf"
          availableFields={getLocationLabelFields(tQr)}
          mode="template-editor"
          initialConfig={initialConfig ?? undefined}
          onSaveTemplate={handleSaveTemplate}
        />
      </div>
    </section>
  );
}
