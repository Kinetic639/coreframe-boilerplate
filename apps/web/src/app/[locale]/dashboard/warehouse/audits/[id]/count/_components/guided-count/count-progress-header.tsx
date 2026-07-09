"use client";

import { Barcode, FilterX, FolderOpen, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EnrichedCountLine } from "./types";
import { CountPositionTracker } from "./count-position-tracker";
import type { CountProgressStats } from "./count-navigation";

interface CountProgressHeaderProps {
  overallStats: CountProgressStats;
  currentLine: EnrichedCountLine | null;
  locationFilterActive: boolean;
  onClearLocationFilter: () => void;
  onOpenLocationSheet: () => void;
  onScanLocation: () => void;
  onScanItem: () => void;
  lines: EnrichedCountLine[];
  currentIndex: number;
  showExpectedQuantity: boolean;
  onSelectIndex: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** Sticky progress + location header, ported from the prototype's fixed-top
 * bar. Structural colors converted to Ambra tokens; the progress bar itself
 * stays `bg-primary` (this app's --primary is already amber/orange). */
export function CountProgressHeader({
  overallStats,
  currentLine,
  locationFilterActive,
  onClearLocationFilter,
  onOpenLocationSheet,
  onScanLocation,
  onScanItem,
  lines,
  currentIndex,
  showExpectedQuantity,
  onSelectIndex,
  onPrevious,
  onNext,
}: CountProgressHeaderProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  return (
    <div className="sticky top-0 z-40 w-full border-b border-border bg-card shadow-sm">
      <div className="relative flex h-[18px] w-full items-center justify-center overflow-hidden border-b border-border bg-muted">
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
          style={{ width: `${overallStats.percent}%` }}
        />
        <span className="relative z-10 font-mono text-[9px] font-black uppercase tracking-widest text-foreground">
          {t("progress", {
            percent: overallStats.percent,
            counted: overallStats.counted,
            total: overallStats.total,
          })}
        </span>
      </div>

      {currentLine && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenLocationSheet}
              title={t("changeZone")}
              className="-ml-1.5 flex min-w-0 cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-muted"
            >
              <FolderOpen size={16} className="shrink-0 text-primary" />
              <span className="truncate font-mono text-sm font-black uppercase tracking-tight text-foreground">
                {currentLine.locationCode}
              </span>
              <span
                className="hidden max-w-[200px] truncate font-mono text-xs text-muted-foreground md:inline"
                title={currentLine.locationName}
              >
                ({currentLine.locationName})
              </span>
            </button>
            {locationFilterActive && (
              <button
                type="button"
                onClick={onClearLocationFilter}
                title={t("clearLocationFilter")}
                className="flex items-center justify-center rounded-lg border border-primary/30 bg-primary/10 p-1.5 text-primary transition-all hover:bg-primary/20"
              >
                <FilterX size={14} className="stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onScanLocation}
              title={t("scanLocation")}
              className="flex cursor-pointer items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <QrCode size={14} className="stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={onScanItem}
              title={t("scanItem")}
              className="flex cursor-pointer items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Barcode size={14} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      <CountPositionTracker
        lines={lines}
        currentIndex={currentIndex}
        showExpectedQuantity={showExpectedQuantity}
        onSelectIndex={onSelectIndex}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
}
