"use client";

import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { QrAssignDialog } from "@/components/features/qr";
import { assignQrToTicketAction, createAndAssignQrToTicketAction } from "@/app/actions/qr/assign";

interface AssignedQr {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
}

interface AssignQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: string;
  onAssigned: (assignment: AssignedQr) => void;
}

/** A ticket's QR code: a new one in one click, or a scanned stuck-on label. */
export function AssignQrDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  onAssigned,
}: AssignQrDialogProps) {
  const t = useTranslations("modules.qr.assign");

  return (
    <QrAssignDialog
      open={open}
      onOpenChange={onOpenChange}
      objectName={ticketNumber}
      onCreate={async () => {
        // The label is the ticket number: what a printed label shows.
        const result = await createAndAssignQrToTicketAction({ ticketId, label: ticketNumber });
        if (!result.success) return (result as { error: string }).error || t("failed");
        toast.success(t("assigned"));
        onAssigned((result as { success: true; data: AssignedQr }).data);
        return null;
      }}
      onScanned={async (lookup) => {
        const result = await assignQrToTicketAction({ qrCodeId: lookup.id, ticketId });
        if (!result.success) return (result as { error: string }).error || t("failed");
        toast.success(t("assigned"));
        onAssigned({
          assignmentId: (result as { success: true; data: { id: string } }).data.id,
          qrCodeId: lookup.id,
          token: lookup.token,
          label: lookup.label,
          status: "active",
        });
        return null;
      }}
    />
  );
}
