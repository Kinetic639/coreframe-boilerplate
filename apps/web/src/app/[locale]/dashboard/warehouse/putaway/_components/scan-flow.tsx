"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Box,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  PackagePlus,
  Search,
  Tag,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import { QrCameraScanner, type QrScanLookup } from "@/components/features/qr/qr-camera-scanner";
import {
  getLocationContentsAction,
  getScannedContainerAction,
  putawayBatchAction,
} from "@/app/actions/warehouse/putaway-scan";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import type {
  LocationContents,
  LocationRef,
  ScannedContainer,
} from "@/server/services/putaway-scan.service";
import { PartPicker, initialPick, pickedLines, type PickState } from "./part-picker";
import {
  formatQty,
  isContainerPart,
  isLoosePart,
  itemKey,
  locLabel,
  type RepairOrderInfo,
} from "./putaway-utils";

type Step =
  | { kind: "scan" }
  | { kind: "container"; container: ScannedContainer }
  | {
      kind: "new";
      qrCodeId: string | null;
      location: LocationRef | null;
      repairOrderId: string | null;
    }
  | { kind: "location"; contents: LocationContents }
  | { kind: "loose"; location: LocationRef }
  | { kind: "scanLocation"; back: Extract<Step, { kind: "new" }> }
  | { kind: "scanSticker"; back: Extract<Step, { kind: "new" }> }
  /** Putting away one order's part from the list: pick its container. */
  | { kind: "order"; repairOrderId: string; focusKey: string | null };

export type ScanFlowStep = Step;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  receivingLocationId: string | null;
  items: ReceivingPendingItem[];
  orders: Record<string, RepairOrderInfo>;
  /** Open straight into a step (e.g. "new container" from the list). */
  initialStep?: Step;
};

const CONTAINER_TARGET = "inventory.container";
const LOCATION_TARGET = "warehouse.location";

function buzz() {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* not supported */
  }
}

/**
 * The scan-driven putaway, in a bottom sheet sized for a phone. One scan
 * decides the path: a repair-order container (add its order's parts), a
 * fresh sticker (new container: order -> parts -> location, location any
 * time) or a location (what lies there; add to a container, new container
 * here, or put loose items away). After each putaway the scanner reopens.
 */
