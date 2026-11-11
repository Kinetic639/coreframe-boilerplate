"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InternalOrderLinesTable } from "@/components/warehouse/internal-order-lines";
import type { InternalOrderView } from "@/server/services/internal-orders.service";
import type { StockDocument } from "./repair-order-stock-history";

/**
 * "Magazyn i zamówienia" of a repair order, laid out like AutoStacja's
 * "Magazyn i Zam.": on top the order's warehouse documents with the lines of
 * the selected one, below its internal orders (ZW) with the lines of the
 * selected one and their Z / R / W / A squares.
 */

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function DocumentNumber({ doc }: { doc: StockDocument }) {
  if (!doc.number) return <span className="text-muted-foreground">—</span>;
  return doc.movementId ? (
    <Link
      href={{
        pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
        params: { movementId: doc.movementId },
      }}
      className="text-primary font-mono text-xs hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {doc.number}
    </Link>
  ) : (
    <span className="font-mono text-xs">{doc.number}</span>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border">
      <div className="bg-muted/30 border-b px-3 py-1.5 text-xs font-medium">{title}</div>
      <div className="max-h-[420px] overflow-auto">{children}</div>
    </div>
  );
}

export function RepairOrderWarehouseOrders({
  documents,
  orders,
  locale,
  ordersLoadError,
  orderActions,
}: {
  documents: StockDocument[];
  orders: InternalOrderView[];
  locale: string;
  ordersLoadError?: boolean;
  /** "Nowe ZW" and the like, shown next to the orders title. */
  orderActions?: ReactNode;
}) {
  const t = useTranslations("modules.workshop.repairOrders");
  const tz = useTranslations("modules.warehouse.internalOrders");
  const [docKey, setDocKey] = useState<string | null>(documents.at(-1)?.key ?? null);
  const [orderId, setOrderId] = useState<string | null>(orders[0]?.id ?? null);
  const doc = documents.find((d) => d.key === docKey) ?? null;
  const order = orders.find((o) => o.id === orderId) ?? null;
  const date = (value: string | null) => (value ? new Date(value).toLocaleString(locale) : "—");

  return (
    <div className="grid gap-6">
      <section className="grid gap-3" data-testid="repair-order-stock-documents">
        <div>
          <h2 className="text-base font-semibold">{t("stock.documents.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("stock.documents.subtitle")}</p>
        </div>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("stock.documents.empty")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title={t("stock.documents.document")}>
              <table className="w-full text-sm">
                <tbody>
                  {[...documents].reverse().map((d) => (
                    <tr
                      key={d.key}
                      onClick={() => setDocKey(d.key)}
                      aria-selected={d.key === docKey}
                      className={cn(
                        "hover:bg-muted/40 cursor-pointer border-b last:border-b-0",
                        d.key === docKey && "bg-primary/10"
                      )}
                      data-testid="stock-document-row"
                    >
                      <td className="py-1.5 pr-2 pl-3">
                        <DocumentNumber doc={d} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge variant="outline">{t(`stock.kinds.${d.kind}`)}</Badge>
                      </td>
                      <td className="text-muted-foreground py-1.5 pr-3 text-xs whitespace-nowrap">
                        {date(d.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title={doc?.number ?? t("stock.documents.part")}>
              {doc && (
                <table className="w-full text-sm" data-testid="stock-document-lines">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th className="py-1.5 pr-3 pl-3 font-medium">{t("stock.documents.part")}</th>
                      <th className="py-1.5 pr-3 text-right font-medium">
                        {t("stock.documents.quantity")}
                      </th>
                      <th className="py-1.5 pr-3 font-medium">{t("stock.documents.detail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.map((line) => (
                      <tr key={line.key} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-3 pl-3">{line.part}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">
                          {fmt(line.quantity)}
                        </td>
                        <td className="text-muted-foreground py-1.5 pr-3 text-xs">
                          {line.detail ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        )}
      </section>

      <section className="grid gap-3" data-testid="repair-order-internal-orders">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{tz("forOrder.title")}</h2>
            <p className="text-muted-foreground text-sm">{tz("forOrder.subtitle")}</p>
          </div>
          {orderActions}
        </div>
        {ordersLoadError ? (
          <p className="text-destructive text-sm">{tz("loadError")}</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tz("forOrder.empty")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title={tz("columns.order")}>
              <table className="w-full text-sm">
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setOrderId(o.id)}
                      aria-selected={o.id === orderId}
                      className={cn(
                        "hover:bg-muted/40 cursor-pointer border-b last:border-b-0",
                        o.id === orderId && "bg-primary/10"
                      )}
                      data-testid="internal-order-row"
                    >
                      <td className="py-1.5 pr-2 pl-3">
                        <Link
                          href={{
                            pathname: "/dashboard/warehouse/internal-orders/[id]",
                            params: { id: o.id },
                          }}
                          className="text-primary font-mono text-xs hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {o.number}
                        </Link>
                        {o.externalNumber && (
                          <p className="text-muted-foreground font-mono text-[11px]">
                            {o.externalNumber}
                          </p>
                        )}
                      </td>
                      <td className="text-muted-foreground py-1.5 pr-2 text-xs whitespace-nowrap">
                        {date(o.createdAt)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-xs tabular-nums">
                        {tz("lineCount", { count: o.lines.length })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title={order?.number ?? tz("columns.order")}>
              {order && <InternalOrderLinesTable order={order} />}
            </Panel>
          </div>
        )}
      </section>
    </div>
  );
}
