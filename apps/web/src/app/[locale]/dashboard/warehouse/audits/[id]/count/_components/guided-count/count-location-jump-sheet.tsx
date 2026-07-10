"use client";

import { Check, FilterX, MapPin, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type { EnrichedCountLine } from "./types";

interface LocationSummary {
  id: string;
  code: string;
  name: string;
}

interface CountLocationJumpSheetProps {
  open: boolean;
  locations: LocationSummary[];
  allLines: EnrichedCountLine[];
  activeLocationId: string | null;
  onSelectLocation: (locationId: string) => void;
  onClearFilter: () => void;
  onOpenScanner: () => void;
  onClose: () => void;
}

/** Full-screen location list for jumping/filtering the count walk-through,
 * ported from the prototype's bottom-sheet drawer. */
export function CountLocationJumpSheet({
  open,
  locations,
  allLines,
  activeLocationId,
  onSelectLocation,
  onClearFilter,
  onOpenScanner,
  onClose,
}: CountLocationJumpSheetProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card p-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin size={16} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-foreground">
            {t("locationsSheetTitle")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {activeLocationId && (
            <button
              type="button"
              onClick={onClearFilter}
              title={t("clearLocationFilter")}
              className="cursor-pointer rounded-lg border border-primary/30 bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20"
            >
              <FilterX size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenScanner}
            title={t("scanLocation")}
            className="flex cursor-pointer items-center justify-center rounded-lg bg-primary p-1.5 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <QrCode size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-1 text-xs font-bold uppercase text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("close")}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        <p className="mb-3 px-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("locationsSheetHelp")}
        </p>

        {locations.map((loc) => {
          const locLines = allLines.filter((l) => l.location_id === loc.id);
          const total = locLines.length;
          const resolved = locLines.filter(
            (l) => l.status === "counted" || l.status === "approved" || l.status === "skipped"
          ).length;
          const isCurrent = activeLocationId === loc.id;

          return (
            <button
              key={loc.id}
              type="button"
              disabled={total === 0}
              onClick={() => total > 0 && onSelectLocation(loc.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border py-2 pl-2 pr-3 text-left transition-all",
                total === 0
                  ? "cursor-not-allowed border-transparent opacity-50"
                  : isCurrent
                    ? "cursor-pointer border-primary bg-primary/10 shadow-sm"
                    : "cursor-pointer border-border bg-muted/30 hover:border-muted-foreground/40"
              )}
            >
              <div className="min-w-0 pr-2">
                <span className="block truncate font-mono text-sm font-bold text-foreground">
                  {loc.code}
                </span>
                <span className="block truncate text-[11px] font-normal text-muted-foreground">
                  {loc.name}
                </span>
              </div>
              {total > 0 &&
                (resolved === total ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-emerald-600/50 bg-emerald-500/10 text-emerald-500 shadow-sm">
                    <Check size={14} className="stroke-[3]" />
                  </div>
                ) : (
                  <span className="shrink-0 font-mono text-sm font-bold text-foreground">
                    {resolved}
                    <span className="text-muted-foreground">/{total}</span>
                  </span>
                ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
