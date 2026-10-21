"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ZwLineSquares, ZwSquaresHeader } from "@/components/warehouse/internal-order-status";
import type { InternalOrderView } from "@/server/services/internal-orders.service";

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Lines of one ZW with their squares and quantities (also used on the ZW page). */
export function InternalOrderLinesTable({ order }: { order: InternalOrderView }) {
  const tz = useTranslations("modules.warehouse.internalOrders");
  const receipts = new Map<string, string[]>();
  for (const r of order.receipts) {
    const list = receipts.get(r.internalOrderLineId) ?? [];
    if (r.documentNumber && !list.includes(r.documentNumber)) list.push(r.documentNumber);
    receipts.set(r.internalOrderLineId, list);
  }
  return (
    <table className="w-full min-w-[560px] text-sm" data-testid="internal-order-lines">
      <thead>
        <tr className="text-muted-foreground border-b text-left text-xs">
          <th className="py-1.5 pr-2 pl-3 font-medium">{tz("columns.lp")}</th>
          <th className="py-1.5 pr-2 font-medium">
            <ZwSquaresHeader />
          </th>
          <th className="py-1.5 pr-2 font-medium">{tz("columns.code")}</th>
          <th className="py-1.5 pr-2 font-medium">{tz("columns.name")}</th>
          <th className="py-1.5 pr-2 text-right font-medium">{tz("columns.quantity")}</th>
          <th className="py-1.5 pr-2 text-right font-medium">{tz("columns.reserved")}</th>
          <th className="py-1.5 pr-2 text-right font-medium">{tz("columns.issued")}</th>
          <th className="py-1.5 pr-3 font-medium">{tz("columns.receipts")}</th>
        </tr>
      </thead>
      <tbody>
        {order.lines.map((line) => (
          <tr
            key={line.id}
            className={cn("border-b last:border-b-0", line.cancelledAt && "text-muted-foreground")}
            data-testid="internal-order-line"
          >
            <td className="py-1.5 pr-2 pl-3 tabular-nums">{line.lineNumber}</td>
            <td className="py-1.5 pr-2">
              <ZwLineSquares line={line} />
            </td>
            <td className="py-1.5 pr-2 font-mono text-xs">{line.productCode ?? "—"}</td>
            <td className={cn("py-1.5 pr-2", line.cancelledAt && "line-through")}>
              {line.productName}
              {line.cancelReason && (
                <p className="text-muted-foreground text-xs no-underline">
                  {tz("cancelledBecause", { reason: line.cancelReason })}
                </p>
              )}
            </td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(line.quantity)}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(line.reservedQuantity)}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(line.issuedQuantity)}</td>
            <td className="text-muted-foreground py-1.5 pr-3 font-mono text-xs">
              {(receipts.get(line.id) ?? []).join(", ") || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
