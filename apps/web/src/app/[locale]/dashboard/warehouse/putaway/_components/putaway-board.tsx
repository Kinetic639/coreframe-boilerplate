"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, MapPin, Package, ScanLine, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import { PutawayDialog } from "./putaway-dialog";
import { ScanFlow, type ScanFlowStep } from "./scan-flow";
import { LocationChanges } from "./location-changes";
import {
  formatQty,
  isContainerPart,
  itemKey,
  locLabel,
  type RepairOrderInfo,
} from "./putaway-utils";

export { itemKey } from "./putaway-utils";

type Props = {
  branchId: string;
  receivingLocationId: string | null;
  items: ReceivingPendingItem[];
  loadError: boolean;
  canOperate: boolean;
  /** Per repair order: client and the containers it already has. */
  orders?: Record<string, RepairOrderInfo>;
};

/**
 * "Rozlokowanie" -- mobile first. The receiving zone grouped per repair
 * order (with where each order already has containers), bulk material and
 * free stock last; a thumb-reach "Skanuj" drives the putaway (container /
 * fresh sticker / location). Each item keeps a manual "Rozłóż" fallback.
 * Second tab: repair orders whose locations changed, for AutoStacja.
 */
export function PutawayBoard({
  branchId,
  receivingLocationId,
  items,
  loadError,
  canOperate,
  orders = {},
}: Props) {
  const t = useTranslations("modules.warehouse.putaway");
  const [tab, setTab] = useState<"pending" | "changes">("pending");
  const [active, setActive] = useState<ReceivingPendingItem | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStep, setScanStep] = useState<ScanFlowStep | undefined>(undefined);
  const [scanSession, setScanSession] = useState(0);

  const openScan = (step?: ScanFlowStep) => {
    setScanStep(step);
    setScanSession((n) => n + 1);
    setScanOpen(true);
  };

  // A repair-order part never goes onto a shelf on its own: it goes into a
  // container of its order (existing, new with a sticker, or -- knowingly --
  // a stickerless one for oversize parts). Only free stock and bulk
  // material use the plain "scan a location" putaway.
  const putAway = (item: ReceivingPendingItem) => {
    if (isContainerPart(item) && item.repairOrderId) {
      openScan({ kind: "order", repairOrderId: item.repairOrderId, focusKey: itemKey(item) });
    } else {
      setActive(item);
    }
  };

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
        className="bg-card flex items-center justify-between gap-3 rounded-lg border p-3"
        data-testid="putaway-item"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{item.sku ?? "—"}</span>
            {item.handlingMode === "bulk" && (
              <Badge variant="secondary" data-testid="putaway-bulk-badge">
                {t("bulkBadge")}
              </Badge>
            )}
          </div>
          <p className="truncate text-sm">{item.productName ?? "—"}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate" data-testid="putaway-suggestion">
              {suggestion(item)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-mono text-base font-semibold">
            {formatQty(item.quantity)} {item.unitCode ?? ""}
          </span>
          {canOperate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => putAway(item)}
              data-testid="putaway-open"
              className="h-9"
            >
              {t("putaway")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const ready = !loadError && !!receivingLocationId;

  return (
    <div className="flex min-h-full flex-col" data-testid="putaway-board">
      <div className="flex flex-col gap-4 p-4 pb-28 sm:p-6 sm:pb-28">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border p-1" role="tablist">
          {(["pending", "changes"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "h-10 rounded-md text-sm font-medium",
                tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
              data-testid={`putaway-tab-${key}`}
            >
              {key === "pending" ? t("tabs.pending", { count: items.length }) : t("tabs.changes")}
            </button>
          ))}
        </div>

        {tab === "changes" ? (
          <LocationChanges />
        ) : loadError ? (
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

            {groups.orders.map(([orderId, group]) => {
              const info = orders[orderId];
              const containers = (info?.containers ?? []).filter((c) => c.status === "active");
              return (
                <section key={orderId} className="flex flex-col gap-2" data-testid="putaway-group">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <Wrench className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="truncate font-mono">ZL {group.title}</span>
                    </h2>
                    {(info?.clientName || group.brand) && (
                      <p className="text-muted-foreground ml-6 truncate text-xs">
                        {[info?.clientName, info?.vehicleBrand ?? group.brand]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {containers.length > 0 && (
                      <div
                        className="ml-6 mt-1 flex flex-wrap gap-1"
                        data-testid="putaway-order-containers"
                      >
                        {containers.map((c) => (
                          <Badge key={c.id} variant="outline" className="font-mono text-[11px]">
                            {c.code}
                            {c.location ? ` · ${c.location.code ?? c.location.name ?? ""}` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {group.items.map(renderItem)}
                </section>
              );
            })}

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
      </div>

      {canOperate && ready && tab === "pending" && items.length > 0 && (
        <Button
          type="button"
          size="icon"
          className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-16 w-16 rounded-full shadow-lg sm:right-6 sm:bottom-6"
          onClick={() => openScan()}
          aria-label={t("scanCta")}
          data-testid="putaway-scan-start"
        >
          <ScanLine className="h-7 w-7" />
        </Button>
      )}

      {scanOpen && (
        <ScanFlow
          key={scanSession}
          initialStep={scanStep}
          open={scanOpen}
          onOpenChange={setScanOpen}
          branchId={branchId}
          receivingLocationId={receivingLocationId}
          items={items}
          orders={orders}
        />
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
