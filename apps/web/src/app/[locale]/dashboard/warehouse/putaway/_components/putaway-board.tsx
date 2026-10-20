"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Box,
  ChevronRight,
  History,
  Inbox,
  MapPin,
  Package,
  PackagePlus,
  ScanLine,
  Tag,
  Wrench,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import { PutawayDialog } from "./putaway-dialog";
import { ScanFlow, type ScanFlowStep } from "./scan-flow";
import { unlockScanSound } from "./scan-feedback";
import { useScanIndex } from "./scan-index";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import type { QrIndexEntry } from "@/server/services/putaway-scan.service";
import {
  formatQty,
  isContainerPart,
  itemKey,
  locLabel,
  type RepairOrderInfo,
} from "./putaway-utils";

export { itemKey } from "./putaway-utils";

type Props = {
  organizationId: string;
  branchId: string;
  receivingLocationId: string | null;
  items: ReceivingPendingItem[];
  loadError: boolean;
  canOperate: boolean;
  /** Per repair order: client, its containers, where its loose parts lie. */
  orders?: Record<string, RepairOrderInfo>;
  /** Every QR code of the organization: scans are recognised on the phone. */
  qrCodes?: QrIndexEntry[];
};

type OrderGroup = {
  id: string;
  zlNumber: string;
  brand: string | null;
  info: RepairOrderInfo | undefined;
  items: ReceivingPendingItem[];
  /** Containers of the order that hold parts on a location. */
  containers: RepairOrderInfo["containers"];
};

/** The documents (PZ, MM...) that brought an item into the receiving zone. */
function documentNumbers(item: ReceivingPendingItem): string[] {
  return [
    ...new Set((item.sources ?? []).map((s) => s.documentNumber).filter((n): n is string => !!n)),
  ];
}

/**
 * What waits in the receiving zone, in the order it is worked through:
 * 1. parts with their own fixed location (they never go into a container),
 * 2. repair orders that already lie somewhere -- add to their containers,
 * 3. repair orders with nothing put away yet -- start a new container,
 * 4. free stock and other goods.
 */
function sectionsOf(items: ReceivingPendingItem[], orders: Record<string, RepairOrderInfo>) {
  const fixed = new Map<
    string,
    {
      location: NonNullable<ReceivingPendingItem["defaultLocation"]>;
      items: ReceivingPendingItem[];
    }
  >();
  const byOrder = new Map<string, OrderGroup>();
  const loose: ReceivingPendingItem[] = [];

  for (const item of items) {
    if (isContainerPart(item) && item.repairOrderId) {
      const info = orders[item.repairOrderId];
      const group = byOrder.get(item.repairOrderId) ?? {
        id: item.repairOrderId,
        zlNumber: info?.zlNumber ?? item.zlNumber ?? "—",
        brand: info?.vehicleBrand ?? item.vehicleBrand,
        info,
        items: [],
        containers: (info?.containers ?? []).filter((c) => c.status === "active" && !!c.location),
      };
      group.items.push(item);
      byOrder.set(item.repairOrderId, group);
    } else if (item.defaultLocation) {
      const entry = fixed.get(item.defaultLocation.id) ?? {
        location: item.defaultLocation,
        items: [],
      };
      entry.items.push(item);
      fixed.set(item.defaultLocation.id, entry);
    } else {
      loose.push(item);
    }
  }

  const groups = [...byOrder.values()];
  const placed = (g: OrderGroup) =>
    g.containers.length > 0 || (g.info?.looseLocations?.length ?? 0) > 0;
  return {
    fixed: [...fixed.values()].sort((a, b) =>
      (a.location.code ?? "").localeCompare(b.location.code ?? "", "pl", { numeric: true })
    ),
    placedOrders: groups.filter(placed),
    newOrders: groups.filter((g) => !placed(g)),
    loose,
  };
}

