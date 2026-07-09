"use client";

import { CheckCircle, FileText, RotateCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";

interface CountPrimaryActionsProps {
  hasNote: boolean;
  onOpenNotes: () => void;
  onSkip: () => void;
  onSave: () => void;
  saveDisabled: boolean;
}

/** The three large thumb-target primary actions (notes / skip / save-next). */
export function CountPrimaryActions({
  hasNote,
  onOpenNotes,
  onSkip,
  onSave,
  saveDisabled,
}: CountPrimaryActionsProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={onOpenNotes}
        className={cn(
          "flex touch-manipulation cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border py-3.5 text-center text-[11px] font-bold transition-colors",
          hasNote
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
            : "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
        )}
      >
        <div className="relative">
          <FileText size={14} />
          {hasNote && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500" />
          )}
        </div>
        <span>{t("notes")}</span>
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="flex touch-manipulation cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-3.5 text-center text-[11px] font-bold text-amber-500 transition-colors hover:bg-amber-500/20"
      >
        <RotateCcw size={14} />
        <span>{t("skipAndReturn")}</span>
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={cn(
          "flex touch-manipulation cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border py-3.5 text-center text-[11px] font-bold transition-all",
          saveDisabled
            ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
            : "border-primary/30 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
        )}
      >
        <CheckCircle size={14} />
        <span>{t("saveAndNext")}</span>
      </button>
    </div>
  );
}

interface CountNotFoundActionProps {
  onMarkNotFound: () => void;
}

/** Secondary action to instantly mark the current item as physically
 * missing (counted=0, reason=damaged, note pre-filled) — mirrors the
 * prototype's handleNotFound. */
export function CountNotFoundAction({ onMarkNotFound }: CountNotFoundActionProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  return (
    <button
      type="button"
      onClick={onMarkNotFound}
      className="flex w-full touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 text-[11px] font-bold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/20"
    >
      <Search size={13} />
      <span>{t("markNotFound")}</span>
    </button>
  );
}
