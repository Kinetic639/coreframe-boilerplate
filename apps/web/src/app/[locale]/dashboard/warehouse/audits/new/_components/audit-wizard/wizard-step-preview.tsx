"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CountSessionType } from "@/lib/warehouse/count-session-types";

interface WizardStepPreviewProps {
  countType: CountSessionType;
  locationCount: number;
  includeChildren: boolean;
  selectedSupplierName: string | null;
  supplierLocationFilterLabel: string;
  showExpectedQuantity: boolean;
  includeZeroStock: boolean;
  canLaunch: boolean;
  isPending: boolean;
  onLaunch: () => void;
}

export function WizardStepPreview({
  countType,
  locationCount,
  includeChildren,
  selectedSupplierName,
  supplierLocationFilterLabel,
  showExpectedQuantity,
  includeZeroStock,
  canLaunch,
  isPending,
  onLaunch,
}: WizardStepPreviewProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-md">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("generatedPlanTitle")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("generatedPlanHelp")}</p>
      </div>

      <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3.5 text-xs">
        <Row label={t("method")}>
          {countType === "location" ? t("typeLocationTitle") : t("typeSupplierTitle")}
        </Row>
        <Row label={t("protocol")}>
          <span className="font-semibold text-primary">
            {showExpectedQuantity ? t("standardVisible") : t("blindHidden")}
          </span>
        </Row>
        {countType === "location" ? (
          <>
            <Row label={t("selectedZones")}>{t("zonesCount", { count: locationCount })}</Row>
            <Row label={t("includeChildrenSummary")}>{includeChildren ? t("yes") : t("no")}</Row>
          </>
        ) : (
          <>
            <Row label={t("selectedSupplier")}>{selectedSupplierName ?? "—"}</Row>
            <Row label={t("locationFilter")}>{supplierLocationFilterLabel}</Row>
          </>
        )}
        <Row label={t("zeroStock")}>{includeZeroStock ? t("included") : t("skipped")}</Row>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full uppercase tracking-wider"
        disabled={!canLaunch || isPending}
        onClick={onLaunch}
      >
        <Play size={14} className="mr-1.5" />
        {isPending ? t("launching") : t("launch")}
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold text-foreground">{children}</span>
    </div>
  );
}
