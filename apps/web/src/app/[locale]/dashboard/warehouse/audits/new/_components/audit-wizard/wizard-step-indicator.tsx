"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export function WizardStepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const t = useTranslations("warehouseInventory.audits.wizard");
  const steps: Array<{ n: 1 | 2 | 3 | 4; label: string }> = [
    { n: 1, label: t("stepType") },
    { n: 2, label: t("stepScope") },
    { n: 3, label: t("stepProtocol") },
    { n: 4, label: t("stepPreview") },
  ];

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shadow-md">
      {steps.map((s, idx) => (
        <div key={s.n} className="flex items-center gap-2">
          <span className={step >= s.n ? "font-black text-primary" : ""}>{s.label}</span>
          {idx < steps.length - 1 && (
            <ChevronRight size={12} className="text-muted-foreground/40" />
          )}
        </div>
      ))}
    </div>
  );
}
