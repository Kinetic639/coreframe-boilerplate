"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface WizardStepIndicatorProps {
  step: 1 | 2 | 3 | 4;
  onBack: () => void;
}

/**
 * Single merged header (return button + step progress) — replaces the old
 * two-row layout (title bar, then a separate "1. Typ > 2. Zakres > 3. Konfig
 * > 4. Uruchom" sub-header). Only the active step shows its full label; the
 * others collapse to just the number. No animation — a plain re-render on
 * step change reads instantly instead of a distracting reflow.
 */
export function WizardStepIndicator({ step, onBack }: WizardStepIndicatorProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");
  const steps: Array<{ n: 1 | 2 | 3 | 4; label: string }> = [
    { n: 1, label: t("stepType") },
    { n: 2, label: t("stepScope") },
    { n: 3, label: t("stepProtocol") },
    { n: 4, label: t("stepPreview") },
  ];

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/90 px-3 py-3 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-muted p-1.5 text-foreground transition-colors hover:bg-muted/70"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        {steps.map((s, idx) => {
          const isActive = s.n === step;
          return (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5">
                <span
                  className={
                    isActive
                      ? "font-mono text-sm text-primary"
                      : "font-mono text-sm text-muted-foreground"
                  }
                >
                  {s.n}.
                </span>
                {isActive && (
                  <span className="whitespace-nowrap text-sm uppercase tracking-wide text-primary">
                    {s.label}
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight size={12} className="shrink-0 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-6 shrink-0" />
    </div>
  );
}
