"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ImportSummaryPartStatus = "in_catalog" | "create" | "ambiguous" | "no_permission";

export type ImportSummaryPart = {
  key: string;
  code: string;
  name: string;
  quantity: number | null;
  unit: string;
  status: ImportSummaryPartStatus;
};

export type ImportSummaryOrderStatus =
  | "new"
  | "existing"
  | "existing_changes"
  | "conflict"
  /** Repair orders could not be checked (no permission, error). */
  | "unknown"
  /** Lines without a ZL number: free stock. */
  | "none"
  /** A ZW without ZL (e.g. ordered by another branch): reserved under the ZW. */
  | "internal_order";

export type ImportSummaryOrder = {
  key: string;
  zlNumber: string | null;
  /** The AutoStacja ZW of an "internal_order" group and the branch code in its note. */
  internalOrder: { zw: string; destination: string | null } | null;
  description: string | null;
  status: ImportSummaryOrderStatus;
  conflictReason: string | null;
  parts: ImportSummaryPart[];
};

export type ImportSessionSummaryModel = {
  orders: ImportSummaryOrder[];
  ordersChecked: boolean;
  counts: {
    ordersNew: number;
    ordersExisting: number;
    ordersConflict: number;
    lines: number;
    inCatalog: number;
    create: number;
    ambiguous: number;
    noPermission: number;
    freeStock: number;
    internalOrder: number;
  };
};

const ORDER_BADGE: Record<
  ImportSummaryOrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "default",
  existing: "secondary",
  existing_changes: "secondary",
  conflict: "destructive",
  unknown: "outline",
  none: "outline",
  internal_order: "secondary",
};

const PART_CLASS: Record<ImportSummaryPartStatus, string> = {
  in_catalog: "text-emerald-700 dark:text-emerald-400",
  create: "text-primary",
  ambiguous: "text-amber-700 dark:text-amber-400",
  no_permission: "text-destructive",
};

/**
 * What a Matcher session will do before anything is written: its repair
 * orders (new / existing / conflict) with their parts (known / to create /
 * needs a choice), so the user picks quick import or manual review knowingly.
 */
export function MovementImportSummary({
  summary,
  loading,
}: {
  summary: ImportSessionSummaryModel | null;
  loading: boolean;
}) {
  const t = useTranslations("warehouseInventory.movementImport.summary");

  if (loading && !summary) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }
  if (!summary) return null;

  const { counts } = summary;
  const quickWillStop = counts.ambiguous > 0 || counts.noPermission > 0;

  return (
    <section className="mt-4 space-y-3" data-testid="import-summary">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs uppercase text-muted-foreground">{t("ordersTitle")}</div>
          <div className="mt-1 text-sm">
            {summary.ordersChecked ? (
              <>
                <span className="font-semibold">{t("ordersNew", { count: counts.ordersNew })}</span>
                {" · "}
                {t("ordersExisting", { count: counts.ordersExisting })}
                {counts.ordersConflict > 0 && (
                  <>
                    {" · "}
                    <span className="text-destructive">
                      {t("ordersConflict", { count: counts.ordersConflict })}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{t("ordersUnchecked")}</span>
            )}
          </div>
        </div>
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs uppercase text-muted-foreground">
            {t("partsTitle", { count: counts.lines })}
          </div>
          <div className="mt-1 text-sm">
            {t("partsInCatalog", { count: counts.inCatalog })}
            {" · "}
            <span className="font-semibold">{t("partsCreate", { count: counts.create })}</span>
            {counts.ambiguous > 0 && (
              <>
                {" · "}
                <span className="text-amber-700 dark:text-amber-400">
                  {t("partsAmbiguous", { count: counts.ambiguous })}
                </span>
              </>
            )}
            {counts.noPermission > 0 && (
              <>
                {" · "}
                <span className="text-destructive">
                  {t("partsNoPermission", { count: counts.noPermission })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={
          quickWillStop
            ? "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            : "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
        }
        data-testid="import-summary-verdict"
      >
        {quickWillStop && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {quickWillStop
            ? t("verdictStops", { count: counts.ambiguous + counts.noPermission })
            : t("verdictQuick", {
                orders: counts.ordersNew,
                parts: counts.create,
                lines: counts.lines,
              })}
          {counts.freeStock > 0 && <> {t("freeStock", { count: counts.freeStock })}</>}
          {counts.internalOrder > 0 && (
            <> {t("internalOrderStock", { count: counts.internalOrder })}</>
          )}
        </span>
      </div>

      <div className="max-h-[45vh] space-y-2 overflow-auto rounded-md border p-2">
        {summary.orders.map((order) => (
          <details
            key={order.key}
            className="rounded-md border bg-background"
            open={order.status === "new" || order.parts.some((p) => p.status !== "in_catalog")}
            data-testid="import-summary-order"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-mono font-semibold">
                {order.internalOrder
                  ? order.internalOrder.zw
                  : order.zlNumber
                    ? `ZL ${order.zlNumber}`
                    : t("noOrder")}
              </span>
              {order.internalOrder?.destination && (
                <Badge variant="outline" data-testid="import-summary-destination">
                  {t("internalOrderFor", { branch: order.internalOrder.destination })}
                </Badge>
              )}
              {order.description && (
                <span className="text-muted-foreground">{order.description}</span>
              )}
              <Badge variant={ORDER_BADGE[order.status]} className="ml-auto">
                {order.status === "conflict" && order.conflictReason
                  ? t(`conflict.${order.conflictReason}`)
                  : t(`orderStatus.${order.status}`)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("partsCount", { count: order.parts.length })}
              </span>
            </summary>
            <table className="w-full border-t text-xs">
              <tbody className="divide-y">
                {order.parts.map((part) => (
                  <tr key={part.key}>
                    <td className="px-3 py-1.5 font-mono">{part.code}</td>
                    <td className="px-3 py-1.5">{part.name}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      {part.quantity ?? "-"} {part.unit}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-1.5 ${PART_CLASS[part.status]}`}>
                      {t(`partStatus.${part.status}`, { unit: part.unit })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>
    </section>
  );
}
