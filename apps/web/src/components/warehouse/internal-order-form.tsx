"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { InventoryItemPickerDialog } from "@/components/warehouse/inventory-item-picker-dialog";
import {
  createInternalOrderAction,
  listInternalOrderStockAction,
  type InternalOrderStockOptions,
} from "@/app/actions/warehouse/internal-orders";

/**
 * "Nowe ZW": an internal order made in Ambra -- from a repair order (its
 * positions, or a new part that becomes a position) or for another branch.
 * What is free in this branch can be reserved for each line straight away;
 * everything is one ZW and one REZ.
 */

export type InternalOrderPosition = {
  id: string;
  variantId: string | null;
  sku: string | null;
  productName: string;
};

type FormLine = {
  key: string;
  repairOrderLineId: string | null;
  variantId: string | null;
  code: string;
  name: string;
  quantity: number;
  reserveLocationId: string | null;
  reserveQuantity: number;
};

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

export function InternalOrderDialog({
  open,
  onOpenChange,
  repairOrderId = null,
  positions = [],
  warehouses = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set: a ZW of this repair order; null: a ZW for another branch / client. */
  repairOrderId?: string | null;
  positions?: InternalOrderPosition[];
  /** The branch's units (3112, 3142...): a ZW without a repair order is numbered in the chosen one. */
  warehouses?: Array<{ code: string; name: string | null }>;
}) {
  const t = useTranslations("modules.warehouse.internalOrders.form");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [externalNumber, setExternalNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [warehouseCode, setWarehouseCode] = useState(warehouses[0]?.code ?? "");
  const [lines, setLines] = useState<FormLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [stock, setStock] = useState<InternalOrderStockOptions["here"]>([]);

  const variantIds = useMemo(
    () => [...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v))].sort(),
    [lines]
  );
  const variantKey = variantIds.join(",");

  useEffect(() => {
    if (!open || variantIds.length === 0) return;
    let cancelled = false;
    void listInternalOrderStockAction({ variantIds }).then((result) => {
      if (cancelled || !result.success) return;
      setStock((result as { data: InternalOrderStockOptions }).data.here);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the variant list
  }, [open, variantKey]);

  const stockFor = (variantId: string | null) =>
    variantId ? stock.filter((s) => s.variantId === variantId && s.available > 0) : [];

  // A line with stock gets its best location pre-chosen (up to what is ordered).
  useEffect(() => {
    setLines((current) =>
      current.map((l) => {
        if (l.reserveLocationId || !l.variantId) return l;
        const best = stockFor(l.variantId)[0];
        return best
          ? {
              ...l,
              reserveLocationId: best.locationId,
              reserveQuantity: Math.min(l.quantity, best.available),
            }
          : l;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when stock arrives
  }, [stock]);

  const reset = () => {
    setExternalNumber("");
    setClientName("");
    setDestinationCode("");
    setLines([]);
    setPositionId("");
  };

  const addPosition = (id: string) => {
    const p = positions.find((x) => x.id === id);
    if (!p || lines.some((l) => l.repairOrderLineId === id)) return;
    setLines((current) => [
      ...current,
      {
        key: nextKey(),
        repairOrderLineId: p.id,
        variantId: p.variantId,
        code: p.sku ?? "",
        name: p.productName,
        quantity: 1,
        reserveLocationId: null,
        reserveQuantity: 0,
      },
    ]);
    setPositionId("");
  };

  const update = (key: string, patch: Partial<FormLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const standalone = !repairOrderId;
  const valid =
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && (l.variantId || l.code.trim() || l.name.trim())) &&
    (!standalone || clientName.trim() || destinationCode.trim());

  const submit = () =>
    startTransition(async () => {
      const result = await createInternalOrderAction({
        repairOrderId,
        externalNumber: externalNumber.trim() || null,
        clientName: standalone ? clientName.trim() || null : null,
        destinationCode: standalone ? destinationCode.trim() || null : null,
        warehouseCode: standalone ? warehouseCode || null : null,
        lines: lines.map((l) => ({
          repairOrderLineId: l.repairOrderLineId,
          variantId: l.variantId,
          productCode: l.code.trim() || null,
          productName: l.name.trim() || null,
          quantity: l.quantity,
          reserve:
            l.reserveLocationId && l.reserveQuantity > 0
              ? [
                  {
                    locationId: l.reserveLocationId,
                    quantity: Math.min(l.reserveQuantity, l.quantity),
                  },
                ]
              : [],
        })),
      });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      const data = (result as { data: { number: string; reservationNumber: string | null } }).data;
      toast.success(
        data.reservationNumber
          ? t("createdReserved", { number: data.number, reservation: data.reservationNumber })
          : t("created", { number: data.number })
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          data-testid="internal-order-dialog"
        >
          <DialogHeader>
            <DialogTitle>{standalone ? t("titleStandalone") : t("title")}</DialogTitle>
            <DialogDescription>
              {standalone ? t("descriptionStandalone") : t("description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1">
              <Label htmlFor="zw-external">{t("externalNumber")}</Label>
              <Input
                id="zw-external"
                value={externalNumber}
                onChange={(e) => setExternalNumber(e.target.value)}
                placeholder="ZW/1516/26/3332"
              />
            </div>
            {standalone && (
              <>
                {warehouses.length > 1 && (
                  <div className="grid gap-1">
                    <Label>{t("warehouse")}</Label>
                    <Select value={warehouseCode} onValueChange={setWarehouseCode}>
                      <SelectTrigger className="h-9" data-testid="zw-warehouse">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.code} value={w.code}>
                            {w.code}
                            {w.name ? ` · ${w.name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-1">
                  <Label htmlFor="zw-destination">{t("destinationCode")}</Label>
                  <Input
                    id="zw-destination"
                    value={destinationCode}
                    onChange={(e) => setDestinationCode(e.target.value)}
                    placeholder="WYSOG"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="zw-client">{t("client")}</Label>
                  <Input
                    id="zw-client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="3642 Blacharnia Audi"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {positions.length > 0 && (
              <Select value={positionId} onValueChange={addPosition}>
                <SelectTrigger className="h-9 w-full sm:w-72" data-testid="zw-add-position">
                  <SelectValue placeholder={t("addPosition")} />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku ? `${p.sku} · ` : ""}
                      {p.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("addFromCatalog")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: nextKey(),
                    repairOrderLineId: null,
                    variantId: null,
                    code: "",
                    name: "",
                    quantity: 1,
                    reserveLocationId: null,
                    reserveQuantity: 0,
                  },
                ])
              }
              data-testid="zw-add-free"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("addOutsideCatalog")}
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noLines")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-2 pl-3 font-medium">{t("part")}</th>
                    <th className="w-24 py-2 pr-2 font-medium">{t("quantity")}</th>
                    <th className="py-2 pr-2 font-medium">{t("reserveFrom")}</th>
                    <th className="w-24 py-2 pr-2 font-medium">{t("reserveQuantity")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const options = stockFor(l.variantId);
                    return (
                      <tr
                        key={l.key}
                        className="border-b last:border-b-0"
                        data-testid="zw-form-line"
                      >
                        <td className="py-1.5 pr-2 pl-3 align-top">
                          {l.variantId || l.repairOrderLineId ? (
                            <>
                              <div className="font-mono text-xs">{l.code || "—"}</div>
                              <div>{l.name}</div>
                            </>
                          ) : (
                            <div className="grid gap-1">
                              <Input
                                value={l.code}
                                onChange={(e) => update(l.key, { code: e.target.value })}
                                placeholder={t("code")}
                                className="h-8 font-mono text-xs"
                              />
                              <Input
                                value={l.name}
                                onChange={(e) => update(l.key, { name: e.target.value })}
                                placeholder={t("name")}
                                className="h-8"
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 align-top">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.quantity}
                            onChange={(e) => update(l.key, { quantity: Number(e.target.value) })}
                            className="h-8"
                            aria-label={t("quantity")}
                          />
                        </td>
                        <td className="py-1.5 pr-2 align-top">
                          {options.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                              {l.variantId ? t("noStock") : t("notInCatalog")}
                            </span>
                          ) : (
                            <Select
                              value={l.reserveLocationId ?? "none"}
                              onValueChange={(v) =>
                                update(l.key, {
                                  reserveLocationId: v === "none" ? null : v,
                                  reserveQuantity:
                                    v === "none"
                                      ? 0
                                      : Math.min(
                                          l.quantity,
                                          options.find((o) => o.locationId === v)?.available ?? 0
                                        ),
                                })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t("dontReserve")}</SelectItem>
                                {options.map((o) => (
                                  <SelectItem key={o.locationId} value={o.locationId}>
                                    {(o.locationCode ?? o.locationName ?? "—") +
                                      ` · ${fmt(o.available)}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 align-top">
                          {l.reserveLocationId && (
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={l.reserveQuantity}
                              onChange={(e) =>
                                update(l.key, { reserveQuantity: Number(e.target.value) })
                              }
                              className="h-8"
                              aria-label={t("reserveQuantity")}
                            />
                          )}
                        </td>
                        <td className="py-1.5 pr-2 align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setLines((current) => current.filter((x) => x.key !== l.key))
                            }
                            aria-label={t("remove")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!valid || isPending}
              data-testid="zw-submit"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventoryItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="allItems"
        onAddItems={(items) =>
          setLines((current) => [
            ...current,
            ...items.map((item) => ({
              key: nextKey(),
              repairOrderLineId: null,
              variantId: item.variant_id,
              code: item.sku,
              name: item.product_name,
              quantity: item.quantity > 0 ? item.quantity : 1,
              reserveLocationId: null,
              reserveQuantity: 0,
            })),
          ])
        }
      />
    </>
  );
}
