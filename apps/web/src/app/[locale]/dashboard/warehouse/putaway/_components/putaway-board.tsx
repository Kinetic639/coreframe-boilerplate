"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, MapPin, Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import { PutawayDialog } from "./putaway-dialog";

type Props = {
  branchId: string;
  receivingLocationId: string | null;
  items: ReceivingPendingItem[];
  loadError: boolean;
  canOperate: boolean;
};

export function itemKey(item: ReceivingPendingItem) {
  return `${item.variantId}:${item.repairOrderLineId ?? "free"}`;
}

function locLabel(code: string | null, name: string | null) {
  if (code && name) return `${code} · ${name}`;
  return code ?? name ?? "—";
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toString();
}

/**
 * Zone 5: what waits in the receiving zone, grouped per repair order (ZL)
 * with free stock last. Each item shows where it should go -- the RO's
 * container, its fixed bin (bulk material) or a new RO container -- and
 * "Rozłóż" opens the scan-location-and-confirm dialog.
 */
export function PutawayBoard({
  branchId,
  receivingLocationId,
  items,
  loadError,
  canOperate,
}: Props) {
  const t = useTranslations("modules.warehouse.putaway");
  const [active, setActive] = useState<ReceivingPendingItem | null>(null);

  const groups = useMemo(() => {
    const byOrder = new Map<
      string,
      { title: string; brand: string | null; items: ReceivingPendingItem[] }
    >();
    const free: ReceivingPendingItem[] = [];
    for (const item of items) {
      if (!item.repairOrderId) {
        free.push(item);
        continue;
      }
      const group = byOrder.get(item.repairOrderId) ?? {
        title: item.zlNumber ?? "—",
        brand: item.vehicleBrand,
        items: [],
      };
      group.items.push(item);
      byOrder.set(item.repairOrderId, group);
    }
    return { orders: [...byOrder.entries()], free };
  }, [items]);

  function suggestion(item: ReceivingPendingItem) {
    if (item.handlingMode === "bulk") {
      return item.defaultLocation
        ? t("suggest.bulkFixed", {
            location: locLabel(item.defaultLocation.code, item.defaultLocation.name),
          })
        : t("suggest.bulkNoFixed");
    }
    if (item.repairOrderLineId) {
      return item.container
        ? t("suggest.container", {
            code: item.container.code,
            location: locLabel(item.container.locationCode, item.container.locationName),
          })
        : t("suggest.newContainer");
    }
    return item.defaultLocation
      ? t("suggest.freeFixed", {
          location: locLabel(item.defaultLocation.code, item.defaultLocation.name),
        })
      : t("suggest.free");
  }

  function renderItem(item: ReceivingPendingItem) {
    return (
      <div
        key={itemKey(item)}
        className="bg-card border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="putaway-item"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">{item.sku ?? "—"}</span>
            {item.handlingMode === "bulk" && (
              <Badge variant="secondary" data-testid="putaway-bulk-badge">
                {t("bulkBadge")}
              </Badge>
            )}
          </div>
          <p className="text-sm">{item.productName ?? "—"}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" />
            <span data-testid="putaway-suggestion">{suggestion(item)}</span>
          </p>
          {item.documentNumber && (
            <p className="text-muted-foreground font-mono text-[11px]">{item.documentNumber}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-mono text-base font-semibold">
            {formatQty(item.quantity)} {item.unitCode ?? ""}
          </span>
          {canOperate && (
            <Button
              type="button"
              onClick={() => setActive(item)}
              data-testid="putaway-open"
              className="min-w-28"
            >
              {t("putaway")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6" data-testid="putaway-board">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {loadError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm"
          data-testid="putaway-error"
        >
          {t("loadError")}
        </div>
      ) : !receivingLocationId ? (
        <div
          className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
          data-testid="putaway-no-receiving"
        >
          {t("noReceivingLocation")}
        </div>
      ) : items.length === 0 ? (
        <div
          className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm"
          data-testid="putaway-empty"
        >
          <Inbox className="h-6 w-6" />
          {t("empty")}
        </div>
      ) : (
        <>
          <p className="text-sm" data-testid="putaway-summary">
            {t("summary", { count: items.length })}
          </p>

          {groups.orders.map(([orderId, group]) => (
            <section key={orderId} className="flex flex-col gap-2" data-testid="putaway-group">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="text-muted-foreground h-4 w-4" />
                <span className="font-mono">ZL {group.title}</span>
                {group.brand && (
                  <span className="text-muted-foreground font-normal">· {group.brand}</span>
                )}
              </h2>
              {group.items.map(renderItem)}
            </section>
          ))}

          {groups.free.length > 0 && (
            <section className="flex flex-col gap-2" data-testid="putaway-group-free">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Package className="text-muted-foreground h-4 w-4" />
                {t("freeGroup")}
              </h2>
              {groups.free.map(renderItem)}
            </section>
          )}
        </>
      )}

      {active && (
        <PutawayDialog
          item={active}
          branchId={branchId}
          receivingLocationId={receivingLocationId}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
