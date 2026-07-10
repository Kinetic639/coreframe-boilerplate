"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";

interface WizardStepIndicatorProps {
  step: 1 | 2 | 3 | 4;
  onBack: () => void;
}

/**
 * Single merged header (return button + step progress) — replaces the old
 * two-row layout (title bar, then a separate "1. Typ > 2. Zakres > 3. Konfig
 * > 4. Uruchom" sub-header). Only the active step shows its full label; the
 * others collapse to just the number. `layout` animation on the row lets
 * framer-motion smoothly resize/reflow the chips as the active step changes
 * instead of animating position/opacity by hand — far less jittery than a
 * manual x-slide fighting the flex layout.
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
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-card/90 px-2 py-1.5 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        {steps.map((s, idx) => {
          const isActive = s.n === step;
          return (
            <motion.div key={s.n} layout className="flex items-center gap-1.5">
              <motion.div
                layout
                className="flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5"
              >
                <span
                  className={
                    isActive
                      ? "font-mono text-sm font-black text-primary"
                      : "font-mono text-sm font-bold text-muted-foreground"
                  }
                >
                  {s.n}.
                </span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap text-sm font-black uppercase tracking-wide text-primary"
                    >
                      {s.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              {idx < steps.length - 1 && (
                <ChevronRight size={12} className="shrink-0 text-muted-foreground/40" />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="w-6 shrink-0" />
    </div>
  );
}
