"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface CountInterruptDialogProps {
  open: boolean;
  progressPercent: number;
  onExitWithoutSaving: () => void;
  onSaveAndExit: () => void;
  onCancel: () => void;
}

/** Confirmation dialog before leaving an incomplete session. "Exit without
 * saving" simply navigates away — this app persists each line's counted
 * quantity immediately on save (no client-only draft state to discard), so
 * there is nothing to roll back server-side, unlike the prototype's
 * in-memory initialLines restore. */
export function CountInterruptDialog({
  open,
  progressPercent,
  onExitWithoutSaving,
  onSaveAndExit,
  onCancel,
}: CountInterruptDialogProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertCircle size={24} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {t("interruptTitle")}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("interruptDescription", { percent: progressPercent })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onExitWithoutSaving}
            className="w-full cursor-pointer rounded-lg border border-destructive/40 bg-destructive/10 py-2.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"
          >
            {t("exitWithoutSaving")}
          </button>
          <button
            type="button"
            onClick={onSaveAndExit}
            className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("saveAndExit")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full cursor-pointer rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
