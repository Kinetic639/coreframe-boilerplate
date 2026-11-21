"use client";

import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { QrAssignDialog } from "@/components/features/qr";
import {
  assignQrToLocationAction,
  createAndAssignQrToLocationAction,
} from "@/app/actions/qr/assign-location";

type AssignedQr = {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
};

type AssignQrLocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  onAssigned: (assignment: AssignedQr) => void;
};

/** A location's QR code: a new one in one click, or a scanned stuck-on label. */
export function AssignQrLocationDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  onAssigned,
}: AssignQrLocationDialogProps) {
  const t = useTranslations("ambraLocations.qr");
  const tAssign = useTranslations("modules.qr.assign");

  return (
    <QrAssignDialog
      open={open}
      onOpenChange={onOpenChange}
      objectName={locationName}
      onCreate={async () => {
        const result = await createAndAssignQrToLocationAction({
          locationId,
          label: locationName.slice(0, 200),
        });
        if (!result.success) return (result as { error: string }).error || tAssign("failed");
        toast.success(t("assignSuccess"));
        onAssigned((result as { success: true; data: AssignedQr }).data);
        return null;
      }}
      onScanned={async (lookup) => {
        const result = await assignQrToLocationAction({ qrCodeId: lookup.id, locationId });
        if (!result.success) return (result as { error: string }).error || tAssign("failed");
        toast.success(t("assignSuccess"));
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
