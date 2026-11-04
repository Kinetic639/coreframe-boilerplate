/**
 * Stock per AutoStacja magazyn on the item page (U2): how many pieces belong
 * to magazyn 115, 116… of the branch, wherever they lie, and what is not
 * booked to a magazyn yet. Server-rendered; one block per variant that has
 * any stock.
 */
export interface WarehouseStockSectionVariant {
  variantId: string;
  sku: string | null;
  rows: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string | null;
    unitCode: string;
    unitName: string | null;
    quantity: number;
  }>;
  withoutWarehouse: number;
}

export interface WarehouseStockSectionLabels {
  title: string;
  hint: string;
  unit: string;
  warehouse: string;
  quantity: string;
  without: string;
  withoutHint: string;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function WarehouseStockSection({
  variants,
  showSku,
  labels,
}: {
  variants: WarehouseStockSectionVariant[];
  showSku: boolean;
  labels: WarehouseStockSectionLabels;
}) {
  const shown = variants.filter((v) => v.rows.length > 0 || v.withoutWarehouse > 0);
  if (shown.length === 0) return null;

  return (
    <section className="grid gap-3 rounded-md border p-4" data-testid="warehouse-stock">
      <div>
        <h2 className="text-lg font-medium">{labels.title}</h2>
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
      </div>
      {shown.map((v) => (
        <div key={v.variantId} className="grid gap-1">
          {showSku && v.sku ? (
            <p className="font-mono text-xs text-muted-foreground">{v.sku}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">{labels.unit}</th>
                  <th className="py-1.5 pr-3 font-medium">{labels.warehouse}</th>
                  <th className="py-1.5 text-right font-medium">{labels.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {v.rows.map((r) => (
                  <tr
                    key={r.warehouseId}
                    className="border-b last:border-0"
                    data-testid="warehouse-stock-row"
                  >
                    <td className="py-1.5 pr-3">
                      <span className="font-mono">{r.unitCode}</span>
                      {r.unitName ? (
                        <span className="ml-2 text-muted-foreground">{r.unitName}</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="font-mono">{r.warehouseCode}</span>
                      {r.warehouseName ? (
                        <span className="ml-2 text-muted-foreground">{r.warehouseName}</span>
                      ) : null}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${r.quantity < 0 ? "text-destructive" : ""}`}
                    >
                      {fmt(r.quantity)}
                    </td>
                  </tr>
                ))}
                {v.withoutWarehouse > 0 ? (
                  <tr className="text-muted-foreground" data-testid="warehouse-stock-without">
                    <td className="py-1.5 pr-3" colSpan={2} title={labels.withoutHint}>
                      {labels.without}
                    </td>
                    <td className="py-1.5 text-right font-mono">{fmt(v.withoutWarehouse)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
