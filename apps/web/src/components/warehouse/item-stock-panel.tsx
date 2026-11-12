"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  fetchItemStockBreakdown,
  type ItemStockBreakdown,
} from "@/lib/warehouse/item-stock-client";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { ItemStockActions, STOCK_CHANGED_EVENT } from "./stock-commitments";
import { StockByLocationTable } from "./stock-by-location-table";

/**
 * The item's stock per location with every reservation and block behind it,
 * loaded on the client -- for the item panel of the products list. Reloads
 * after every reservation / block operation.
 */
const LOAD_TIMEOUT_MS = 20_000;

export function ItemStockPanel({ productId, showSku }: { productId: string; showSku: boolean }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const tStock = useTranslations("warehouseInventory.detail.stockByLocation");
  const tc = useTranslations("warehouseInventory.common");
  const tList = useTranslations("warehouseInventory.list");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; data: ItemStockBreakdown }
  >({ status: "loading" });

  // Only the latest call may answer (another product, a reload after an
  // operation); a call that throws or never answers ends in the error state
  // with a retry, never in an endless spinner.
  const call = useRef(0);
  const organizationId = useAppStoreV2((store) => store.activeOrgId);
  const branchId = useAppStoreV2((store) => store.activeBranchId);
  const load = useCallback(async () => {
    const id = ++call.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        fetchItemStockBreakdown({ productId, organizationId, branchId }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
        }),
      ]);
      if (id !== call.current) return;
      setState(
        result.success
          ? { status: "ready", data: result.data }
          : { status: "error", error: (result as { error: string }).error }
      );
    } catch (error) {
      if (id !== call.current) return;
      setState({ status: "error", error: error instanceof Error ? error.message : "failed" });
    } finally {
      clearTimeout(timer);
    }
  }, [productId, organizationId, branchId]);

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
          {state.error !== "no_branch" ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setState({ status: "loading" });
                void load();
              }}
            >
              {tCommon("retry")}
            </button>
          ) : null}
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
