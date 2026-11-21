"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIMARY_FIELD_KEY, SCAN_URL_FIELD_KEY, TOKEN_FIELD_KEY } from "@/lib/qr/label-config";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

/**
 * Print (again) the label of one assigned QR code, from the object it is on
 * (ticket, task…). The code stays the same -- only the sticker is new.
 */
export function QrPrintLabelDialog({
  open,
  onOpenChange,
  qrCodeId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeId: string;
  /** The object's name (title of the dialog, text on the label). */
  name: string;
}) {
  const t = useTranslations("modules.qr");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t("assign.printTitle", { name })}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {open ? (
            <LabelDesigner
              items={[{ id: qrCodeId, primaryText: name }]}
              canExport
              format="pdf"
              availableFields={[
                { key: PRIMARY_FIELD_KEY, label: t("designer.fields.qrLabel") },
                { key: TOKEN_FIELD_KEY, label: t("designer.fields.qrToken") },
                { key: SCAN_URL_FIELD_KEY, label: t("designer.fields.scanUrl") },
              ]}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
