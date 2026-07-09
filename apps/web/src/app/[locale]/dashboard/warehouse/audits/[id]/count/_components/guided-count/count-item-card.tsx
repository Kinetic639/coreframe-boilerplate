"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EnrichedCountLine } from "./types";
import { CountTactileCounter } from "./count-tactile-counter";

interface CountItemCardProps {
  line: EnrichedCountLine;
  showExpectedQuantity: boolean;
  inputVal: string;
  onInputChange: (value: string) => void;
  incrementStep: number;
  onIncrementStepChange: (step: number) => void;
  liveVariance: number | null;
}

/**
 * Current-item card: SKU/name, expandable details, live variance readout,
 * tactile counter. Simplification vs. the prototype: the 3-way image
 * view-mode toggle and fullscreen image zoom are not ported (no product
 * image asset is wired into this feature) — a single compact layout is used
 * instead. Everything else (variance readout, tactile counter, details
 * expander) is preserved.
 */
export function CountItemCard({
  line,
  showExpectedQuantity,
  inputVal,
  onInputChange,
  incrementStep,
  onIncrementStepChange,
  liveVariance,
}: CountItemCardProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-md">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm font-bold uppercase tracking-wide text-primary">
              {line.sku}
            </div>
            <h2 className="mt-0.5 truncate text-lg font-bold leading-tight text-foreground">
              {line.productName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>{t("details")}</span>
            {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {t("unit")} <strong className="text-foreground">{line.unitCode}</strong>
        </div>
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
                className={`font-mono text-sm font-black ${
                  liveVariance === 0
                    ? "text-emerald-500"
                    : liveVariance > 0
                      ? "text-blue-500"
                      : "text-red-500"
                }`}
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
