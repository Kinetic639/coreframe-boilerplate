"use client";

import { useMemo, useRef, useState } from "react";
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
  /** Final, already-expanded location ids (subtree included) — used to
   * compute the totals footer, so it reflects the actual audit scope, not
   * just the raw checkbox selection. */
  expandedLocationIds: string[];
  /** Whether the audit will include already-zero balance rows. The zero
   * count is only meaningful (and only shown) when this is on — otherwise
   * it doesn't affect what gets audited, so showing it would just be noise. */
  includeZeroStock: boolean;
  onIncludeZeroStockChange: (value: boolean) => void;
  onToggleLocation: (id: string) => void;
  onIncludeChildrenChange: (value: boolean) => void;
  onSelectAllTop: () => void;
  onClear: () => void;
}

export function WizardStepScopeLocationTree({
  locations,
  selectedLocationIds,
  includeChildren,
  expandedLocationIds,
  includeZeroStock,
  onIncludeZeroStockChange,
  onToggleLocation,
  onIncludeChildrenChange,
  onSelectAllTop,
  onClear,
}: WizardStepScopeLocationTreeProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");

  const totals = useMemo(() => {
    const expandedSet = new Set(expandedLocationIds);
    let inStockTotal = 0;
    let zeroStockTotal = 0;
    for (const loc of locations) {
      if (!expandedSet.has(loc.id)) continue;
      inStockTotal += loc.inStockCount;
      zeroStockTotal += loc.zeroStockCount;
    }
    return { inStockTotal, zeroStockTotal, combinedTotal: inStockTotal + zeroStockTotal };
  }, [locations, expandedLocationIds]);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  // The camera's decode loop runs on every animation frame and keeps firing
  // onDecode for as long as the same QR code stays in view — `resolving`
  // state alone isn't enough of a guard because the loop can queue another
  // decode before React has re-rendered with the updated state. This ref is
  // synchronous, so a second decode arriving in the same tick is dropped
  // immediately instead of racing the first one into duplicate toasts.
  const handledRef = useRef(false);

  const handleDecode = async (scannedText: string) => {
    if (handledRef.current || resolving) return;
    const token = extractQrToken(scannedText);
    if (!token) return;

    handledRef.current = true;
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
      handledRef.current = false;
      return;
    }

    const locationId = lookup.data.assignment.target_id;
    const location = locations.find((l) => l.id === locationId);
    if (!location) {
      setScanStatus(t("scanQrNotFound"));
      handledRef.current = false;
      return;
    }

    const label = location.code ?? location.name;
    const wasSelected = selectedLocationIds.includes(locationId);
    onToggleLocation(locationId);

    const message = wasSelected
      ? t("scanQrRemoved", { code: label })
      : t("scanQrAdded", { code: label });
    toast.success(message);
    // Close the scanner on any successful scan — it both stops the camera
    // (unmounting it) so it can't immediately re-decode the same still-
    // visible code, and matches a single scan = a single action = a single
    // toast, rather than leaving the loop running to double-fire on it.
    setScannerOpen(false);
    setScanStatus(null);
    handledRef.current = false;
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

      {/* Include-zero-stock toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <div className="space-y-0.5">
          <span className="block font-semibold text-foreground">{t("includeZeroStockItems")}</span>
          <span className="block text-[10px] text-muted-foreground">
            {t("includeZeroStockItemsDesc")}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={includeZeroStock}
          aria-label={t("includeZeroStockItems")}
          onClick={() => onIncludeZeroStockChange(!includeZeroStock)}
          className={cn(
            "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            includeZeroStock ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition duration-200",
              includeZeroStock ? "translate-x-5" : "translate-x-0"
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
          <span>
            {t("selectedCount", { count: selectedLocationIds.length, total: locations.length })}
          </span>
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
                <div className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[10px]">
                  <span
                    className="text-emerald-600 dark:text-emerald-400"
                    title={t("inStockCountLabel")}
                  >
                    {loc.inStockCount}
                  </span>
                  {includeZeroStock && (
                    <>
                      <span className="text-muted-foreground/40">/</span>
                      <span
                        className="text-amber-600 dark:text-amber-400"
                        title={t("zeroStockCountLabel")}
                      >
                        {loc.zeroStockCount}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span>{t("locationTotalsLabel")}</span>
          {includeZeroStock ? (
            <span>
              <span className="text-emerald-600 dark:text-emerald-400">{totals.inStockTotal}</span>
              <span className="mx-1 text-muted-foreground/40">/</span>
              <span className="text-amber-600 dark:text-amber-400">{totals.zeroStockTotal}</span>
              <span className="ml-2 font-bold text-foreground">
                {t("locationTotalsCombined", { count: totals.combinedTotal })}
              </span>
            </span>
          ) : (
            <span className="font-bold text-foreground">
              {t("locationTotalsCombined", { count: totals.inStockTotal })}
            </span>
          )}
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
