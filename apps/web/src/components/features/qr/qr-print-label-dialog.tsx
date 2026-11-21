"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIMARY_FIELD_KEY, SCAN_URL_FIELD_KEY, TOKEN_FIELD_KEY } from "@/lib/qr/label-config";
import type { QrLabelTargetType } from "@/lib/qr/label-templates";
import { QrLabelPrintPanel } from "./qr-label-print-panel";

/**
 * Print (again) the label of one assigned QR code, from the object it is on
 * (ticket, task…). The code stays the same -- only the sticker is new. The
 * layout starts as the code's last print, else the object type's default
 * template, else the organization's.
 */
export function QrPrintLabelDialog({
  open,
  onOpenChange,
  qrCodeId,
  name,
  targetType = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeId: string;
  /** The object's name (title of the dialog, text on the label). */
  name: string;
  /** The object's type, for its label templates. */
  targetType?: QrLabelTargetType | null;
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
            <QrLabelPrintPanel
              targetType={targetType}
              qrCodeIds={[qrCodeId]}
              items={[{ id: qrCodeId, primaryText: name }]}
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
