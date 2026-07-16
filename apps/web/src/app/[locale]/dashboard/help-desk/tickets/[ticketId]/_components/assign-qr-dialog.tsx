"use client";

import { useEffect, useState } from "react";
import { QrCode, Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignQrToTicketAction, createAndAssignQrToTicketAction } from "@/app/actions/qr/assign";
import { QrCameraScanner, type QrScanLookup } from "@/components/features/qr/qr-camera-scanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: string;
  onAssigned: (assignment: {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function AssignQrDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  onAssigned,
}: AssignQrDialogProps) {
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setScanning(false);
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await createAndAssignQrToTicketAction({
        ticketId,
        label: label.trim() || null,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      toast.success("QR code generated and assigned to ticket.");
      onAssigned(
        (
          result as {
            success: true;
            data: {
              assignmentId: string;
              qrCodeId: string;
              token: string;
              label: string | null;
              status: string;
            };
          }
        ).data
      );
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleScannerBack = () => {
    setScannerKey((k) => k + 1); // remount scanner if user comes back
    setScanning(false);
  };

  const handleScanned = async (lookup: QrScanLookup): Promise<string | null> => {
    if (lookup.assignment) {
      if (
        lookup.assignment.target_type === "helpdesk.ticket" &&
        lookup.assignment.target_id === ticketId
      ) {
        return "This QR code is already linked to this ticket.";
      }
      return "This QR code is already assigned to something else.";
    }

    const result = await assignQrToTicketAction({ qrCodeId: lookup.id, ticketId });
    if (!result.success) {
      return (result as { success: false; error: string }).error;
    }

    toast.success("QR code assigned to ticket.");
    onAssigned({
      assignmentId: (result as { success: true; data: { id: string } }).data.id,
      qrCodeId: lookup.id,
      token: lookup.token,
      label: lookup.label,
      status: "active",
    });
    onOpenChange(false);
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>Assign QR Code to {ticketNumber}</DialogTitle>
        </DialogHeader>

        {scanning ? (
          <QrCameraScanner
            key={scannerKey}
            onScanned={handleScanned}
            onBack={handleScannerBack}
            backLabel="Generate new instead"
          />
        ) : (
          <>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-center">
                <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  A brand new QR code will be generated and assigned to this ticket.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Label (optional)
                </label>
                <Input
                  placeholder="e.g. Ticket label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>or use an existing printed label</span>
                <div className="flex-1 border-t" />
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setScanning(true)}
                disabled={generating}
              >
                <Camera className="h-4 w-4" />
                Scan QR Label with Camera
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generating ? "Generating…" : "Generate & Assign"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
