"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  getItemStockBreakdownAction,
  type ItemStockBreakdown,
} from "@/app/actions/warehouse/item-stock";
import { ItemStockActions, STOCK_CHANGED_EVENT } from "./stock-commitments";
import { StockByLocationTable } from "./stock-by-location-table";

/**
 * The item's stock per location with every reservation and block behind it,
 * loaded on the client -- for the item panel of the products list. Reloads
 * after every reservation / block operation.
 */
export function ItemStockPanel({ productId, showSku }: { productId: string; showSku: boolean }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const tStock = useTranslations("warehouseInventory.detail.stockByLocation");
  const tc = useTranslations("warehouseInventory.common");
  const tList = useTranslations("warehouseInventory.list");
  const locale = useLocale();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; data: ItemStockBreakdown }
  >({ status: "loading" });

  const load = useCallback(async () => {
    const result = await getItemStockBreakdownAction({ productId });
    setState(
      result.success
        ? { status: "ready", data: result.data }
        : { status: "error", error: (result as { error: string }).error }
    );
  }, [productId]);

  useEffect(() => {
    setState({ status: "loading" });
    void load();
    const reload = () => void load();
    window.addEventListener(STOCK_CHANGED_EVENT, reload);
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, reload);
  }, [load]);

  return (
    <section className="grid gap-3 rounded-md border p-4" data-testid="item-stock-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{tStock("title")}</h3>
          <p className="text-xs text-muted-foreground">{t("breakdown.hint")}</p>
        </div>
        {state.status === "ready" && state.data.canOperate ? (
          <ItemStockActions
            stock={state.data.rows.map((row) => ({
              variantId: row.variant_id,
              sku: showSku ? row.sku : null,
              locationId: row.location_id,
              locationCode: row.location_code,
              locationName: row.location_name,
              available: row.available_quantity,
            }))}
          />
        ) : null}
      </div>
      {state.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("fields.loading")}
        </p>
      ) : state.status === "error" ? (
        <p className="text-sm text-destructive" data-testid="item-stock-panel-error">
          {state.error === "no_branch" ? tStock("noBranch") : t("pages.loadError")}
        </p>
      ) : (
        <StockByLocationTable
          rows={state.data.rows}
          reservations={state.data.reservations}
          blocks={state.data.blocks}
          showSku={showSku}
          locale={locale}
          canOperate={state.data.canOperate}
          branchId={state.data.branchId}
          labels={{
            title: tStock("title"),
            empty: tStock("empty"),
            sku: tc("sku"),
            location: tc("location"),
            onHand: tList("onHand"),
            available: t("states.available"),
            reserved: t("states.reserved"),
            blocked: t("states.blocked"),
            avgCost: tStock("avgCost"),
            value: tStock("value"),
            lastMovement: tStock("lastMovement"),
            total: tStock("total"),
          }}
        />
      )}
    </section>
  );
}
