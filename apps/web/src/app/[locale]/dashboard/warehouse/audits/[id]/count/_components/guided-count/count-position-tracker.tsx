"use client";

import { useEffect, useRef } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  MessageSquare,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import {
  COUNT_LINE_POSITION_STATUS_COLOR_CLASSES,
  getCountLinePositionStatus,
  type CountLinePositionStatus,
} from "@/lib/warehouse/count-status-colors";
import type { EnrichedCountLine } from "./types";

/** Matches the prototype's PositionStatusTracker.tsx icon choice per status
 * exactly — real sized lucide icons, not text glyphs (a glyph rendered at
 * text-sm looked inconsistent/oversized next to the icon-based header). */
function PositionIcon({ status }: { status: CountLinePositionStatus }) {
  switch (status) {
    case "counted_ok":
      return <Check size={11} className="stroke-[3]" />;
    case "surplus":
      return <Plus size={11} className="stroke-[3]" />;
    case "shortage":
      return <Minus size={11} className="stroke-[3]" />;
    case "skipped":
      return <RotateCcw size={11} className="stroke-[2.5]" />;
    case "needs_recount":
      return <RotateCcw size={11} />;
    case "not_started":
    default:
      return <span className="h-1 w-1 rounded-full bg-muted-foreground" />;
  }
}

interface CountPositionTrackerProps {
  lines: EnrichedCountLine[];
  currentIndex: number;
  showExpectedQuantity: boolean;
  onSelectIndex: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function CountPositionTracker({
  lines,
  currentIndex,
  showExpectedQuantity,
  onSelectIndex,
  onPrevious,
  onNext,
}: CountPositionTrackerProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  return (
    <div className="w-full border-b border-border bg-card">
      <div className="relative flex min-h-[80px] items-stretch px-1 pb-2">
        <button
          type="button"
          onClick={onPrevious}
          className="z-10 mr-1 w-10 shrink-0 cursor-pointer rounded-lg pb-1.5 text-primary transition-colors hover:bg-muted"
          title={t("previousPosition")}
        >
          <ChevronLeft size={28} />
        </button>

        <div
          className="flex flex-1 select-none items-center gap-3 overflow-x-auto overflow-y-hidden px-2"
          style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
        >
          {lines.map((line, index) => {
            const status = getCountLinePositionStatus(line, showExpectedQuantity);
            const config = COUNT_LINE_POSITION_STATUS_COLOR_CLASSES[status];
            const isActive = index === currentIndex;
            const hasNote = !!line.note && line.note.trim().length > 0;

            return (
              <button
                key={line.id}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onSelectIndex(index)}
                title={t("position", { index: index + 1 })}
                className={cn(
                  "relative flex h-11 w-11 shrink-0 touch-manipulation flex-col items-center justify-center rounded-lg border outline-none transition-all",
                  config.text,
                  isActive
                    ? "z-10 scale-105 border-primary bg-primary/10 shadow-lg shadow-primary/40"
                    : cn(config.bg, config.border, "hover:scale-102")
                )}
              >
                <span className="mb-0.5 font-mono text-[9px] font-bold leading-none opacity-80">
                  {index + 1}
                </span>
                <div className="flex h-4 w-4 items-center justify-center">
                  <PositionIcon status={status} />
                </div>
                {hasNote && (
                  <span
                    className="absolute -right-1 -top-1 flex h-[13px] w-[13px] items-center justify-center rounded-full border border-card bg-primary p-0.5 text-primary-foreground shadow-sm"
                    title={t("hasNote")}
                  >
                    <MessageSquare size={8} className="stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onNext}
          className="z-10 ml-1 w-10 shrink-0 cursor-pointer rounded-lg pb-1.5 text-primary transition-colors hover:bg-muted"
          title={t("nextPosition")}
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
