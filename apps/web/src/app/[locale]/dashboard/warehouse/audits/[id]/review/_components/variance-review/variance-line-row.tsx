"use client";

import { useState } from "react";
import { Edit2, FileText, Save, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import { getReasonOptionsForVariance } from "@/lib/warehouse/count-reason-codes";
import type { EnrichedCountLine } from "./types";

type VarianceKind = "shortage" | "surplus" | "match" | "needsRecount" | "skipped";

interface VarianceLineRowProps {
  line: EnrichedCountLine;
  kind: VarianceKind;
  requireReasonForVariance: boolean;
  onApprove: (lineId: string) => void;
  onUnapprove: (lineId: string) => void;
  onUpdateReasonAndNote: (lineId: string, reasonCode: string | null, note: string | null) => void;
  onEnterQuantity: (lineId: string, quantity: number) => void;
}

const KIND_ACCENT: Record<VarianceKind, string> = {
  shortage: "border-l-red-500",
  surplus: "border-l-blue-500",
  match: "border-l-emerald-500",
  needsRecount: "border-l-amber-500",
  skipped: "border-l-border",
};

export function VarianceLineRow({
  line,
  kind,
  requireReasonForVariance,
  onApprove,
  onUnapprove,
  onUpdateReasonAndNote,
  onEnterQuantity,
}: VarianceLineRowProps) {
  const t = useTranslations("warehouseInventory.audits.review");
  const tReason = useTranslations("warehouseInventory.audits.dashboard");
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(
    line.counted_quantity != null ? line.counted_quantity.toString() : ""
  );

  const variance = line.variance_quantity ?? 0;
  const requiresReason = variance !== 0 && requireReasonForVariance;

  // Already-approved compact card (shortage/surplus/match kinds only).
  if (line.status === "approved") {
    return (
      <div
        className={cn(
          "space-y-1.5 rounded-lg border border-border bg-muted/20 p-2.5 text-xs",
          "border-l-4",
          KIND_ACCENT[kind]
        )}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1 pr-2">
            <div className="font-mono text-[8px] text-muted-foreground">{line.locationCode}</div>
            <div className="min-w-0">
              <div className="truncate font-mono text-[9px] font-bold uppercase tracking-wide text-primary/80">
                {line.sku}
              </div>
              <h4 className="mt-0.5 truncate text-[11px] font-bold leading-tight text-foreground">
                {line.productName}
              </h4>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 text-right">
            <div>
              <span className="block font-mono text-xs font-extrabold text-foreground">
                {line.counted_quantity} {line.unitCode}
              </span>
              <span className="block font-mono text-[9px] text-muted-foreground">
                {variance === 0 ? t("matchBadge") : variance > 0 ? `+${variance}` : `${variance}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUnapprove(line.id)}
              title={t("change")}
              className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-muted-foreground transition-all hover:bg-muted hover:text-primary"
            >
              <Edit2 size={12} />
            </button>
          </div>
        </div>
        {(line.reason_code || line.note) && (
          <div className="space-y-1 border-t border-border pt-1.5">
            {line.reason_code && (
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-amber-500">
                <Tag size={10} className="shrink-0" />
                <span>{tReason(reasonLabelKey(line.reason_code))}</span>
              </div>
            )}
            {line.note && (
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
                <FileText size={10} className="shrink-0" />
                <span>{line.note}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Needs-recount / skipped: quantity entry, no reason/approve UI yet.
  if (kind === "needsRecount" || kind === "skipped") {
    return (
      <div
        className={cn(
          "space-y-2.5 rounded-lg border border-border bg-card p-3 shadow-sm",
          "border-l-4",
          KIND_ACCENT[kind]
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-foreground">
              {line.sku}
            </span>
            <span className="mt-1.5 block text-xs font-bold leading-tight text-foreground">
              {line.productName}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide",
              kind === "needsRecount"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {kind === "needsRecount" ? t("recountTitle") : t("skippedBadge")}
          </span>
        </div>

        {kind === "needsRecount" && (
          <p className="rounded border border-border bg-muted/40 p-2 text-[10px] leading-normal text-muted-foreground">
            {t("recountDescription")}
          </p>
        )}

        <div className="flex items-center justify-between rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
          <span>
            {t("expectedShort")}:{" "}
            <strong className="font-mono text-foreground">{line.expected_quantity}</strong>
          </span>
          {editingQty ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="w-14 rounded border border-primary bg-background px-1.5 py-0.5 text-center font-mono text-xs font-bold text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const qty = qtyInput.trim() === "" ? 0 : parseInt(qtyInput, 10);
                  if (!isNaN(qty)) {
                    onEnterQuantity(line.id, qty);
                    setEditingQty(false);
                  }
                }}
                className="cursor-pointer rounded bg-primary p-1 text-primary-foreground hover:bg-primary/90"
              >
                <Save size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingQty(true)}
              className="cursor-pointer font-bold text-primary transition-colors hover:text-primary/80"
            >
              {t("enterQuantity")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Not-yet-approved shortage/surplus/match line.
  const reasonOptions = getReasonOptionsForVariance(variance);

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-lg border border-border bg-card p-3 shadow-sm",
        "border-l-4",
        KIND_ACCENT[kind]
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border pb-2 font-mono text-[10px] text-muted-foreground">
        <strong className="font-bold text-foreground">{line.locationCode}</strong>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-mono text-xs font-bold uppercase tracking-wide text-primary">
            {line.sku}
          </span>
          {line.source === "unexpected_found" && (
            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-blue-500">
              {t("unexpectedFoundBadge")}
            </span>
          )}
        </div>
        <h4 className="mt-0.5 truncate text-sm font-bold leading-snug text-foreground">
          {line.productName}
        </h4>
      </div>

      <div className="flex items-stretch justify-between gap-4 rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
        <div className="flex flex-col justify-between gap-1.5">
          <div>
            {t("expectedShort")}:{" "}
            <strong className="ml-1 font-mono font-bold text-foreground">
              {line.expected_quantity} {line.unitCode}
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t("countedShort")}:</span>
            <strong className="font-mono font-bold text-foreground">
              {line.counted_quantity ?? "--"} {line.unitCode}
            </strong>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between border-l border-border pl-3">
          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("balance")}
          </div>
          <span
            className={cn(
              "mt-1 rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
              kind === "shortage" && "border-red-500/20 bg-red-500/10 text-red-500",
              kind === "surplus" && "border-blue-500/20 bg-blue-500/10 text-blue-500",
              kind === "match" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
            )}
          >
            {variance > 0 ? `+${variance}` : `${variance}`} {line.unitCode}
          </span>
        </div>
      </div>

      {requiresReason && (
        <div className="space-y-1.5 pt-1.5">
          <label className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("reasonRequiredLabel")}
          </label>
          <select
            value={line.reason_code ?? ""}
            onChange={(e) =>
              onUpdateReasonAndNote(line.id, e.target.value || null, line.note ?? null)
            }
            className="w-full rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t("reasonSelectPlaceholder")}</option>
            {reasonOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {tReason(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("noteOptionalLabel")}
        </label>
        <input
          type="text"
          placeholder={t("notePlaceholder")}
          value={line.note ?? ""}
          onChange={(e) => onUpdateReasonAndNote(line.id, line.reason_code, e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-border pt-1">
        <button
          type="button"
          onClick={() => onApprove(line.id)}
          disabled={requiresReason && !line.reason_code}
          title={requiresReason && !line.reason_code ? t("selectReasonFirst") : undefined}
          className={cn(
            "cursor-pointer rounded border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all",
            requiresReason && !line.reason_code
              ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
              : "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          )}
        >
          {requiresReason && !line.reason_code ? t("selectReasonShort") : t("approve")}
        </button>
      </div>
    </div>
  );
}

function reasonLabelKey(code: string): string {
  const map: Record<string, string> = {
    damaged: "reasonDamaged",
    placement_error: "reasonPlacementError",
    theft: "reasonUnidentified",
    supplier_shortage: "reasonSupplierShortage",
    unexpected_surplus: "reasonUnexpectedSurplus",
  };
  return map[code] ?? "reasonDamaged";
}
