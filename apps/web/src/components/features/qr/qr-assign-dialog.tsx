"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCameraScanner, type QrScanLookup } from "./qr-camera-scanner";

/**
 * "Assign a QR code" for any object (location, ticket, task…). The main
 * action creates a brand new code and assigns it in one step -- nobody
 * generates codes by hand first. The other way is to scan a label that is
 * already stuck on the object (a blank one printed earlier).
 *
 * The caller does the server work: `onCreate` makes and assigns a new code,
 * `onScanned` assigns a scanned free one. Both return null on success or a
 * message to show; the dialog closes itself on success.
 */
export function QrAssignDialog({
  open,
  onOpenChange,
  objectName,
  onCreate,
  onScanned,
  canCreate = true,
  canScan = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the title, e.g. the location's name or the ticket number. */
  objectName: string;
  onCreate: () => Promise<string | null>;
  /** Assign a scanned free code; called only for codes with no assignment. */
  onScanned: (lookup: QrScanLookup) => Promise<string | null>;
  canCreate?: boolean;
  canScan?: boolean;
}) {
  const t = useTranslations("modules.qr.assign");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setError(null);
    }
  }, [open]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const message = await onCreate();
      if (message) setError(message);
      else onOpenChange(false);
    } finally {
      setCreating(false);
    }
  }

  async function scanned(lookup: QrScanLookup): Promise<string | null> {
    if (lookup.assignment) return t("alreadyAssigned");
    const message = await onScanned(lookup);
    if (!message) onOpenChange(false);
    return message;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>{t("title", { name: objectName })}</DialogTitle>
          {!scanning ? <DialogDescription>{t("description")}</DialogDescription> : null}
        </DialogHeader>

        {scanning ? (
          <QrCameraScanner
            key={scannerKey}
            onScanned={scanned}
            onBack={() => {
              setScannerKey((key) => key + 1);
              setScanning(false);
            }}
            backLabel={t("back")}
            hintLabel={t("scanHint")}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {canCreate ? (
                <Button onClick={() => void create()} disabled={creating} className="w-full gap-2">
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <QrCode className="size-4" />
                  )}
                  {creating ? t("creating") : t("create")}
                </Button>
              ) : null}
              {canScan ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setScanning(true)}
                  disabled={creating}
                >
                  <Camera className="size-4" />
                  {t("scan")}
                </Button>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                {t("cancel")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
