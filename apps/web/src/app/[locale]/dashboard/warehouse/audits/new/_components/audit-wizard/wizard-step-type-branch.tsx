"use client";

import { Layers, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type { CountSessionType } from "@/lib/warehouse/count-session-types";

interface WizardStepTypeBranchProps {
  countType: CountSessionType;
  onCountTypeChange: (type: CountSessionType) => void;
}

export function WizardStepTypeBranch({ countType, onCountTypeChange }: WizardStepTypeBranchProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-md">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("selectAuditType")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("selectAuditTypeHelp")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-2">
        <button
          type="button"
          onClick={() => onCountTypeChange("location")}
          className={cn(
            "flex touch-manipulation items-start gap-3 rounded-xl border p-4 text-left transition-all",
            countType === "location"
              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
              : "border-border bg-muted/20 hover:border-muted-foreground/30"
          )}
        >
          <div
            className={cn(
              "mt-0.5 shrink-0 rounded-lg p-2",
              countType === "location"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Layers size={16} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("typeLocationTitle")}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("typeLocationDesc")}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onCountTypeChange("supplier")}
          className={cn(
            "flex touch-manipulation items-start gap-3 rounded-xl border p-4 text-left transition-all",
            countType === "supplier"
              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
              : "border-border bg-muted/20 hover:border-muted-foreground/30"
          )}
        >
          <div
            className={cn(
              "mt-0.5 shrink-0 rounded-lg p-2",
              countType === "supplier"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <User size={16} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("typeSupplierTitle")}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("typeSupplierDesc")}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
