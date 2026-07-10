"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ImageOff, LayoutGrid, LayoutList, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type { EnrichedCountLine } from "./types";
import { CountTactileCounter } from "./count-tactile-counter";

export type CountItemViewMode = "standard" | "compact" | "no-image";

interface CountItemCardProps {
  line: EnrichedCountLine;
  showExpectedQuantity: boolean;
  inputVal: string;
  onInputChange: (value: string) => void;
  incrementStep: number;
  onIncrementStepChange: (step: number) => void;
  liveVariance: number | null;
  viewMode: CountItemViewMode;
  onViewModeChange: (mode: CountItemViewMode) => void;
}

const VIEW_MODE_CYCLE: Record<CountItemViewMode, CountItemViewMode> = {
  standard: "compact",
  compact: "no-image",
  "no-image": "standard",
};

/**
 * Current-item card, ported closely from the prototype's GuidedCountScreen
 * item card: 3-way view toggle (standard/compact/no-image), SKU/name,
 * expandable details, live variance readout, tactile counter. No product
 * image asset is wired into this feature yet (no image data source
 * exists anywhere in the codebase — CLAUDE.md's product_images table is
 * unimplemented), so the "image" slot always renders the same
 * add-photo placeholder the prototype itself shows for any item without
 * an image — there is no fullscreen zoom since there is never a real
 * image to zoom into.
 */
export function CountItemCard({
  line,
  showExpectedQuantity,
  inputVal,
  onInputChange,
  incrementStep,
  onIncrementStepChange,
  liveVariance,
  viewMode,
  onViewModeChange,
}: CountItemCardProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const ViewModeIcon =
    viewMode === "standard" ? LayoutGrid : viewMode === "compact" ? LayoutList : ImageOff;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-md">
      <div className="relative flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onViewModeChange(VIEW_MODE_CYCLE[viewMode])}
          title={t("changeItemView")}
          className="absolute right-0 top-0 z-10 flex select-none items-center rounded-md border border-border bg-muted/90 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ViewModeIcon size={15} className="text-primary" />
        </button>

        {viewMode === "standard" ? (
          <>
            <div className="relative mx-auto flex h-36 w-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              <button
                type="button"
                disabled
                title={t("addPhotoUnavailable")}
                className="flex h-full w-full cursor-not-allowed flex-col items-center justify-center gap-2 text-muted-foreground/70"
              >
                <div className="rounded-full border border-border bg-card p-2">
                  <Plus size={18} />
                </div>
                <span className="px-2 text-center text-[9px] font-bold uppercase tracking-wider">
                  {t("addPhoto")}
                </span>
              </button>
            </div>
            <div className="mt-2 space-y-1 border-b border-border pb-4 text-center">
              <div className="truncate font-mono text-sm font-bold uppercase tracking-wide text-primary">
                {line.sku}
              </div>
              <h2 className="text-xl font-bold leading-snug text-foreground">{line.productName}</h2>
              <div className="flex items-center justify-between pt-3">
                <div className="font-mono text-[11px] text-muted-foreground">
                  {t("unit")} <strong className="text-foreground">{line.unitCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{t("details")}</span>
                  {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
          </>
        ) : viewMode === "compact" ? (
          <div className="flex flex-col gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                <button
                  type="button"
                  disabled
                  title={t("addPhotoUnavailable")}
                  className="flex h-full w-full cursor-not-allowed flex-col items-center justify-center gap-1 text-muted-foreground/70"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="min-w-0 flex-1 pr-16">
                <div className="truncate text-left font-mono text-sm font-bold uppercase tracking-wide text-primary">
                  {line.sku}
                </div>
                <h2 className="mt-0.5 truncate text-left text-lg font-bold leading-tight text-foreground">
                  {line.productName}
                </h2>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-muted-foreground">
                {t("unit")} <strong className="text-foreground">{line.unitCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{t("details")}</span>
                {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-b border-border pb-4">
            <div className="min-w-0 pr-16">
              <div className="truncate text-left font-mono text-sm font-bold uppercase tracking-wide text-primary">
                {line.sku}
              </div>
              <h2 className="mt-0.5 truncate text-left text-lg font-bold leading-tight text-foreground">
                {line.productName}
              </h2>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-muted-foreground">
                {t("unit")} <strong className="text-foreground">{line.unitCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{t("details")}</span>
                {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {detailsOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px]">
          <div>
            <span className="mb-0.5 block text-muted-foreground">{t("locationLabel")}</span>
            <span className="font-bold text-foreground">{line.locationName}</span>
          </div>
          <div>
            <span className="mb-0.5 block text-muted-foreground">{t("expected")}</span>
            <span className="font-bold text-foreground">
              {line.expected_quantity} {line.unitCode}
            </span>
          </div>
        </div>
      )}

      {showExpectedQuantity && (
        <div className="mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("difference")}
            </span>
            {liveVariance !== null ? (
              <span
                className={cn(
                  "font-mono text-sm font-black",
                  liveVariance === 0
                    ? "text-emerald-500"
                    : liveVariance > 0
                      ? "text-blue-500"
                      : "text-red-500"
                )}
              >
                {liveVariance === 0
                  ? "0"
                  : liveVariance > 0
                    ? `+${liveVariance}`
                    : `${liveVariance}`}
              </span>
            ) : (
              <span className="font-mono text-sm font-black text-muted-foreground">-</span>
            )}
          </div>
          <div className="select-none font-mono text-border">|</div>
          <button
            type="button"
            onClick={() => onInputChange(line.expected_quantity.toString())}
            className="group flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary/80">
              {t("expected")}
            </span>
            <span className="font-mono text-sm font-black text-foreground group-hover:text-primary">
              {line.expected_quantity} {line.unitCode}
            </span>
          </button>
        </div>
      )}

      <CountTactileCounter
        value={inputVal}
        onChange={onInputChange}
        incrementStep={incrementStep}
        onIncrementStepChange={onIncrementStepChange}
      />
    </div>
  );
}
