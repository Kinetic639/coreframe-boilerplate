"use client";

import { ChevronDown, Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface CountTactileCounterProps {
  value: string;
  onChange: (value: string) => void;
  incrementStep: number;
  onIncrementStepChange: (step: number) => void;
}

const STEP_OPTIONS = [1, 5, 10, 50, 100];

/** Large tap-target counter (+/- buttons, numeric pad, quick clear/zero,
 * step-size selector) — ported near-verbatim from the prototype's tactile
 * counter, structural colors converted to tokens. */
export function CountTactileCounter({
  value,
  onChange,
  incrementStep,
  onIncrementStepChange,
}: CountTactileCounterProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  function handleIncrement(amount: number) {
    const curr = parseInt(value, 10) || 0;
    const next = Math.max(0, curr + amount);
    onChange(next.toString());
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-[280px] items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => handleIncrement(-incrementStep)}
          title={t("decreaseBy", { step: incrementStep })}
          className="flex h-14 w-14 shrink-0 touch-manipulation cursor-pointer select-none items-center justify-center rounded-full border border-border bg-muted text-foreground shadow-sm transition-colors hover:bg-muted/70"
        >
          <Minus size={24} />
        </button>

        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("quantityPlaceholder")}
          className="w-24 min-w-0 bg-transparent py-1.5 text-center font-mono text-2xl font-black text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => handleIncrement(incrementStep)}
          title={t("increaseBy", { step: incrementStep })}
          className="flex h-14 w-14 shrink-0 touch-manipulation cursor-pointer select-none items-center justify-center rounded-full border border-border bg-muted text-foreground shadow-sm transition-colors hover:bg-muted/70"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          title={t("clearEntry")}
          className="flex flex-1 touch-manipulation cursor-pointer items-center justify-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 py-2.5 text-xs font-bold text-destructive transition-all hover:bg-destructive/20"
        >
          <X size={12} className="stroke-[3]" />
          <span>{t("clear")}</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("0")}
          title={t("setToZero")}
          className="flex-1 touch-manipulation cursor-pointer rounded-md border border-border bg-muted py-2.5 text-center text-xs font-semibold text-foreground transition-all hover:bg-muted/70"
        >
          0
        </button>

        <div className="relative flex-1">
          <select
            value={incrementStep}
            onChange={(e) => onIncrementStepChange(Number(e.target.value))}
            title={t("step")}
            className="w-full cursor-pointer appearance-none rounded-md border border-border bg-muted py-2.5 pl-3 pr-8 text-xs font-bold text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {STEP_OPTIONS.map((step) => (
              <option key={step} value={step}>
                ±{step}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
