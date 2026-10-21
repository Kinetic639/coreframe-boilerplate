"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Ban, BookmarkCheck, Building2, Hash, Loader2, Send } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelInternalOrderLineAction,
  listInternalOrderStockAction,
  requestInternalOrderFromBranchAction,
  reserveInternalOrderFromStockAction,
  setInternalOrderExternalNumberAction,
  type InternalOrderStockOptions,
} from "@/app/actions/warehouse/internal-orders";
import type { InternalOrderView } from "@/server/services/internal-orders.service";
import { ShipInternalOrderDialog } from "./ship-internal-order-dialog";

type Dialogs = "number" | "reserve" | "elsewhere" | "cancel" | "ship" | null;

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Operations on one ZW: the AutoStacja number, reservations, cancelling a line, shipping. */
export function InternalOrderActions({
  order,
  canOperate,
  branches = [],
}: {
  order: InternalOrderView;
  canOperate: boolean;
  /** Other branches of the organization (ship to / reserve at). */
  branches?: Array<{ id: string; name: string; externalCodes: string[] }>;
}) {
  const t = useTranslations("modules.warehouse.internalOrders.actions");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [isPending, startTransition] = useTransition();
  const [externalNumber, setExternalNumber] = useState("");
  const [cancelLineId, setCancelLineId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [stock, setStock] = useState<InternalOrderStockOptions | null>(null);
  const [picks, setPicks] = useState<Record<string, { locationId: string; quantity: number }>>({});
  const [sourceBranchId, setSourceBranchId] = useState("");

  const open = order.status === "open";
  const openLines = order.lines.filter((l) => !l.cancelledAt);
  const needing = openLines.filter(
    (l) => l.variantId && l.quantity - l.reservedQuantity - l.issuedQuantity > 1e-9
  );
  const shippable =
    !order.repairOrderId && order.lines.some((l) => !l.cancelledAt && l.reservedQuantity > 0);

  const variantIds = useMemo(
    () => [...new Set(needing.map((l) => l.variantId!))].sort(),
    [needing]
  );
  const variantKey = variantIds.join(",");

  useEffect(() => {
    if ((dialog !== "reserve" && dialog !== "elsewhere") || variantIds.length === 0) return;
    let cancelled = false;
    setStock(null);
    setPicks({});
    void listInternalOrderStockAction({ variantIds }).then((result) => {
      if (!cancelled && result.success)
        setStock((result as { data: InternalOrderStockOptions }).data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the variant list
  }, [dialog, variantKey]);

  if (!canOperate || !open) return null;

  const fail = (result: unknown) => {
    const code = (result as { error?: string }).error ?? "unexpected";
    toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
  };
  const done = (message: string) => {
    toast.success(message);
    setDialog(null);
    router.refresh();
  };

  const optionsFor = (variantId: string) => {
    if (!stock) return [];
    if (dialog === "elsewhere") {
      return stock.elsewhere
        .filter((s) => s.variantId === variantId && s.branchId === sourceBranchId)
        .map((s) => ({
          locationId: s.locationId,
          label: `${s.locationCode ?? s.locationName ?? "—"} · ${fmt(s.available)}`,
          available: s.available,
        }));
    }
    return stock.here
      .filter((s) => s.variantId === variantId)
      .map((s) => ({
        locationId: s.locationId,
        label: `${s.locationCode ?? s.locationName ?? "—"} · ${fmt(s.available)}`,
        available: s.available,
      }));
  };
  const elsewhereBranches = stock
    ? [...new Map(stock.elsewhere.map((s) => [s.branchId, s.branchName])).entries()]
    : [];

  const reserveLines = Object.entries(picks)
    .filter(([, p]) => p.locationId && p.quantity > 0)
    .map(([internalOrderLineId, p]) => ({
      internalOrderLineId,
      locationId: p.locationId,
      quantity: p.quantity,
    }));

  const submitReserve = () =>
    startTransition(async () => {
      const result =
        dialog === "elsewhere"
          ? await requestInternalOrderFromBranchAction({
              internalOrderId: order.id,
              sourceBranchId,
              lines: reserveLines,
            })
          : await reserveInternalOrderFromStockAction({
              internalOrderId: order.id,
              lines: reserveLines,
            });
      if (!result.success) return fail(result);
      const data = (
        result as { data: { reservationNumber?: string | null; transferNumber?: string } }
      ).data;
      done(
        dialog === "elsewhere"
          ? t("requested", { number: data.transferNumber ?? "" })
          : t("reserved", { number: data.reservationNumber ?? "" })
      );
    });

  return (
    <div className="flex flex-wrap gap-2" data-testid="internal-order-actions">
      {!order.externalNumber && (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog("number")}>
          <Hash className="mr-1.5 h-4 w-4" />
          {t("setNumber")}
        </Button>
      )}
      {needing.length > 0 && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialog("reserve")}
            data-testid="zw-reserve"
          >
            <BookmarkCheck className="mr-1.5 h-4 w-4" />
            {t("reserve")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialog("elsewhere")}
            data-testid="zw-elsewhere"
          >
            <Building2 className="mr-1.5 h-4 w-4" />
            {t("reserveElsewhere")}
          </Button>
        </>
      )}
      {openLines.length > 0 && (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog("cancel")}>
          <Ban className="mr-1.5 h-4 w-4" />
          {t("cancelLine")}
        </Button>
      )}
      {shippable && (
        <Button type="button" size="sm" onClick={() => setDialog("ship")} data-testid="zw-ship">
          <Send className="mr-1.5 h-4 w-4" />
          {t("ship")}
        </Button>
      )}

      <Dialog open={dialog === "number"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("setNumber")}</DialogTitle>
            <DialogDescription>{t("setNumberHint")}</DialogDescription>
          </DialogHeader>
          <Input
            value={externalNumber}
            onChange={(e) => setExternalNumber(e.target.value)}
            placeholder="ZW/1516/26/3332"
          />
          <DialogFooter>
            <Button
              type="button"
              disabled={!externalNumber.trim() || isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setInternalOrderExternalNumberAction({
                    internalOrderId: order.id,
                    externalNumber,
                  });
                  if (!result.success) return fail(result);
                  done(t("numberSet"));
                })
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "reserve" || dialog === "elsewhere"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog === "elsewhere" ? t("reserveElsewhere") : t("reserve")}
            </DialogTitle>
            <DialogDescription>
              {dialog === "elsewhere" ? t("reserveElsewhereHint") : t("reserveHint")}
            </DialogDescription>
          </DialogHeader>
          {!stock ? (
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          ) : (
            <div className="grid gap-3">
              {dialog === "elsewhere" && (
                <div className="grid gap-1">
                  <Label>{t("branch")}</Label>
                  {elsewhereBranches.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("noStockElsewhere")}</p>
                  ) : (
                    <Select
                      value={sourceBranchId}
                      onValueChange={(v) => {
                        setSourceBranchId(v);
                        setPicks({});
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t("pickBranch")} />
                      </SelectTrigger>
                      <SelectContent>
                        {elsewhereBranches.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {(dialog === "reserve" || sourceBranchId) && (
                <div className="divide-y rounded-md border">
                  {needing.map((l) => {
                    const options = optionsFor(l.variantId!);
                    const need = l.quantity - l.reservedQuantity - l.issuedQuantity;
                    const pick = picks[l.id];
                    return (
                      <div
                        key={l.id}
                        className="grid gap-2 p-3 sm:grid-cols-[1fr_12rem_6rem] sm:items-center"
                      >
                        <div className="min-w-0 text-sm">
                          <span className="mr-1.5 font-mono text-xs">{l.productCode ?? "—"}</span>
                          {l.productName}
                          <p className="text-muted-foreground text-xs">
                            {t("needed", { count: fmt(need) })}
                          </p>
                        </div>
                        {options.length === 0 ? (
                          <span className="text-muted-foreground text-xs sm:col-span-2">
                            {t("noStock")}
                          </span>
                        ) : (
                          <>
                            <Select
                              value={pick?.locationId ?? ""}
                              onValueChange={(v) =>
                                setPicks((current) => ({
                                  ...current,
                                  [l.id]: {
                                    locationId: v,
                                    quantity: Math.min(
                                      need,
                                      options.find((o) => o.locationId === v)?.available ?? 0
                                    ),
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder={t("from")} />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((o) => (
                                  <SelectItem key={o.locationId} value={o.locationId}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className="h-8"
                              value={pick?.quantity ?? 0}
                              disabled={!pick}
                              onChange={(e) =>
                                setPicks((current) => ({
                                  ...current,
                                  [l.id]: {
                                    locationId: pick!.locationId,
                                    quantity: Number(e.target.value),
                                  },
                                }))
                              }
                              aria-label={t("quantity")}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              disabled={
                reserveLines.length === 0 ||
                isPending ||
                (dialog === "elsewhere" && !sourceBranchId)
              }
              onClick={submitReserve}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === "elsewhere" ? t("requestConfirm") : t("reserveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelLine")}</DialogTitle>
            <DialogDescription>{t("cancelHint")}</DialogDescription>
          </DialogHeader>
          <Select value={cancelLineId} onValueChange={setCancelLineId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("pickLine")} />
            </SelectTrigger>
            <SelectContent>
              {openLines.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.lineNumber}. {l.productCode ? `${l.productCode} · ` : ""}
                  {l.productName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t("reason")}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={!cancelLineId || !cancelReason.trim() || isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelInternalOrderLineAction({
                    internalOrderLineId: cancelLineId,
                    reason: cancelReason,
                  });
                  if (!result.success) return fail(result);
                  setCancelLineId("");
                  setCancelReason("");
                  done(t("cancelled"));
                })
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog === "ship" && (
        <ShipInternalOrderDialog
          order={{
            id: order.id,
            number: order.number,
            destinationCode: order.destinationCode,
            clientName: order.clientName,
          }}
          branches={branches}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
