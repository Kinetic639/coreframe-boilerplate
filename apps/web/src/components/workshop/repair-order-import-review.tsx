"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { AlertTriangle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  applyRepairOrderImportAction,
  previewRepairOrderImportAction,
} from "@/app/actions/workshop/import";
import type {
  RepairOrderImportPreview,
  RepairOrderImportPreviewOrder,
  RepairOrderImportResult,
} from "@/server/services/repair-order-import.service";

type Props = {
  sourceType: string;
  sourceInput: Record<string, unknown>;
  canApply: boolean;
  /** Called after a successful import (and on a preview with nothing to do). */
  onApplied?: (result: RepairOrderImportResult) => void;
  /** Reports the preview so a host (e.g. the PZ import) can react to it. */
  onPreview?: (preview: RepairOrderImportPreview | null) => void;
  compact?: boolean;
  /**
   * "import" (Workshop): pick which orders to create/update.
   * "receipt" (PZ import): every order is a checkbox -- unchecking one also
   * keeps its parts out of the PZ (reported through onSelectionChange).
   */
  mode?: "import" | "receipt";
  /** ZL numbers the user unchecked (receipt mode: exclude from the PZ). */
  onSelectionChange?: (excludedZlNumbers: string[]) => void;
};

function lineSummary(order: RepairOrderImportPreviewOrder) {
  const count = (state: string) => order.lines.filter((l) => l.state === state).length;
  return {
    added: count("new"),
    adds: count("adds_quantity"),
    present: count("on_order") + count("already_imported"),
  };
}

/**
 * Verifies the repair orders a source describes against the branch --
 * existing, new, or in conflict (closed/archived, no ZL) -- and imports the
 * selected ones. Shared by the Workshop import page and the PZ import.
 */
export function RepairOrderImportReview({
  sourceType,
  sourceInput,
  canApply,
  onApplied,
  onPreview,
  compact = false,
  mode = "import",
  onSelectionChange,
}: Props) {
  const t = useTranslations("modules.workshop.repairOrders.import");
  const [preview, setPreview] = useState<RepairOrderImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const inputKey = JSON.stringify(sourceInput);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onSelectionRef = useRef(onSelectionChange);
  onSelectionRef.current = onSelectionChange;
  const initialized = useRef(false);

  const selectable = useMemo(
    () => (order: RepairOrderImportPreviewOrder) =>
      !!order.zlNumber && (mode === "receipt" || (order.willChange && canApply)),
    [mode, canApply]
  );

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      const result = await previewRepairOrderImportAction({
        source_type: sourceType,
        source_input: JSON.parse(inputKey),
      });
      setLoading(false);
      if (!result.success) {
        const code = (result as { error: string }).error;
        setError(code);
        setPreview(null);
        onPreviewRef.current?.(null);
        return;
      }
      setPreview(result.data);
      const pickable = result.data.orders.filter(selectable).map((o) => o.zlNumber!);
      // First load selects everything; a reload (after importing) keeps the
      // user's choices instead of re-checking what they unchecked.
      // Read the flag now: the updater runs later, after it is set.
      const reload = initialized.current;
      initialized.current = true;
      setSelected((current) =>
        reload ? new Set(pickable.filter((zl) => current.has(zl))) : new Set(pickable)
      );
      onPreviewRef.current?.(result.data);
    },
    [sourceType, inputKey, selectable]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (zl: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(zl);
      else next.delete(zl);
      return next;
    });

  useEffect(() => {
    if (!preview) return;
    onSelectionRef.current?.(
      preview.orders
        .filter((o) => selectable(o) && !selected.has(o.zlNumber!))
        .map((o) => o.zlNumber!)
    );
  }, [preview, selected, selectable]);

  const toApply = preview
    ? preview.orders.filter((o) => o.willChange && o.zlNumber && selected.has(o.zlNumber))
    : [];
  const pickableZls = preview ? preview.orders.filter(selectable).map((o) => o.zlNumber!) : [];
  const allSelected = pickableZls.length > 0 && pickableZls.every((zl) => selected.has(zl));

  const apply = () => {
    if (toApply.length === 0) return;
    startTransition(async () => {
      const result = await applyRepairOrderImportAction({
        source_type: sourceType,
        source_input: JSON.parse(inputKey),
        zl_numbers: toApply.map((o) => o.zlNumber!),
      });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.unexpected"));
        return;
      }
      toast.success(t("applied", { created: result.data.created, updated: result.data.updated }));
      onApplied?.(result.data);
      await load();
    });
  };

  if (loading && !preview) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-sm" data-testid="ro-import-error">
        {t.has(`errors.${error}`) ? t(`errors.${error}`) : error}
      </p>
    );
  }

  if (!preview) return null;

  if (preview.orders.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="ro-import-empty">
        {t("empty")}
      </p>
    );
  }

  const toImport = preview.orders.filter((o) => o.willChange).length;

  return (
    <div className="flex flex-col gap-3" data-testid="ro-import-review">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          {t("counts.existing", { count: preview.counts.existing })}
        </Badge>
        <Badge variant="default">{t("counts.new", { count: preview.counts.new })}</Badge>
        {preview.counts.conflict > 0 && (
          <Badge variant="destructive">
            {t("counts.conflict", { count: preview.counts.conflict })}
          </Badge>
        )}
        {toImport === 0 && (
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {t("allPresent")}
          </span>
        )}
      </div>

      {pickableZls.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(pickableZls))}
            data-testid="ro-import-toggle-all"
          >
            {allSelected ? t("uncheckAll") : t("checkAll", { count: pickableZls.length })}
          </Button>
          {mode === "receipt" && (
            <span className="text-muted-foreground text-xs">{t("receiptHint")}</span>
          )}
        </div>
      )}

      <div className={compact ? "max-h-72 overflow-y-auto" : ""}>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="w-8 py-1" />
              <th className="py-1">{t("columns.zl")}</th>
              <th className="py-1">{t("columns.client")}</th>
              <th className="py-1">{t("columns.status")}</th>
              <th className="py-1">{t("columns.parts")}</th>
            </tr>
          </thead>
          <tbody>
            {preview.orders.map((order, index) => {
              const summary = lineSummary(order);
              const zl = order.zlNumber;
              return (
                <tr
                  key={zl ?? `missing-${index}`}
                  className={
                    "border-t align-top" +
                    (mode === "receipt" && zl && !selected.has(zl) ? " opacity-50" : "")
                  }
                  data-testid="ro-import-row"
                >
                  <td className="py-2">
                    {selectable(order) && (
                      <Checkbox
                        checked={selected.has(zl!)}
                        onCheckedChange={(v) => toggle(zl!, v === true)}
                        aria-label={zl!}
                      />
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs">{zl ?? "—"}</td>
                  <td className="py-2">
                    <div>{order.clientName ?? "—"}</div>
                    <div className="text-muted-foreground text-xs">
                      {[order.vehicleBrand, order.vin].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="py-2">
                    {order.status === "conflict" ? (
                      <span className="text-destructive flex items-center gap-1 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t(`conflict.${order.conflictReason ?? "missing_zl"}`)}
                      </span>
                    ) : order.status === "new" ? (
                      <Badge variant="default">{t("status.new")}</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {order.willChange ? t("status.existingChanges") : t("status.existing")}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-xs">
                    {t("parts", {
                      added: summary.added,
                      adds: summary.adds,
                      present: summary.present,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canApply && toImport > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={apply}
            disabled={toApply.length === 0 || isPending}
            data-testid="ro-import-apply"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {t("apply", { count: toApply.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