export function PutawayBoard({
  organizationId,
  branchId,
  receivingLocationId,
  items,
  loadError,
  canOperate,
  orders = {},
  qrCodes = [],
}: Props) {
  const t = useTranslations("modules.warehouse.putaway");
  const [active, setActive] = useState<ReceivingPendingItem | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStep, setScanStep] = useState<ScanFlowStep | undefined>(undefined);
  const [scanSession, setScanSession] = useState(0);
  const [openOrders, setOpenOrders] = useState<Set<string>>(() => new Set());
  const [document, setDocument] = useState<string | null>(null);
  const scanIndex = useScanIndex({ qrCodes, organizationId, branchId, orders });
  // Loaded with the screen, so a scanned location is known the moment it is read.
  useWarehouseLocationsQuery(branchId);

  const openScan = (step?: ScanFlowStep) => {
    unlockScanSound();
    setScanStep(step);
    setScanSession((n) => n + 1);
    setScanOpen(true);
  };

  const documents = useMemo(
    () => [...new Set(items.flatMap(documentNumbers))].sort().reverse(),
    [items]
  );
  const shown = document ? items.filter((i) => documentNumbers(i).includes(document)) : items;
  const sections = useMemo(() => sectionsOf(shown, orders), [shown, orders]);

  const toggleOrder = (id: string) =>
    setOpenOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ready = !loadError && !!receivingLocationId;

  function itemRow(
    item: ReceivingPendingItem,
    options: { action?: string; showOrder?: boolean } = {}
  ) {
    const docs = documentNumbers(item);
    const meta = [
      options.showOrder && item.zlNumber ? `ZL ${item.zlNumber}` : null,
      docs.length > 0 ? docs.join(", ") : null,
    ].filter(Boolean);
    return (
      <div
        key={itemKey(item)}
        className="flex items-center justify-between gap-3 py-2"
        data-testid="putaway-item"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="mr-1.5 font-mono font-semibold">{item.sku ?? "—"}</span>
            {item.productName ?? ""}
          </p>
          {meta.length > 0 && (
            <p className="text-muted-foreground truncate text-xs" data-testid="putaway-item-meta">
              {meta.join(" · ")}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold">
          {formatQty(item.quantity)} {item.unitCode ?? ""}
        </span>
        {options.action && canOperate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 shrink-0"
            onClick={() => setActive(item)}
            data-testid="putaway-open"
          >
            {options.action}
          </Button>
        )}
      </div>
    );
  }

  function sectionTitle(icon: React.ReactNode, title: string, hint: string, testId: string) {
    return (
      <div data-testid={testId}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    );
  }

  function orderCard(group: OrderGroup, isNew: boolean) {
    const open = openOrders.has(group.id);
    const loose = group.info?.looseLocations ?? [];
    const newStep = {
      kind: "new" as const,
      qrCodeId: null,
      location: null,
      repairOrderId: group.id,
    };
    return (
      <div key={group.id} className="bg-card rounded-lg border" data-testid="putaway-order">
        <button
          type="button"
          onClick={() => toggleOrder(group.id)}
          aria-expanded={open}
          className="flex w-full items-start gap-2 p-3 text-left"
          data-testid="putaway-order-toggle"
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">ZL {group.zlNumber}</p>
            {(group.info?.clientName || group.brand) && (
              <p className="text-muted-foreground truncate text-xs">
                {[group.info?.clientName, group.brand].filter(Boolean).join(" · ")}
              </p>
            )}
            {(group.containers.length > 0 || loose.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1" data-testid="putaway-order-places">
                {group.containers.map((c) => (
                  <Badge key={c.id} variant="outline" className="gap-1 font-mono text-[11px]">
                    <Box className="h-3 w-3" />
                    {c.code}
                    {c.location ? ` · ${c.location.code ?? c.location.name ?? ""}` : ""}
                  </Badge>
                ))}
                {loose.map((l) => (
                  <Badge key={l.id} variant="outline" className="gap-1 font-mono text-[11px]">
                    <MapPin className="h-3 w-3" />
                    {l.code ?? l.name ?? "—"}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {t("board.waiting", { count: group.items.length })}
          </Badge>
        </button>

        {open && (
          <div className="border-t px-3 pb-3" data-testid="putaway-order-parts">
            <div className="divide-y">{group.items.map((item) => itemRow(item))}</div>
            {canOperate && (
              <div className="mt-2 flex flex-col gap-2">
                {group.containers.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    className="h-11 justify-start"
                    onClick={() =>
                      openScan({
                        kind: "container",
                        container: {
                          id: c.id,
                          code: c.code,
                          status: c.status,
                          location: c.location,
                          repairOrderId: group.id,
                          zlNumber: group.info?.zlNumber ?? group.zlNumber,
                          clientName: group.info?.clientName ?? null,
                          vehicleBrand: group.brand,
                        },
                      })
                    }
                    data-testid="putaway-order-add"
                  >
                    <Box className="mr-2 h-4 w-4" />
                    {t("board.addTo", {
                      code: c.code,
                      location: c.location ? (c.location.code ?? c.location.name ?? "") : "",
                    })}
                  </Button>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={isNew ? "default" : "outline"}
                    className="h-11"
                    onClick={() => openScan({ kind: "scanSticker", back: newStep })}
                    data-testid="putaway-order-new"
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    {t("board.newContainer")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => openScan(newStep)}
                    data-testid="putaway-order-oversize"
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {t("board.oversize")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col" data-testid="putaway-board">
      <div className="flex flex-col gap-5 p-4 pb-28 sm:p-6 sm:pb-28">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {ready && items.length > 0 && (
              <p className="text-sm font-medium" data-testid="putaway-summary">
                {t("summary", { count: items.length })}
              </p>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
            <Link href="/dashboard/warehouse/putaway/changes" data-testid="putaway-history-link">
              <History className="mr-1.5 h-4 w-4" />
              {t("board.history")}
            </Link>
          </Button>
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
            {documents.length > 1 && (
              <div className="-mt-2 flex flex-wrap gap-1.5" data-testid="putaway-documents">
                {[null, ...documents].map((number) => (
                  <button
                    key={number ?? "all"}
                    type="button"
                    onClick={() => setDocument(number)}
                    className={cn(
                      "rounded-full border px-3 py-1 font-mono text-xs",
                      document === number
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground"
                    )}
                    data-testid="putaway-document-filter"
                  >
                    {number ?? t("board.allDeliveries")}
                  </button>
                ))}
              </div>
            )}
            {documents.length === 1 && (
              <p className="text-muted-foreground -mt-4 font-mono text-xs">
                {t("board.from", { document: documents[0] })}
              </p>
            )}

            {sections.fixed.length > 0 && (
              <section className="flex flex-col gap-2" data-testid="putaway-section-fixed">
                {sectionTitle(
                  <MapPin className="text-muted-foreground h-4 w-4" />,
                  t("board.fixedTitle"),
                  t("board.fixedHint"),
                  "putaway-section-fixed-title"
                )}
                {sections.fixed.map(({ location, items: list }) => (
                  <div key={location.id} className="bg-card rounded-lg border px-3 py-1">
                    <p className="flex items-center gap-1.5 pt-2 text-xs font-semibold">
                      <MapPin className="h-3.5 w-3.5" />
                      {locLabel(location.code, location.name)}
                    </p>
                    <div className="divide-y">
                      {list.map((item) =>
                        itemRow(item, { action: t("board.putOne"), showOrder: true })
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {sections.placedOrders.length > 0 && (
              <section className="flex flex-col gap-2" data-testid="putaway-section-placed">
                {sectionTitle(
                  <Wrench className="text-muted-foreground h-4 w-4" />,
                  t("board.placedTitle"),
                  t("board.placedHint"),
                  "putaway-section-placed-title"
                )}
                {sections.placedOrders.map((g) => orderCard(g, false))}
              </section>
            )}

            {sections.newOrders.length > 0 && (
              <section className="flex flex-col gap-2" data-testid="putaway-section-new">
                {sectionTitle(
                  <PackagePlus className="text-muted-foreground h-4 w-4" />,
                  t("board.newTitle"),
                  t("board.newHint"),
                  "putaway-section-new-title"
                )}
                {sections.newOrders.map((g) => orderCard(g, true))}
              </section>
            )}

            {sections.loose.length > 0 && (
              <section className="flex flex-col gap-2" data-testid="putaway-section-free">
                {sectionTitle(
                  <Package className="text-muted-foreground h-4 w-4" />,
                  t("board.freeTitle"),
                  t("board.freeHint"),
                  "putaway-section-free-title"
                )}
                <div className="bg-card divide-y rounded-lg border px-3">
                  {sections.loose.map((item) =>
                    itemRow(item, { action: t("putaway"), showOrder: true })
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {canOperate && ready && items.length > 0 && (
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
          scanIndex={scanIndex}
        />
      )}

      {active && (
        <PutawayDialog
          item={active}
          branchId={branchId}
          receivingLocationId={receivingLocationId}
          onClose={() => setActive(null)}
          lookupToken={scanIndex.lookupToken}
        />
      )}
    </div>
  );
}
