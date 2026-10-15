"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Inbox,
  MapPin,
  Package,
  ScanLine,
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
import { LocationChanges } from "./location-changes";
import {
  formatQty,
  isContainerPart,
  itemKey,
  locLabel,
  type RepairOrderInfo,
} from "./putaway-utils";

export { itemKey } from "./putaway-utils";

const UNKNOWN_DOCUMENT = "unknown";

type SourceDocument = {
  key: string;
  movementId: string | null;
  documentNumber: string | null;
  typeName: string | null;
  postedAt: string | null;
  externalReference: string | null;
  /** The document's share of each waiting item. */
  items: ReceivingPendingItem[];
};

/** The receiving zone per document that brought the stock in, newest first. */
function documentsOf(items: ReceivingPendingItem[]): SourceDocument[] {
  const byKey = new Map<string, SourceDocument>();
  for (const item of items) {
    const sources = item.sources?.length
      ? item.sources
      : [
          {
            movementId: null,
            documentNumber: null,
            movementTypeCode: null,
            movementTypeName: null,
            postedAt: null,
            externalReference: null,
            quantity: item.quantity,
          },
        ];
    for (const source of sources) {
      const key = source.movementId ?? UNKNOWN_DOCUMENT;
      const document = byKey.get(key) ?? {
        key,
        movementId: source.movementId,
        documentNumber: source.documentNumber,
        typeName: source.movementTypeName,
        postedAt: source.postedAt,
        externalReference: source.externalReference,
        items: [],
      };
      document.items.push({ ...item, quantity: source.quantity });
      byKey.set(key, document);
    }
  }
  return [...byKey.values()].sort((left, right) => {
    if (left.key === UNKNOWN_DOCUMENT) return 1;
    if (right.key === UNKNOWN_DOCUMENT) return -1;
    return (right.postedAt ?? "").localeCompare(left.postedAt ?? "");
  });
}

function groupItems(items: ReceivingPendingItem[]) {
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
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [view, setView] = useState<"documents" | "parts">("documents");
  const [documentKey, setDocumentKey] = useState<string | null>(null);

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

  const documents = useMemo(() => documentsOf(items), [items]);
  const openDocument = documents.find((document) => document.key === documentKey) ?? null;
  const documentTitle = (document: SourceDocument) =>
    document.key === UNKNOWN_DOCUMENT
      ? t("documents.unknown")
      : (document.documentNumber ?? document.typeName ?? "—");

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

  function renderGroups(list: ReceivingPendingItem[]) {
    const groups = groupItems(list);
    return (
      <>
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

            <div className="grid grid-cols-2 gap-1 rounded-lg border p-1" role="tablist">
              {(["documents", "parts"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => {
                    setView(key);
                    setDocumentKey(null);
                  }}
                  className={cn(
                    "h-9 rounded-md text-sm",
                    view === key ? "bg-muted font-medium" : "text-muted-foreground"
                  )}
                  data-testid={`putaway-view-${key}`}
                >
                  {t(`views.${key}`)}
                </button>
              ))}
            </div>

            {view === "parts" ? (
              renderGroups(items)
            ) : openDocument ? (
              <div className="flex flex-col gap-3" data-testid="putaway-document">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit -ml-2"
                  onClick={() => setDocumentKey(null)}
                  data-testid="putaway-document-back"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t("documents.back")}
                </Button>
                <div className="bg-card rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-semibold">
                        {documentTitle(openDocument)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {[openDocument.typeName, formatDate(openDocument.postedAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {openDocument.externalReference && (
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {t("documents.reference", {
                            reference: openDocument.externalReference,
                          })}
                        </p>
                      )}
                      {openDocument.key === UNKNOWN_DOCUMENT && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t("documents.unknownHint")}
                        </p>
                      )}
                    </div>
                    {openDocument.movementId && (
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                      >
                        <Link
                          href={{
                            pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
                            params: { movementId: openDocument.movementId },
                          }}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          {t("documents.open")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                {renderGroups(openDocument.items)}
              </div>
            ) : (
              <div className="flex flex-col gap-2" data-testid="putaway-documents">
                <p className="text-muted-foreground text-xs">
                  {t("documents.summary", { count: documents.length })}
                </p>
                {documents.map((document) => {
                  const zls = [
                    ...new Set(
                      document.items.map((item) => item.zlNumber).filter((zl): zl is string => !!zl)
                    ),
                  ];
                  const hasFree = document.items.some((item) => !item.repairOrderId);
                  return (
                    <button
                      key={document.key}
                      type="button"
                      onClick={() => setDocumentKey(document.key)}
                      className="bg-card hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 text-left"
                      data-testid="putaway-document-card"
                    >
                      <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-sm font-semibold">
                            {documentTitle(document)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {[document.typeName, formatDate(document.postedAt)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {[
                            zls.length > 0 ? t("documents.orders", { list: zls.join(", ") }) : null,
                            hasFree ? t("documents.free") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="secondary">
                          {t("documents.lines", { count: document.items.length })}
                        </Badge>
                        <ChevronRight className="text-muted-foreground h-4 w-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {canOperate && ready && tab === "pending" && items.length > 0 && (
        <Button
          type="button"
          size="icon"
          className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-16 w-16 rounded-full shadow-lg sm:right-6 sm:bottom-6"
          onClick={() => {
            // The tap that opens the sheet also unlocks scan sounds on iOS.
            unlockScanSound();
            openScan();
          }}
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
