"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BlockLinesTable, ReservationLinesTable } from "@/components/warehouse/stock-commitments";
import type { InventoryBalanceListRow } from "@/lib/warehouse/inventory-types";
import type { ReservationLineView } from "@/server/services/inventory-reservations.service";
import type { BlockLineView } from "@/server/services/inventory-blocks.service";

/**
 * Stock of an item per location, each location opening to what its numbers
 * are made of: every reservation (REZ, repair order, quantity, in a
 * container, since) and every block (BLK, reason, reference) there, and what
 * is left free (D). The operations sit on those rows.
 */

const totalOrDash = (value: number) => (value ? fmt(value) : "—");

export type StockByLocationLabels = Record<
  | "title"
  | "empty"
  | "sku"
  | "location"
  | "onHand"
  | "available"
  | "reserved"
  | "blocked"
  | "avgCost"
  | "value"
  | "lastMovement"
  | "total",
  string
>;

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function StockByLocationTable({
  rows,
  reservations,
  blocks,
  showSku,
  locale,
  labels,
  canOperate,
  branchId,
}: {
  rows: InventoryBalanceListRow[];
  reservations: ReservationLineView[];
  blocks: BlockLineView[];
  showSku: boolean;
  locale: string;
  labels: StockByLocationLabels;
  canOperate: boolean;
  branchId: string | null;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  const currency = rows[0]?.currency ?? "PLN";
  const sameCurrency = rows.every((row) => row.currency === currency);
  const key = (variantId: string, locationId: string) => `${variantId}:${locationId}`;
  const reservationsAt = new Map<string, ReservationLineView[]>();
  for (const r of reservations) {
    const k = key(r.variantId, r.locationId);
    reservationsAt.set(k, [...(reservationsAt.get(k) ?? []), r]);
  }
  const blocksAt = new Map<string, BlockLineView[]>();
  for (const b of blocks) {
    const k = key(b.variantId, b.locationId);
    blocksAt.set(k, [...(blocksAt.get(k) ?? []), b]);
  }
  const columns = (showSku ? 1 : 0) + 9;

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{labels.empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm" data-testid="stock-by-location-table">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="w-8 py-1.5" />
            {showSku ? <th className="py-1.5 pr-3 font-medium">{labels.sku}</th> : null}
            <th className="py-1.5 pr-3 font-medium">{labels.location}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.onHand}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.available}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.reserved}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.blocked}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.avgCost}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{labels.value}</th>
            <th className="py-1.5 font-medium">{labels.lastMovement}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = key(row.variant_id, row.location_id);
            const rs = reservationsAt.get(k) ?? [];
            const bs = blocksAt.get(k) ?? [];
            const expandable = rs.length > 0 || bs.length > 0;
            const expanded = open.has(row.id);
            return (
              <Fragment key={row.id}>
                <tr className="border-b last:border-b-0" data-testid="stock-location-row">
                  <td className="py-1.5 align-top">
                    {expandable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggle(row.id)}
                        aria-expanded={expanded}
                        aria-label={labels.location}
                        data-testid="stock-location-toggle"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                  </td>
                  {showSku ? <td className="py-1.5 pr-3 font-mono text-xs">{row.sku}</td> : null}
                  <td className="py-1.5 pr-3">
                    {row.location_code ? (
                      <span className="mr-1.5 font-mono text-xs">{row.location_code}</span>
                    ) : null}
                    {row.location_name}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {fmt(row.on_hand_quantity)} {row.unit_code}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {fmt(row.available_quantity)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.reserved_total_quantity ? fmt(row.reserved_total_quantity) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.blocked_quantity ? (
                      <span className="text-destructive">{fmt(row.blocked_quantity)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {money(row.average_unit_cost, row.currency)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {money(row.total_value, row.currency)}
                  </td>
                  <td className="py-1.5">
                    {row.last_movement_id && row.last_movement_number ? (
                      <Link
                        href={{
                          pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
                          params: { movementId: row.last_movement_id },
                        }}
                        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {row.last_movement_number}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b bg-muted/10" data-testid="stock-location-breakdown">
                    <td />
                    <td colSpan={columns - 1} className="grid gap-3 py-2 pr-3">
                      <p className="text-xs text-muted-foreground">
                        {t("breakdown.summary", {
                          onHand: fmt(row.on_hand_quantity),
                          available: fmt(row.available_quantity),
                          reserved: fmt(row.reserved_total_quantity),
                          blocked: fmt(row.blocked_quantity),
                        })}
                      </p>
                      {rs.length > 0 ? (
                        <div className="grid gap-1">
                          <h3 className="text-xs font-semibold">{t("reservations.title")}</h3>
                          <ReservationLinesTable
                            lines={rs}
                            canOperate={canOperate}
                            showPart={false}
                          />
                        </div>
                      ) : null}
                      {bs.length > 0 && branchId ? (
                        <div className="grid gap-1">
                          <h3 className="text-xs font-semibold">{t("blocks.title")}</h3>
                          <BlockLinesTable
                            lines={bs}
                            canOperate={canOperate}
                            branchId={branchId}
                            showPart={false}
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        {rows.length > 1 ? (
          <tfoot>
            <tr className="border-t font-medium">
              <td />
              <td className="py-1.5 pr-3" colSpan={showSku ? 2 : 1}>
                {labels.total}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {fmt(rows.reduce((s, r) => s + r.on_hand_quantity, 0))} {rows[0]?.unit_code}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {fmt(rows.reduce((s, r) => s + r.available_quantity, 0))}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {totalOrDash(rows.reduce((s, r) => s + r.reserved_total_quantity, 0))}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {totalOrDash(rows.reduce((s, r) => s + r.blocked_quantity, 0))}
              </td>
              <td />
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {sameCurrency
                  ? money(
                      rows.reduce((s, r) => s + r.total_value, 0),
                      currency
                    )
                  : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
