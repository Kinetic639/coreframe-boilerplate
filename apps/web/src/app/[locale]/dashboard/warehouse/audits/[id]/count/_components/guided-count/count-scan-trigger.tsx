"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { QrCameraScanner, extractQrToken } from "@/components/qr/qr-camera-scanner";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";
import { Button } from "@/components/ui/button";

interface CountScanTriggerProps {
  mode: "location" | "item" | null;
  currentLocationId: string;
  currentLocationCode: string;
  currentSku: string;
  onClose: () => void;
  onLocationVerified: () => void;
  onLocationMismatch: () => void;
  onItemVerified: (sku: string) => void;
}

/**
 * Real device-camera scan for verifying the current line's location or SKU.
 * Uses the shared QrCameraScanner + the existing getQrCodeByTokenAction
 * lookup (same direct decode+lookup pattern as the wizard's location-scope
 * step) — never the prototype's fake setTimeout-simulated scanner.
 */
export function CountScanTrigger({
  mode,
  currentLocationId,
  currentLocationCode,
  currentSku,
  onClose,
  onLocationVerified,
  onLocationMismatch,
  onItemVerified,
}: CountScanTriggerProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!mode) return null;

  async function handleDecode(scannedText: string) {
    if (resolving) return;
    const token = extractQrToken(scannedText);
    if (!token) return;
    setResolving(true);

    if (mode === "location") {
      const lookup = await getQrCodeByTokenAction(token);
      setResolving(false);
      if (
        lookup.success &&
        lookup.data &&
        lookup.data.assignment?.target_type === "warehouse.location" &&
        lookup.data.assignment.target_id === currentLocationId
      ) {
        setMessage(t("scanLocationVerified", { code: currentLocationCode }));
        onLocationVerified();
      } else {
        setMessage(t("scanLocationMismatch"));
        onLocationMismatch();
      }
    } else {
      setResolving(false);
      if (token === currentSku) {
        setMessage(t("scanItemVerified", { sku: currentSku }));
        onItemVerified(token);
      } else {
        setMessage(t("scanItemMismatch"));
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
            {mode === "location" ? t("scanLocation") : t("scanItem")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <QrCameraScanner onDecode={handleDecode} paused={resolving} />
          <p className="text-center text-xs text-muted-foreground">{message ?? " "}</p>
        </div>
        <div className="flex justify-end border-t border-border p-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
