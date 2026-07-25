"use client";

import { useState } from "react";
import { QrCode, Camera, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createQrBatchAction } from "@/app/actions/qr/create-batch";
import { QrCameraScanner, type QrScanLookup } from "./qr-camera-scanner";

export interface StagedQrCode {
  qrCodeId: string;
  token: string;
  label: string | null;
}

interface QrCodeStagingFieldLabels {
  title?: string;
  labelPlaceholder?: string;
  generate?: string;
  generating?: string;
  scan?: string;
  remove?: string;
  scannedAlreadyAssigned?: string;
}

interface QrCodeStagingFieldProps {
  value: StagedQrCode | null;
  onChange: (value: StagedQrCode | null) => void;
  canGenerate?: boolean;
  canScan?: boolean;
  disabled?: boolean;
  labels?: QrCodeStagingFieldLabels;
}

/**
 * QR code picker for creation forms, where the parent entity doesn't exist
 * yet — stages a QR code id/token in memory (either freshly generated or an
 * existing unassigned printed label) instead of assigning it immediately.
 * The caller assigns the staged code once the entity id is known.
 */
export function QrCodeStagingField({
  value,
  onChange,
  canGenerate = true,
  canScan = true,
  disabled = false,
  labels,
}: QrCodeStagingFieldProps) {
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await createQrBatchAction({
        count: 1,
        labelPrefix: label.trim() || undefined,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      const qr = result.data[0];
      if (!qr) return;
      onChange({ qrCodeId: qr.id, token: qr.token, label: qr.label });
      setLabel("");
    } finally {
      setGenerating(false);
    }
  };

  const handleScanned = async (lookup: QrScanLookup): Promise<string | null> => {
    if (lookup.assignment) {
      return (
        labels?.scannedAlreadyAssigned ?? "This QR code is already assigned to something else."
      );
    }
    onChange({ qrCodeId: lookup.id, token: lookup.token, label: lookup.label });
    setScanning(false);
    return null;
  };

  if (value) {
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <QrCode className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.label ?? "Unlabelled"}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{value.token}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-muted-foreground transition hover:text-destructive"
            aria-label={labels?.remove ?? "Remove"}
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (scanning) {
    return <QrCameraScanner onScanned={handleScanned} onBack={() => setScanning(false)} />;
  }

  return (
    <div className="space-y-3">
      {canGenerate && (
        <div className="flex gap-2">
          <Input
            placeholder={labels?.labelPlaceholder ?? "Label (optional)"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={200}
            disabled={disabled || generating}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={handleGenerate}
            disabled={disabled || generating}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating ? (labels?.generating ?? "Generating…") : (labels?.generate ?? "Generate")}
          </Button>
        </div>
      )}
      {canScan && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setScanning(true)}
          disabled={disabled || generating}
        >
          <Camera className="h-4 w-4" />
          {labels?.scan ?? "Scan QR Label with Camera"}
        </Button>
      )}
    </div>
  );
}