export function ScanFlow({
  open,
  onOpenChange,
  branchId,
  receivingLocationId,
  items,
  orders,
  initialStep,
}: Props) {
  const t = useTranslations("modules.warehouse.putaway.scan");
  const tErr = useTranslations("modules.warehouse.putaway.scan.errors");
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep ?? { kind: "scan" });
  const [pick, setPick] = useState<PickState>(() => {
    if (initialStep?.kind !== "order" || !initialStep.focusKey) return {};
    const focused = items.find((i) => itemKey(i) === initialStep.focusKey);
    return focused ? { [initialStep.focusKey]: { checked: true, quantity: focused.quantity } } : {};
  });
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  // Bumped to remount the scanner (restart the camera) after a failed scan.
  const [scanAttempt, setScanAttempt] = useState(0);
  const retry = () => setScanAttempt((n) => n + 1);
  const locationsQuery = useWarehouseLocationsQuery(open ? branchId : null);
  const locations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (l) => l.can_store_inventory !== false && l.id !== receivingLocationId
      ),
    [locationsQuery.data, receivingLocationId]
  );

  const containerPartsByOrder = useMemo(() => {
    const map = new Map<string, ReceivingPendingItem[]>();
    for (const item of items) {
      if (!item.repairOrderId || !isContainerPart(item)) continue;
      const list = map.get(item.repairOrderId) ?? [];
      list.push(item);
      map.set(item.repairOrderId, list);
    }
    return map;
  }, [items]);
  const looseParts = useMemo(() => items.filter(isLoosePart), [items]);

  const goScan = () => {
    setPick({});
    setQuery("");
    setStep({ kind: "scan" });
  };

  const startNew = (patch: Partial<Extract<Step, { kind: "new" }>> = {}) => {
    const orderIds = [...containerPartsByOrder.keys()];
    const only = orderIds.length === 1 ? orderIds[0] : null;
    const next = {
      kind: "new" as const,
      qrCodeId: null,
      location: null,
      repairOrderId: only,
      ...patch,
    };
    setPick({});
    setQuery("");
    setStep(next);
  };

  const openContainer = (container: ScannedContainer) => {
    setPick(initialPick(containerPartsByOrder.get(container.repairOrderId) ?? [], true));
    setStep({ kind: "container", container });
  };

  const openLoose = (location: LocationRef) => {
    // Bulk material whose fixed bin is this location comes preselected.
    setPick(
      Object.fromEntries(
        looseParts.map((i) => [
          itemKey(i),
          { checked: i.defaultLocation?.id === location.id, quantity: i.quantity },
        ])
      )
    );
    setStep({ kind: "loose", location });
  };

  async function handleStartScan(lookup: QrScanLookup): Promise<string | null> {
    buzz();
    const target = lookup.assignment;
    if (!target) {
      startNew({ qrCodeId: lookup.id });
      return null;
    }
    if (target.target_type === CONTAINER_TARGET) {
      const res = await getScannedContainerAction(target.target_id);
      if (!res.success) return tErr("unexpected");
      if (!res.data) return t("containerNotHere");
      openContainer(res.data);
      return null;
    }
    if (target.target_type === LOCATION_TARGET) {
      if (target.target_id === receivingLocationId) return t("scanIsReceiving");
      const res = await getLocationContentsAction(target.target_id);
      if (!res.success) return tErr("unexpected");
      if (!res.data) return t("locationNotHere");
      setStep({ kind: "location", contents: res.data });
      return null;
    }
    return t("unknownCode");
  }

  async function handleLocationScan(
    back: Extract<Step, { kind: "new" }>,
    lookup: QrScanLookup
  ): Promise<string | null> {
    buzz();
    if (lookup.assignment?.target_type !== LOCATION_TARGET) return t("scanNotLocation");
    if (lookup.assignment.target_id === receivingLocationId) return t("scanIsReceiving");
    const match = locations.find((l) => l.id === lookup.assignment?.target_id);
    if (!match) return t("locationNotHere");
    setStep({ ...back, location: { id: match.id, code: match.code ?? null, name: match.name } });
    return null;
  }

  async function handleStickerScan(
    back: Extract<Step, { kind: "new" }>,
    lookup: QrScanLookup
  ): Promise<string | null> {
    buzz();
    if (lookup.assignment) return t("stickerTaken");
    setStep({ ...back, qrCodeId: lookup.id });
    return null;
  }

  async function submit(input: {
    locationId: string | null;
    containerId: string | null;
    newContainerRepairOrderId: string | null;
    qrCodeId?: string | null;
    sourceItems: ReceivingPendingItem[];
  }) {
    const lines = pickedLines(input.sourceItems, pick);
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const { sourceItems: _items, ...target } = input;
      void _items;
      const result = await putawayBatchAction({ ...target, lines });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      const data = result.data;
      if (data.containerCreated) {
        toast.success(t("doneNew", { code: data.containerCode ?? "", count: data.lineCount }));
        if (data.qrAssigned === false) toast.warning(t("stickerNotBound"));
      } else if (data.containerCode) {
        toast.success(t("doneContainer", { code: data.containerCode, count: data.lineCount }));
      } else {
        toast.success(t("doneLoose", { count: data.lineCount }));
      }
      router.refresh();
      goScan();
    } catch {
      toast.error(tErr("unexpected"));
    } finally {
      setBusy(false);
    }
  }

  const footer = (label: string, disabled: boolean, onClick: () => void, testId: string) => (
    <div className="bg-background border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Button
        type="button"
        className="h-14 w-full text-base"
        disabled={disabled || busy}
        onClick={onClick}
        data-testid={testId}
      >
        {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {label}
      </Button>
    </div>
  );

  const backButton = (onClick: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-9 self-start"
      onClick={onClick}
    >
      <ArrowLeft className="mr-1 h-4 w-4" />
      {t("back")}
    </Button>
  );

  let title = t("title");
  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (step.kind === "scan") {
    body = (
      <div className="flex flex-col gap-3 p-4">
        <QrCameraScanner
          key={scanAttempt}
          onRetry={retry}
          onScanned={handleStartScan}
          onBack={() => onOpenChange(false)}
          backLabel={t("close")}
          hintLabel={t("scanHint")}
        />
        <p className="text-muted-foreground text-center text-xs">{t("scanExplain")}</p>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => startNew()}
          disabled={containerPartsByOrder.size === 0}
          data-testid="scan-flow-new-without-sticker"
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          {t("newWithoutScan")}
        </Button>
      </div>
    );
  } else if (step.kind === "scanLocation" || step.kind === "scanSticker") {
    const back = step.back;
    title = step.kind === "scanLocation" ? t("scanLocationTitle") : t("scanStickerTitle");
    body = (
      <div className="p-4">
        <QrCameraScanner
          key={scanAttempt}
          onRetry={retry}
          onScanned={(lookup) =>
            step.kind === "scanLocation"
              ? handleLocationScan(back, lookup)
              : handleStickerScan(back, lookup)
          }
          onBack={() => setStep(back)}
          backLabel={t("back")}
          hintLabel={step.kind === "scanLocation" ? t("scanLocationHint") : t("scanStickerHint")}
        />
      </div>
    );
  } else if (step.kind === "order") {
    const s = step;
    const info = orders[s.repairOrderId];
    const containers = (info?.containers ?? []).filter((c) => !!c.location);
    const newStep = {
      kind: "new" as const,
      qrCodeId: null,
      location: null,
      repairOrderId: s.repairOrderId,
    };
    title = `ZL ${info?.zlNumber ?? containerPartsByOrder.get(s.repairOrderId)?.[0]?.zlNumber ?? "—"}`;
    body = (
      <div className="flex flex-col gap-4 p-4" data-testid="scan-flow-order-step">
        <p className="text-muted-foreground text-sm">
          {[info?.clientName, info?.vehicleBrand].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">{t("orderNeedsContainer")}</p>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t("orderContainers", { count: containers.length })}
          </h3>
          {containers.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("orderNoContainers")}</p>
          )}
          {containers.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{c.code}</p>
                <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {locLabel(c.location!.code, c.location!.name)}
                </p>
              </div>
              <Button
                type="button"
                className="h-11 shrink-0"
                onClick={() =>
                  openContainer({
                    id: c.id,
                    code: c.code,
                    status: c.status,
                    location: c.location,
                    repairOrderId: s.repairOrderId,
                    zlNumber: info?.zlNumber ?? null,
                    clientName: info?.clientName ?? null,
                    vehicleBrand: info?.vehicleBrand ?? null,
                  })
                }
                data-testid="scan-flow-order-add-to"
              >
                {t("addTo")}
              </Button>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <Button
            type="button"
            className="h-12"
            onClick={() => setStep({ kind: "scanSticker", back: newStep })}
            data-testid="scan-flow-order-new-sticker"
          >
            <Tag className="mr-2 h-4 w-4" />
            {t("newWithSticker")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => setStep(newStep)}
            data-testid="scan-flow-order-new-oversize"
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            {t("newOversize")}
          </Button>
        </section>
      </div>
    );
  } else if (step.kind === "container") {
    const c = step.container;
    const parts = containerPartsByOrder.get(c.repairOrderId) ?? [];
    title = c.code;
    body = (
      <div className="flex flex-col gap-3 p-4" data-testid="scan-flow-container">
        {backButton(goScan)}
        <div className="bg-muted/40 rounded-lg p-3 text-sm">
          <p className="font-mono font-semibold">ZL {c.zlNumber ?? "—"}</p>
          <p className="text-muted-foreground">
            {[c.clientName, c.vehicleBrand].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="mt-1 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {c.location ? locLabel(c.location.code, c.location.name) : t("noLocation")}
          </p>
        </div>
        {parts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            {t("orderDone")}
          </div>
        ) : (
          <PartPicker items={parts} pick={pick} onChange={setPick} />
        )}
      </div>
    );
    foot =
      parts.length === 0
        ? footer(t("scanNext"), false, goScan, "scan-flow-next")
        : footer(
            t("putIntoContainer", { count: pickedLines(parts, pick).length }),
            pickedLines(parts, pick).length === 0 || !c.location,
            () =>
              submit({
                locationId: null,
                containerId: c.id,
                newContainerRepairOrderId: null,
                sourceItems: parts,
              }),
            "scan-flow-confirm"
          );
  } else if (step.kind === "new") {
    const s = step;
    const order = s.repairOrderId ? orders[s.repairOrderId] : null;
    const parts = s.repairOrderId ? (containerPartsByOrder.get(s.repairOrderId) ?? []) : [];
    const q = query.trim().toLowerCase();
    const candidates = [...containerPartsByOrder.entries()]
      .map(([id, list]) => ({ id, list, info: orders[id] }))
      .filter(({ info, list }) => {
        if (!q) return true;
        const zl = (info?.zlNumber ?? list[0]?.zlNumber ?? "").toLowerCase();
        const digits = zl.replace(/\D/g, "");
        return (
          zl.includes(q) ||
          (/^\d+$/.test(q) && digits.includes(q.replace(/^0+/, ""))) ||
          (info?.clientName ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.list.length - a.list.length);
    const lines = pickedLines(parts, pick);
    title = t("newTitle");
    body = (
      <div className="flex flex-col gap-4 p-4" data-testid="scan-flow-new">
        {backButton(goScan)}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={s.qrCodeId ? "default" : "outline"} className="gap-1">
            <Tag className="h-3 w-3" />
            {s.qrCodeId ? t("stickerScanned") : t("noSticker")}
          </Badge>
          {!s.qrCodeId && (
            <button
              type="button"
              className="text-primary underline"
              onClick={() => setStep({ kind: "scanSticker", back: s })}
            >
              {t("scanSticker")}
            </button>
          )}
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("stepOrder")}</h3>
          {order || s.repairOrderId ? (
            <div className="border-primary bg-primary/5 flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">
                  ZL {order?.zlNumber ?? parts[0]?.zlNumber ?? "—"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {[order?.clientName, order?.vehicleBrand].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPick({});
                  setStep({ ...s, repairOrderId: null });
                }}
              >
                {t("change")}
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("orderSearch")}
                  className="h-12 pl-9 text-base"
                  autoFocus
                  data-testid="scan-flow-order-search"
                />
              </div>
              <div className="flex flex-col gap-2">
                {candidates.map(({ id, list, info }) => (
                  <button
                    type="button"
                    key={id}
                    className="bg-card hover:bg-muted flex min-h-14 items-center justify-between gap-3 rounded-lg border p-3 text-left"
                    onClick={() => {
                      setPick(initialPick(list, false));
                      setStep({ ...s, repairOrderId: id });
                    }}
                    data-testid="scan-flow-order"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm font-semibold">
                        ZL {info?.zlNumber ?? list[0]?.zlNumber ?? "—"}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[info?.clientName, info?.vehicleBrand].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Badge variant="secondary">{t("partsCount", { count: list.length })}</Badge>
                  </button>
                ))}
                {candidates.length === 0 && (
                  <p className="text-muted-foreground py-4 text-center text-sm">{t("noOrders")}</p>
                )}
              </div>
            </>
          )}
        </section>

        {s.repairOrderId && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("stepParts")}</h3>
            <PartPicker items={parts} pick={pick} onChange={setPick} />
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("stepLocation")}</h3>
          {s.location ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{locLabel(s.location.code, s.location.name)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep({ kind: "scanLocation", back: s })}
              >
                {t("change")}
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => setStep({ kind: "scanLocation", back: s })}
                data-testid="scan-flow-scan-location"
              >
                <Camera className="mr-2 h-4 w-4" />
                {t("scanLocation")}
              </Button>
              <select
                className="bg-background h-12 rounded-md border px-3 text-base"
                value=""
                onChange={(e) => {
                  const l = locations.find((x) => x.id === e.target.value);
                  if (l)
                    setStep({ ...s, location: { id: l.id, code: l.code ?? null, name: l.name } });
                }}
                aria-label={t("pickLocation")}
              >
                <option value="">{t("pickLocation")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locLabel(l.code, l.name)}
                  </option>
                ))}
              </select>
            </>
          )}
        </section>
      </div>
    );
    foot = footer(
      t("createContainer", { count: lines.length }),
      !s.repairOrderId || lines.length === 0 || !s.location,
      () =>
        submit({
          locationId: s.location!.id,
          containerId: null,
          newContainerRepairOrderId: s.repairOrderId,
          qrCodeId: s.qrCodeId,
          sourceItems: parts,
        }),
      "scan-flow-confirm"
    );
  } else if (step.kind === "location") {
    const { contents } = step;
    const loc = contents.location;
    title = locLabel(loc.code, loc.name);
    const hasLoosePending = looseParts.length > 0;
    body = (
      <div className="flex flex-col gap-4 p-4" data-testid="scan-flow-location">
        {backButton(goScan)}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-14 flex-col gap-0.5 text-sm"
            onClick={() => startNew({ location: loc })}
            disabled={containerPartsByOrder.size === 0}
            data-testid="scan-flow-new-here"
          >
            <PackagePlus className="h-5 w-5" />
            {t("newHere")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-col gap-0.5 text-sm"
            onClick={() => openLoose(loc)}
            disabled={!hasLoosePending}
            data-testid="scan-flow-loose"
          >
            <Box className="h-5 w-5" />
            {t("putLoose")}
          </Button>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t("containersHere", { count: contents.containers.length })}
          </h3>
          {contents.containers.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("noContainersHere")}</p>
          )}
          {contents.containers.map((c) => {
            const pending = containerPartsByOrder.get(c.repairOrderId)?.length ?? 0;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{c.code}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    ZL {c.zlNumber ?? "—"}
                    {c.clientName ? ` · ${c.clientName}` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("inside", { count: c.itemCount })}
                    {pending > 0 ? ` · ${t("waiting", { count: pending })}` : ""}
                  </p>
                </div>
                {pending > 0 && (
                  <Button
                    type="button"
                    className="h-11 shrink-0"
                    onClick={() =>
                      openContainer({
                        id: c.id,
                        code: c.code,
                        status: c.status,
                        location: loc,
                        repairOrderId: c.repairOrderId,
                        zlNumber: c.zlNumber,
                        clientName: c.clientName,
                        vehicleBrand: orders[c.repairOrderId]?.vehicleBrand ?? null,
                      })
                    }
                    data-testid="scan-flow-add-to"
                  >
                    {t("addTo")}
                  </Button>
                )}
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t("looseHere", { count: contents.loose.length })}
          </h3>
          {contents.loose.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("nothingLoose")}</p>
          )}
          {contents.loose.map((l) => (
            <div
              key={l.variantId}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{l.sku ?? "—"}</p>
                <p className="text-muted-foreground truncate text-xs">{l.productName ?? ""}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{formatQty(l.quantity)}</p>
                {l.reserved > 0 && (
                  <p className="text-muted-foreground text-[11px]">
                    {t("reservedQty", { qty: formatQty(l.reserved) })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  } else if (step.kind === "loose") {
    const loc = step.location;
    const lines = pickedLines(looseParts, pick);
    title = t("looseTitle");
    body = (
      <div className="flex flex-col gap-3 p-4" data-testid="scan-flow-loose-step">
        {backButton(goScan)}
        <p className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          {locLabel(loc.code, loc.name)}
        </p>
        <PartPicker
          items={[...looseParts].sort(
            (a, b) =>
              Number(b.defaultLocation?.id === loc.id) - Number(a.defaultLocation?.id === loc.id)
          )}
          pick={pick}
          onChange={setPick}
          hint={(item) => {
            if (item.defaultLocation?.id === loc.id) return t("fixedHere");
            if (item.handlingMode === "bulk" && item.defaultLocation)
              return t("fixedElsewhere", {
                location: locLabel(item.defaultLocation.code, item.defaultLocation.name),
              });
            return item.zlNumber ? `ZL ${item.zlNumber}` : null;
          }}
        />
      </div>
    );
    foot = footer(
      t("putLooseConfirm", { count: lines.length }),
      lines.length === 0,
      () =>
        submit({
          locationId: loc.id,
          containerId: null,
          newContainerRepairOrderId: null,
          sourceItems: looseParts,
        }),
      "scan-flow-confirm"
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) goScan();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle
            className={cn("truncate pr-8 text-base", step.kind === "container" && "font-mono")}
          >
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain">{body}</div>
        {foot}
      </SheetContent>
    </Sheet>
  );
}
