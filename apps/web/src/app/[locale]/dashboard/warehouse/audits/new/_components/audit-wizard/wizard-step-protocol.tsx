"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";

interface WizardStepProtocolProps {
  showExpectedQuantity: boolean;
  onShowExpectedQuantityChange: (value: boolean) => void;
  requireReasonForVariance: boolean;
  onRequireReasonForVarianceChange: (value: boolean) => void;
}

export function ToggleRow({
  icon,
  title,
  description,
  note,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border p-4 transition-all",
        disabled ? "border-border/50 bg-muted/10 opacity-60" : "border-border bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5 pr-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            {icon}
            {title}
          </span>
          <span className="block text-[10px] leading-relaxed text-muted-foreground">
            {description}
          </span>
          {note && (
            <span className="block text-[10px] leading-relaxed text-muted-foreground">{note}</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-5 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors",
            disabled ? "cursor-not-allowed bg-muted" : "cursor-pointer",
            !disabled && (checked ? "bg-primary" : "bg-muted")
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition duration-200",
              checked ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function WizardStepProtocol({
  showExpectedQuantity,
  onShowExpectedQuantityChange,
  requireReasonForVariance,
  onRequireReasonForVarianceChange,
}: WizardStepProtocolProps) {
  const t = useTranslations("warehouseInventory.audits.wizard");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-md">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("protocolConfigTitle")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("protocolConfigHelp")}</p>
      </div>

      <ToggleRow
        icon={
          showExpectedQuantity ? (
            <Eye size={14} className="text-primary" />
          ) : (
            <EyeOff size={14} className="text-muted-foreground" />
          )
        }
        title={t("showSystemQuantities")}
        description={
          showExpectedQuantity ? t("showSystemQuantitiesOnDesc") : t("showSystemQuantitiesOffDesc")
        }
        checked={showExpectedQuantity}
        onChange={onShowExpectedQuantityChange}
      />

      <ToggleRow
        icon={
          <AlertCircle
            size={14}
            className={showExpectedQuantity ? "text-primary" : "text-muted-foreground"}
          />
        }
        title={t("requireReason")}
        description={showExpectedQuantity ? t("requireReasonOnDesc") : t("requireReasonOffDesc")}
        checked={requireReasonForVariance}
        disabled={!showExpectedQuantity}
        onChange={onRequireReasonForVarianceChange}
      />
    </div>
  );
}
