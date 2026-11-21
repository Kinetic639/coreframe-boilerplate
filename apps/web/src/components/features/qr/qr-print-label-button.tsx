"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_EXPORT } from "@/lib/constants/permissions";
import type { QrLabelTargetType } from "@/lib/qr/label-templates";
import { QrPrintLabelDialog } from "./qr-print-label-dialog";

/** "Print label" for an assigned code (shown only with qr.export). */
export function QrPrintLabelButton({
  qrCodeId,
  name,
  className,
  targetType = null,
}: {
  qrCodeId: string;
  name: string;
  className?: string;
  targetType?: QrLabelTargetType | null;
}) {
  const t = useTranslations("modules.qr.assign");
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  if (!can(QR_EXPORT)) return null;

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Printer className="mr-1.5 h-3 w-3" />
        {t("print")}
      </Button>
      <QrPrintLabelDialog
        open={open}
        onOpenChange={setOpen}
        qrCodeId={qrCodeId}
        name={name}
        targetType={targetType}
      />
    </>
  );
}
