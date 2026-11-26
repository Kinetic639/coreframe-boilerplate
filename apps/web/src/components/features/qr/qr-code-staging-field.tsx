"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QrCode, Camera, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCameraScanner, type QrScanLookup } from "./qr-camera-scanner";

export interface StagedQrCode {
  qrCodeId: string;
  token: string;
  label: string | null;
  /**
   * A new code to create when the form is saved (no id or token yet). The
   * form creates and assigns it in one step once the entity exists, so an
   * abandoned form leaves no orphan code behind.
   */
  isNew?: boolean;
}

/** The staged value for "create a new code on save". */
export const NEW_STAGED_QR: StagedQrCode = { qrCodeId: "", token: "", label: null, isNew: true };

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
 * yet. Stages either "a new code" (NEW_STAGED_QR: nothing is created until
 * the form is saved, then the caller creates and assigns it in one step) or
 * an existing unassigned printed label, scanned. The caller assigns the
 * staged code once the entity id is known.
 */
export function QrCodeStagingField({
  value,
  onChange,
  canGenerate = true,
  canScan = true,
  disabled = false,
  labels,
}: QrCodeStagingFieldProps) {
  const t = useTranslations("modules.qr.assign");
  const [scanning, setScanning] = useState(false);

  const handleScanned = async (lookup: QrScanLookup): Promise<string | null> => {
    if (lookup.assignment) {
      return labels?.scannedAlreadyAssigned ?? t("alreadyAssigned");
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
            {value.isNew ? (
              <p className="truncate text-sm font-medium">{t("staged")}</p>
            ) : (
              <>
                <p className="truncate text-sm font-medium">{value.label ?? t("unlabelled")}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{value.token}</p>
              </>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 text-muted-foreground transition hover:text-destructive"
            aria-label={labels?.remove ?? t("remove")}
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
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => onChange(NEW_STAGED_QR)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
          {labels?.generate ?? t("addNew")}
        </Button>
      )}
      {canScan && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setScanning(true)}
          disabled={disabled}
        >
          <Camera className="h-4 w-4" />
          {labels?.scan ?? t("scan")}
        </Button>
      )}
    </div>
  );
}
