"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface VarianceLeaveDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation before leaving the review screen — every change here is
 * already persisted server-side on click (no client-only draft), so there
 * is nothing to roll back; this exists purely so the counter doesn't
 * navigate away by accident mid-review. Mirrors the guided-count screen's
 * interrupt dialog for visual consistency with the rest of the audit flow. */
export function VarianceLeaveDialog({ open, onConfirm, onCancel }: VarianceLeaveDialogProps) {
  const t = useTranslations("warehouseInventory.audits.review");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-500">
          <AlertCircle size={24} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {t("leaveTitle")}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("leaveDescription")}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
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
