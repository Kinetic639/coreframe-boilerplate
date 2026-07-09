"use client";

import { useState } from "react";
import { CheckSquare, QrCode, Square, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { QrCameraScanner, extractQrToken } from "@/components/qr/qr-camera-scanner";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";
import { isDescendantOf } from "@/lib/warehouse/count-session-scope";
import type { WizardLocationOption } from "./types";

interface WizardStepScopeLocationTreeProps {
  locations: WizardLocationOption[];
  selectedLocationIds: string[];
  includeChildren: boolean;
  onToggleLocation: (id: string) => void;
  onIncludeChildrenChange: (value: boolean) => void;
  onSelectAllTop: () => void;
  onClear: () => void;
}

export function WizardStepScopeLocationTree({
  locations,
  selectedLocationIds,
  includeChildren,
  onToggleLocation,
  onIncludeChildrenChange,
  onSelectAllTop,
  onClear,
}: WizardStepScopeLocationTreeProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const handleDecode = async (scannedText: string) => {
    if (resolving) return;
    const token = extractQrToken(scannedText);
    if (!token) return;

    setResolving(true);
    setScanStatus(t("scanQrResolving"));

    const lookup = await getQrCodeByTokenAction(token);
    setResolving(false);

    if (
      !lookup.success ||
      !lookup.data ||
      lookup.data.assignment?.target_type !== "warehouse.location"
    ) {
      setScanStatus(t("scanQrNotFound"));
      return;
    }

    const locationId = lookup.data.assignment.target_id;
    const location = locations.find((l) => l.id === locationId);
    if (!location) {
      setScanStatus(t("scanQrNotFound"));
      return;
    }

    if (!selectedLocationIds.includes(locationId)) {
      onToggleLocation(locationId);
    }
    setScanStatus(t("scanQrAdded", { code: location.code ?? location.name }));
    toast.success(t("scanQrAdded", { code: location.code ?? location.name }));
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-md">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("selectLocations")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("selectLocationsHelp")}</p>
      </div>

      {/* Include-children toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <div className="space-y-0.5">
          <span className="block font-semibold text-foreground">{t("includeChildren")}</span>
          <span className="block text-[10px] text-muted-foreground">
            {t("includeChildrenHelp")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onIncludeChildrenChange(!includeChildren)}
          className={cn(
            "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            includeChildren ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition duration-200",
              includeChildren ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* QR scan trigger */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/30 bg-muted/10 p-3 text-xs">
        <div className="flex-1 space-y-0.5">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <QrCode size={13} className="text-primary" />
            {t("scanQr")}
          </span>
          <span className="block text-[10px] text-muted-foreground">{t("scanQrHelp")}</span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setScannerOpen(true);
            setScanStatus(null);
          }}
        >
          <QrCode size={13} className="mr-1.5" />
          {t("scanQr")}
        </Button>
      </div>

      {/* Location list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>{t("selectedCount", { count: selectedLocationIds.length })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSelectAllTop}
              className="cursor-pointer text-primary hover:text-primary/80"
            >
              {t("selectAllTop")}
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {t("clearSelection")}
            </button>
          </div>
        </div>

        <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {locations.map((loc) => {
            const isSelected = selectedLocationIds.includes(loc.id);
            const isInherited =
              !isSelected &&
              includeChildren &&
              selectedLocationIds.some((parentId) => isDescendantOf(locations, loc.id, parentId));
            const indent = Math.min(loc.level, 4) * 16;

            return (
              <div
                key={loc.id}
                onClick={() => onToggleLocation(loc.id)}
                className="flex cursor-pointer select-none items-center gap-3 py-3 pr-4 transition-colors hover:bg-muted/40"
                style={{ paddingLeft: 12 + indent }}
              >
                {isSelected || isInherited ? (
                  <CheckSquare
                    size={20}
                    className={cn("shrink-0", isInherited ? "text-primary/40" : "text-primary")}
                  />
                ) : (
                  <Square size={20} className="shrink-0 text-muted-foreground/50" />
                )}
                <div className={cn("min-w-0 flex-1 leading-tight", isInherited && "opacity-60")}>
                  <span className="block truncate font-mono text-sm font-bold text-foreground">
                    {loc.code ?? loc.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{loc.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QR scanner modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                {t("scanQrModalTitle")}
              </span>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <QrCameraScanner onDecode={handleDecode} paused={resolving} />
              <p className="text-center text-xs text-muted-foreground">
                {scanStatus ?? t("scanQrHint")}
              </p>
            </div>
            <div className="flex justify-end border-t border-border p-4">
              <Button type="button" variant="secondary" onClick={() => setScannerOpen(false)}>
                {t("scanQrClose")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
