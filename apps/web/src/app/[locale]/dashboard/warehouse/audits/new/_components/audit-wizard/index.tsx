"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useWizardState } from "./use-wizard-state";
import { useWizardScopePreview } from "./use-wizard-scope-preview";
import { useWizardSubmission } from "./use-wizard-submission";
import { WizardStepIndicator } from "./wizard-step-indicator";
import { WizardStepTypeBranch } from "./wizard-step-type-branch";
import { WizardStepScopeLocationTree } from "./wizard-step-scope-location-tree";
import { WizardStepScopeSupplier } from "./wizard-step-scope-supplier";
import { WizardStepProtocol } from "./wizard-step-protocol";
import { WizardStepPreview } from "./wizard-step-preview";
import type { WizardLocationOption, WizardSupplierOption } from "./types";

interface AuditWizardProps {
  branchId: string | null;
  locations: WizardLocationOption[];
  suppliers: WizardSupplierOption[];
  countNumberHint: string;
}

export function AuditWizard({ branchId, locations, suppliers, countNumberHint }: AuditWizardProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");
  const router = useRouter();
  const state = useWizardState(locations);
  const preview = useWizardScopePreview(state, suppliers);
  const { launch, isPending } = useWizardSubmission(branchId);

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
    <div className="min-h-screen bg-transparent">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => router.push("/dashboard/warehouse/audits")}
          className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-primary">
            {t("stepType")}
          </span>
          <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
            {countNumberHint}
          </span>
        </div>
        <div className="w-8" />
      </div>

      <div className="mx-auto max-w-md space-y-4 py-4">
        <WizardStepIndicator step={state.step} />

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
            {state.countType === "location" ? (
              <WizardStepScopeLocationTree
                locations={locations}
                selectedLocationIds={state.selectedLocationIds}
                includeChildren={state.includeChildren}
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
              includeZeroStock={state.includeZeroStock}
              onIncludeZeroStockChange={state.setIncludeZeroStock}
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
