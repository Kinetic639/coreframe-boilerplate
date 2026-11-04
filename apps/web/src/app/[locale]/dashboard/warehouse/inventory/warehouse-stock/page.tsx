import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_READ, WAREHOUSE_READ } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { WarehouseStockService } from "@/server/services/warehouse-stock.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Stock per AutoStacja magazyn of the active branch (U5): every part of every
 * magazyn, filtered by jednostka, magazyn or part, with totals per magazyn --
 * to compare with AutoStacja magazyn by magazyn.
 */
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default async function WarehouseStockReportPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const t = await getTranslations("warehouseInventory.warehouseStockReport");
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_inventory_read" } },
      locale,
    });
  }

  const params = searchParams ? await searchParams : {};
  const unitId = one(params.unit);
  const warehouseId = one(params.warehouse);
  const search = one(params.q);
  const branchId = context.app.activeBranchId;
  const supabase = await createClient();

  const [unitsRes, reportRes] = branchId
    ? await Promise.all([
        WarehouseStockService.documentUnits(supabase, context.app.activeOrgId, branchId),
        WarehouseStockService.report(supabase, context.app.activeOrgId, branchId, {
          unitId,
          warehouseId,
          search,
        }),
      ])
    : [null, null];
  const units = unitsRes?.success ? unitsRes.data : [];
  const report = reportRes?.success ? reportRes.data : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("unit")}
          <select
            name="unit"
            defaultValue={unitId ?? ""}
            className="h-9 rounded-md border bg-background px-2 text-sm font-normal normal-case tracking-normal text-foreground"
          >
            <option value="">{t("all")}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
                {u.name ? ` ${u.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("warehouse")}
          <select
            name="warehouse"
            defaultValue={warehouseId ?? ""}
            className="h-9 rounded-md border bg-background px-2 text-sm font-normal normal-case tracking-normal text-foreground"
          >
            <option value="">{t("all")}</option>
            {units.flatMap((u) =>
              u.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                  {w.name ? ` ${w.name}` : ""} ({u.code})
                </option>
              ))
            )}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("search")}
          <Input
            name="q"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="h-9 w-56 font-normal normal-case tracking-normal"
          />
        </label>
        <Button type="submit" size="sm" className="h-9">
          {t("apply")}
        </Button>
      </form>

      {!branchId || !report ? (
        <p className="text-sm text-muted-foreground">{branchId ? t("loadError") : t("noBranch")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" data-testid="warehouse-stock-totals">
            {report.totals.map((x) => (
              <div key={x.warehouseId} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-mono font-semibold">
                  {x.warehouseCode} <span className="text-muted-foreground">· {x.unitCode}</span>
                </div>
                {x.warehouseName ? (
                  <div className="text-xs text-muted-foreground">{x.warehouseName}</div>
                ) : null}
                <div className="mt-1 text-xs">
                  {t("positions", { count: x.positions })} · {t("pieces", { qty: fmt(x.quantity) })}
                </div>
              </div>
            ))}
            {report.withoutWarehouse.positions > 0 && !unitId && !warehouseId ? (
              <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                <div className="font-semibold">{t("without")}</div>
                <div className="mt-1 text-xs">
                  {t("positions", { count: report.withoutWarehouse.positions })} ·{" "}
                  {t("pieces", { qty: fmt(report.withoutWarehouse.quantity) })}
                </div>
              </div>
            ) : null}
          </div>

          {report.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("unit")}</th>
                    <th className="px-3 py-2 font-medium">{t("warehouse")}</th>
                    <th className="px-3 py-2 font-medium">{t("sku")}</th>
                    <th className="px-3 py-2 font-medium">{t("name")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr
                      key={`${r.warehouseId}:${r.variantId}`}
                      className="border-b last:border-0"
                      data-testid="warehouse-stock-report-row"
                    >
                      <td className="px-3 py-1.5 font-mono">{r.unitCode}</td>
                      <td className="px-3 py-1.5 font-mono" title={r.warehouseName ?? undefined}>
                        {r.warehouseCode}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.productId ? (
                          <Link
                            href={{
                              pathname: "/dashboard/warehouse/items/[productId]",
                              params: { productId: r.productId },
                            }}
                            className="hover:underline"
                          >
                            {r.sku}
                          </Link>
                        ) : (
                          r.sku
                        )}
                      </td>
                      <td className="px-3 py-1.5">{r.productName}</td>
                      <td
                        className={`px-3 py-1.5 text-right font-mono ${r.quantity < 0 ? "text-destructive" : ""}`}
                      >
                        {fmt(r.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
