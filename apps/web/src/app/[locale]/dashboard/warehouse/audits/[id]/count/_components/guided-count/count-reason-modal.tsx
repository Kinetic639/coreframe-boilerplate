"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import { getReasonOptionsForVariance } from "@/lib/warehouse/count-reason-codes";

interface CountReasonModalProps {
  open: boolean;
  expectedQuantity: number;
  enteredQuantity: string;
  variance: number;
  reasonCode: string;
  onReasonCodeChange: (code: string) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CountReasonModal({
  open,
  expectedQuantity,
  enteredQuantity,
  variance,
  reasonCode,
  onReasonCodeChange,
  comment,
  onCommentChange,
  onCancel,
  onConfirm,
}: CountReasonModalProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const tReason = useTranslations("warehouseInventory.audits.dashboard");

  if (!open) return null;

  const options = getReasonOptionsForVariance(variance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 text-left shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-500">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {t("reasonRequiredTitle")}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("reasonRequiredDescription", {
                expected: expectedQuantity,
                entered: enteredQuantity,
              })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = reasonCode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onReasonCodeChange(opt.value)}
                className={cn(
                  "w-full cursor-pointer rounded-xl border p-3 text-left text-xs transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 font-bold text-primary shadow-sm"
                    : "border-border bg-muted/40 text-foreground hover:bg-muted"
                )}
              >
                {tReason(opt.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("commentOptional")}
          </label>
          <input
            type="text"
            placeholder={t("commentPlaceholder")}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 p-2.5 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary md:text-xs"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-border bg-muted/40 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={!reasonCode}
            onClick={onConfirm}
            className={cn(
              "flex-1 cursor-pointer rounded-lg py-2.5 text-xs font-bold transition-all",
              reasonCode
                ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                : "cursor-not-allowed border border-border bg-muted text-muted-foreground"
            )}
          >
            {t("confirmAndNext")}
          </button>
        </div>
      </div>
    </div>
  );
}
