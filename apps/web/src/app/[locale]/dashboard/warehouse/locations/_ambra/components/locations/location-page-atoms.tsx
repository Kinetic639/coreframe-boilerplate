"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Info, ShieldAlert, ShieldCheck, X } from "lucide-react";

export function CompactIndicator({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-all ${active ? "text-emerald-400" : "text-muted-foreground"}`}
    >
      {icon}
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "" : "line-through opacity-30"}`}
      >
        {label}
      </span>
    </div>
  );
}

export function MappingBadge({
  count,
  mappedLabel,
  unmappedLabel,
}: {
  count: number;
  mappedLabel: string;
  unmappedLabel: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all ${
        count > 0
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-amber-500/20 bg-amber-500/10 text-amber-500"
      }`}
    >
      {count > 0 ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      <span className="text-[9px] font-semibold uppercase tracking-wide">
        {count > 0 ? mappedLabel : unmappedLabel}
      </span>
    </div>
  );
}

export function DetailItem({
  label,
  value,
  isMono,
  isBadge,
}: {
  label: string;
  value: string | ReactNode;
  isMono?: boolean;
  isBadge?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {isBadge ? (
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            value === "Allowed" ||
            value === "Yes" ||
            value === "Stores Inventory" ||
            value === "Pickable" ||
            value === "Receivable"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {value}
        </span>
      ) : (
        <p
          className={`truncate text-foreground ${isMono ? "font-mono text-[11px] uppercase" : "text-sm font-medium"}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

export function RibbonAction({
  icon,
  onClick,
  title,
  variant,
}: {
  icon: ReactNode;
  onClick: () => void;
  title: string;
  variant?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-lg border p-2 transition-all ${
        variant === "danger"
          ? "border-red-500/20 text-red-500 hover:bg-red-500/10"
          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-primary"
      }`}
    >
      {icon}
    </button>
  );
}

export function BehaviorIndicator({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
        active
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
          : "border-border/50 bg-muted/10 text-muted-foreground opacity-40"
      }`}
    >
      <div className={`rounded-lg p-1.5 ${active ? "bg-emerald-500/20" : "bg-card"}`}>{icon}</div>
      <div className="flex flex-1 items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
        {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </div>
    </div>
  );
}

export function HealthWarning({
  severity,
  title,
  description,
}: {
  severity: "info" | "warning" | "critical";
  title: string;
  description?: string;
}) {
  const styles: Record<typeof severity, string> = {
    info: "border-primary/20 bg-primary/5 text-primary",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-500",
    critical: "border-red-500/20 bg-red-500/5 text-red-500",
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${styles[severity]}`}>
      {severity === "info" && <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      {severity === "warning" && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      {severity === "critical" && <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[9px] font-medium opacity-80">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
