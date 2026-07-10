"use client";

import { useEffect } from "react";
import { ChevronRight, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useWizardState } from "./use-wizard-state";
import { useWizardScopePreview } from "./use-wizard-scope-preview";
import { useWizardSubmission } from "./use-wizard-submission";
import { WizardStepIndicator } from "./wizard-step-indicator";
import { WizardStepTypeBranch } from "./wizard-step-type-branch";
import { WizardStepScopeLocationTree } from "./wizard-step-scope-location-tree";
import { WizardStepScopeSupplier } from "./wizard-step-scope-supplier";
import { WizardStepProtocol, ToggleRow } from "./wizard-step-protocol";
import { WizardStepPreview } from "./wizard-step-preview";
import type { WizardLocationOption, WizardStockIndexRow, WizardSupplierOption } from "./types";

interface AuditWizardProps {
  branchId: string | null;
  locations: WizardLocationOption[];
  suppliers: WizardSupplierOption[];
  stockIndex?: WizardStockIndexRow[];
}

export function AuditWizard({ branchId, locations, suppliers, stockIndex = [] }: AuditWizardProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");
  const router = useRouter();
  const state = useWizardState(locations);
  const preview = useWizardScopePreview(state, suppliers, stockIndex);
  const { launch, isPending } = useWizardSubmission(branchId);

  // Full-bleed mobile-first screen — no dashboard-shell padding around it.
  const setFlushContent = useUiStoreV2((s) => s.setFlushContent);
  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const topLevelLocations = locations.filter((l) => !l.parent_id);
  const supplierLocationFilterLabel =
    state.supplierLocationFilterId === "all"
      ? t("allLocations")
      : (locations.find((l) => l.id === state.supplierLocationFilterId)?.name ?? t("allLocations"));

  const handleLaunch = () => {
    void launch({
      count_type: state.countType,
      location_ids: state.expandedLocationIds,
      include_children: state.includeChildren,
      supplier_id: state.selectedSupplierId ?? undefined,
      location_filter_ids:
        state.countType === "supplier" && state.supplierLocationFilterId !== "all"
          ? [state.supplierLocationFilterId]
          : [],
      include_zero_stock: state.includeZeroStock,
      show_expected_quantity: state.showExpectedQuantity,
      require_reason_for_variance: state.requireReasonForVariance,
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent">
      <WizardStepIndicator
        step={state.step}
        onBack={() => router.push("/dashboard/warehouse/audits")}
      />

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {state.step === 1 && (
          <div className="space-y-4">
            <WizardStepTypeBranch
              countType={state.countType}
              onCountTypeChange={state.setCountType}
            />
            <Button className="w-full uppercase tracking-wider" onClick={() => state.setStep(2)}>
              {t("next")}
              <ChevronRight size={14} className="ml-1.5" />
            </Button>
          </div>
        )}

        {state.step === 2 && (
          <div className="space-y-4">
            <ToggleRow
              icon={<Info size={14} className="text-primary" />}
              title={t("includeZeroStockItems")}
              description={t("includeZeroStockItemsDesc")}
              note={
                state.includeZeroStock
                  ? t("zeroStockCountBadge", { count: preview.zeroStockCount })
                  : undefined
              }
              checked={state.includeZeroStock}
              onChange={state.setIncludeZeroStock}
            />

            {state.countType === "location" ? (
              <WizardStepScopeLocationTree
                locations={locations}
                selectedLocationIds={state.selectedLocationIds}
                includeChildren={state.includeChildren}
                expandedLocationIds={state.expandedLocationIds}
                includeZeroStock={state.includeZeroStock}
                onToggleLocation={state.toggleLocation}
                onIncludeChildrenChange={state.setIncludeChildren}
                onSelectAllTop={state.selectAllTopLocations}
                onClear={state.clearLocations}
              />
            ) : (
              <WizardStepScopeSupplier
                suppliers={suppliers}
                topLevelLocations={topLevelLocations}
                selectedSupplierId={state.selectedSupplierId}
                onSelectSupplier={state.setSelectedSupplierId}
                supplierLocationFilterId={state.supplierLocationFilterId}
                onSupplierLocationFilterChange={state.setSupplierLocationFilterId}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="uppercase tracking-wider"
                onClick={() => state.setStep(1)}
              >
                {t("back")}
              </Button>
              <Button
                className="uppercase tracking-wider"
                onClick={() => {
                  if (!preview.canLaunch) {
                    if (state.countType === "location") toast.error(t("noLocationsAtLeastOne"));
                    return;
                  }
                  state.setStep(3);
                }}
              >
                {t("next")}
                <ChevronRight size={14} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-4">
            <WizardStepProtocol
              showExpectedQuantity={state.showExpectedQuantity}
              onShowExpectedQuantityChange={state.setShowExpectedQuantity}
              requireReasonForVariance={state.requireReasonForVariance}
              onRequireReasonForVarianceChange={state.setRequireReasonForVariance}
            />
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="uppercase tracking-wider"
                onClick={() => state.setStep(2)}
              >
                {t("back")}
              </Button>
              <Button className="uppercase tracking-wider" onClick={() => state.setStep(4)}>
                {t("next")}
                <ChevronRight size={14} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {state.step === 4 && (
          <div className="space-y-4">
            <WizardStepPreview
              countType={state.countType}
              locationCount={preview.locationCount}
              includeChildren={state.includeChildren}
              selectedSupplierName={preview.selectedSupplierName}
              supplierLocationFilterLabel={supplierLocationFilterLabel}
              showExpectedQuantity={state.showExpectedQuantity}
              includeZeroStock={state.includeZeroStock}
              canLaunch={preview.canLaunch}
              isPending={isPending}
              onLaunch={handleLaunch}
            />
            <Button
              variant="secondary"
              className="w-full uppercase tracking-wider"
              onClick={() => state.setStep(3)}
            >
              {t("back")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
