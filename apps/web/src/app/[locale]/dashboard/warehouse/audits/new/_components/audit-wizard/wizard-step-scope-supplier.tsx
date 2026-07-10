"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type { WizardLocationOption, WizardSupplierOption } from "./types";

interface WizardStepScopeSupplierProps {
  suppliers: WizardSupplierOption[];
  topLevelLocations: WizardLocationOption[];
  selectedSupplierId: string | null;
  onSelectSupplier: (id: string) => void;
  supplierLocationFilterId: string;
  onSupplierLocationFilterChange: (id: string) => void;
  includeZeroStock: boolean;
  onIncludeZeroStockChange: (value: boolean) => void;
}

export function WizardStepScopeSupplier({
  suppliers,
  topLevelLocations,
  selectedSupplierId,
  onSelectSupplier,
  supplierLocationFilterId,
  onSupplierLocationFilterChange,
  includeZeroStock,
  onIncludeZeroStockChange,
}: WizardStepScopeSupplierProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-md">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("selectSupplier")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("selectSupplierHelp")}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t("manufacturerBrand")}
        </label>
        <div className="grid grid-cols-1 gap-2">
          {suppliers.map((supplier) => {
            const isSelected = selectedSupplierId === supplier.id;
            return (
              <button
                key={supplier.id}
                type="button"
                onClick={() => onSelectSupplier(supplier.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:border-muted-foreground/30"
                )}
              >
                <span className="text-xs font-semibold text-foreground">{supplier.name}</span>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("optionalLocationFilter")}
          </label>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
            {t("optional")}
          </span>
        </div>
        <select
          value={supplierLocationFilterId}
          onChange={(event) => onSupplierLocationFilterChange(event.target.value)}
          className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">{t("checkWholeWarehouse")}</option>
          {topLevelLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} ({loc.code ?? loc.id})
            </option>
          ))}
        </select>
      </div>

      {/* Include-zero-stock toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <div className="space-y-0.5">
          <span className="block font-semibold text-foreground">{t("includeZeroStockItems")}</span>
          <span className="block text-[10px] text-muted-foreground">
            {t("includeZeroStockItemsDesc")}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={includeZeroStock}
          aria-label={t("includeZeroStockItems")}
          onClick={() => onIncludeZeroStockChange(!includeZeroStock)}
          className={cn(
            "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            includeZeroStock ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition duration-200",
              includeZeroStock ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}
