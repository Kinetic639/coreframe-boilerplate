"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Camera, Printer, QrCode } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  assignQrToContainerAction,
  createAndAssignQrToContainerAction,
} from "@/app/actions/qr/assign-container";
import { QrCameraScanner, type QrScanLookup } from "@/components/features/qr/qr-camera-scanner";

type Props = {
  containerId: string;
  containerCode: string;
  /** The container's active QR assignment, server-loaded; null when none. */
  qrCodeId: string | null;
  canAssign: boolean;
  canPrint: boolean;
};

/**
 * Phase 10D: the container's QR identity. "Wygeneruj kod QR" creates a new
 * code and assigns it to this container in one step (server action gated on
 * qr.assign + warehouse.inventory.operate); "Drukuj etykietę" reuses the
 * generic QR label PDF route (gated on qr.export + the registry's read
 * permission), whose label text comes from the `inventory.container`
 * registry entry.
 */
export function ContainerQrCard({
  containerId,
  containerCode,
  qrCodeId,
  canAssign,
  canPrint,
}: Props) {
  const t = useTranslations("modules.warehouse.containers.qr");
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  // Pre-printed sticker flow (same contract as the ticket QR dialog): the
  // shared scanner resolves the token and rejects unknown/revoked codes; an
  // already-assigned code is refused here with a clear message. Returning a
  // string keeps the scanner open to try another sticker.
  async function handleScanned(lookup: QrScanLookup): Promise<string | null> {
    if (lookup.assignment) {
      return lookup.assignment.target_type === "inventory.container" &&
        lookup.assignment.target_id === containerId
        ? t("alreadyThis")
        : t("alreadyOther");
    }
    const result = await assignQrToContainerAction({ qrCodeId: lookup.id, containerId });
    if (!result.success) return t("assignError");
    toast.success(t("assignedToast"));
    setScanOpen(false);
    router.refresh();
    return null;
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await createAndAssignQrToContainerAction({
        containerId,
        label: containerCode,
      });
      if (!result.success) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("generated"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePrint() {
    if (!qrCodeId) return;
    setPrinting(true);
    try {
      const response = await fetch("/api/qr/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeIds: [qrCodeId], labelSize: "70x40" }),
      });
      if (!response.ok) {
        toast.error(t("printError"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t("printError"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className="bg-card border-border flex flex-col gap-3 rounded-lg border p-4"
      data-testid="container-qr-card"
    >
      <div className="flex items-center gap-2">
        <QrCode className="text-muted-foreground h-4 w-4" />
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      {qrCodeId ? (
        <>
          <p className="text-sm" data-testid="container-qr-assigned">
            {t("assigned")}
          </p>
          {canPrint && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={printing}
              className="w-full sm:w-fit"
              data-testid="container-qr-print"
            >
              <Printer className="mr-2 h-4 w-4" />
              {printing ? t("printing") : t("print")}
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm" data-testid="container-qr-none">
            {t("none")}
          </p>
          {canAssign ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => {
                  setScannerKey((k) => k + 1);
                  setScanOpen(true);
                }}
                className="w-full sm:w-fit"
                data-testid="container-qr-scan"
              >
                <Camera className="mr-2 h-4 w-4" />
                {t("scan")}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="w-full sm:w-fit"
                data-testid="container-qr-generate"
              >
                <QrCode className="mr-2 h-4 w-4" />
                {generating ? t("generating") : t("generate")}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">{t("noPermission")}</p>
          )}
        </>
      )}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>{t("scanTitle")}</DialogTitle>
          </DialogHeader>
          {scanOpen && (
            <QrCameraScanner
              key={scannerKey}
              onScanned={handleScanned}
              onBack={() => setScanOpen(false)}
              backLabel={t("scanBack")}
              hintLabel={t("scanHint")}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
