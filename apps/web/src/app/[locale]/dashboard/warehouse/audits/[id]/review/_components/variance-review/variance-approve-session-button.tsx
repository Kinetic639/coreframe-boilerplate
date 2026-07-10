"use client";

import { useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";

interface VarianceApproveSessionButtonProps {
  countNumber: string;
  blocked: boolean;
  unresolvedCount: number;
  onConfirm: () => void;
}

/** Sticky bottom post/approve action + confirmation dialog. `blocked`
 * reflects the same all-or-nothing gate the RPC enforces server-side
 * (pending lines, needs_recount lines, unapproved variances) — this is a UX
 * convenience only, not a substitute for the RPC's own authoritative check. */
export function VarianceApproveSessionButton({
  countNumber,
  blocked,
  unresolvedCount,
  onConfirm,
}: VarianceApproveSessionButtonProps) {
  const t = useTranslations("warehouseInventory.audits.review");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  function handleClick() {
    if (blocked) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <>
      {/* sticky (not fixed) so this stays within the dashboard content
       * column instead of overlapping the sidebar; safe-area padding keeps
       * it clear of the device's bottom system bar/home indicator. */}
      <div className="sticky bottom-0 z-20 w-full border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto max-w-md space-y-2">
          {showWarning && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-center font-mono text-[11px] leading-relaxed text-destructive shadow-xl">
              {t("unresolvedWarning", { count: unresolvedCount })}
            </div>
          )}
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "flex w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold uppercase tracking-wider transition-all",
              blocked
                ? "border border-border bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
            )}
          >
            <CheckCircle2 size={16} />
            <span>{t("postAndApprove")}</span>
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 text-left shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Info size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {t("postConfirmTitle")}
                </h3>
                <p className="text-[11px] text-muted-foreground">{t("postConfirmDescription")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3.5 text-xs leading-relaxed text-foreground/90">
              {t("postConfirmBody", { number: countNumber })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 cursor-pointer rounded-lg border border-border bg-muted/40 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  onConfirm();
                }}
                className="flex-1 cursor-pointer rounded-lg bg-primary py-2.5 text-center text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-md transition-all hover:bg-primary/90"
              >
                {t("confirmAndPost")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
