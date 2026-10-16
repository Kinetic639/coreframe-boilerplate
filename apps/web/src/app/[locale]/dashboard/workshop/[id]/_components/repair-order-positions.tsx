"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { BookmarkCheck, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReservationLinesTable } from "@/components/warehouse/stock-commitments";
import { reserveForRepairOrderAction } from "@/app/actions/warehouse/reservations";
import type { ReservationLineView } from "@/server/services/inventory-reservations.service";

/**
 * "Pozycje" of a repair order (stage E7): one row per part -- needed,
 * reserved (R, incl. in containers), issued, missing, where it lies and its
 * state; the row opens its reservations with their operations. "Zarezerwuj
 * z magazynu" reserves the missing parts from D in one document.
 */

export type PositionLine = {
  id: string;
  variantId: string | null;
  sku: string | null;
  productName: string;
  orderedQuantity: number;
  unit: string | null;
};

export type AvailableStock = {
  variantId: string;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  available: number;
};

type Status = "missing" | "partial" | "reserved_receiving" | "reserved" | "in_container" | "issued";

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function locLabel(code: string | null, name: string | null) {
  if (code && name) return `${code} · ${name}`;
  return code ?? name ?? "—";
}

/** Per line: R, issued, missing, where, state. */
export function summarizeLine(
  line: PositionLine,
  reservations: ReservationLineView[],
  issued: number
) {
  const own = reservations.filter((r) => r.repairOrderLineId === line.id);
  const reserved = own.reduce((sum, r) => sum + r.openQuantity + r.allocatedQuantity, 0);
  const inContainer = own.reduce((sum, r) => sum + r.allocatedQuantity, 0);
  const inReceiving = own
    .filter((r) => r.locationPurpose === "receiving")
    .reduce((sum, r) => sum + r.openQuantity, 0);
  const missing = Math.max(line.orderedQuantity - reserved - issued, 0);
  const places = [...new Set(own.map((r) => locLabel(r.locationCode, r.locationName)))];
  let status: Status;
  if (issued >= line.orderedQuantity) status = "issued";
  else if (missing > 0) status = reserved > 0 || issued > 0 ? "partial" : "missing";
  else if (reserved > 0 && inContainer >= reserved) status = "in_container";
  else if (inReceiving > 0) status = "reserved_receiving";
  else status = "reserved";
  return { own, reserved, inContainer, issued, missing, places, status };
}

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  missing: "destructive",
  partial: "outline",
  reserved_receiving: "secondary",
  reserved: "secondary",
  in_container: "default",
  issued: "default",
};

export function RepairOrderPositions({
  repairOrderId,
  lines,
  issuedByLine,
  reservations,
  available,
  canOperate,
  loadError,
}: {
  repairOrderId: string;
  lines: PositionLine[];
  issuedByLine: Record<string, number>;
  reservations: ReservationLineView[];
  available: AvailableStock[];
  canOperate: boolean;
  loadError: boolean;
}) {
  const t = useTranslations("modules.workshop.repairOrders.stock");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reserving, setReserving] = useState(false);

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        line,
        ...summarizeLine(line, reservations, issuedByLine[line.id] ?? 0),
      })),
    [lines, reservations, issuedByLine]
  );
  const missingLines = rows.filter((r) => r.missing > 0).length;
  const reservable = rows.filter(
    (r) =>
      r.missing > 0 &&
      r.line.variantId &&
      available.some((a) => a.variantId === r.line.variantId && a.available > 0)
  );

  if (loadError) return <p className="text-sm text-destructive">{t("positions.loadError")}</p>;
  if (lines.length === 0)
    return <p className="text-sm text-muted-foreground">{t("positions.empty")}</p>;

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="grid gap-3" data-testid="repair-order-positions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{t("positions.title")}</h2>
          {missingLines === 0 ? (
            <Badge data-testid="positions-complete">{t("positions.complete")}</Badge>
          ) : (
            <Badge variant="outline" data-testid="positions-incomplete">
              {t("positions.incomplete", { count: missingLines })}
            </Badge>
          )}
        </div>
        {canOperate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReserving(true)}
            disabled={reservable.length === 0}
            data-testid="positions-reserve"
          >
            <BookmarkCheck className="mr-2 h-4 w-4" />
            {t("reserve.button")}
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="w-8 py-2 pl-2" />
              <th className="py-2 pr-3 font-medium">{t("positions.part")}</th>
              <th className="py-2 pr-3 text-right font-medium">{t("positions.needed")}</th>
              <th className="py-2 pr-3 text-right font-medium">{t("positions.reserved")}</th>
              <th className="py-2 pr-3 text-right font-medium">{t("positions.issued")}</th>
              <th className="py-2 pr-3 text-right font-medium">{t("positions.missing")}</th>
              <th className="py-2 pr-3 font-medium">{t("positions.where")}</th>
              <th className="py-2 pr-3 font-medium">{t("positions.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = open.has(row.line.id);
              return (
                <Fragment key={row.line.id}>
                  <tr className="border-b last:border-b-0" data-testid="position-row">
                    <td className="py-2 pl-2 align-top">
                      {row.own.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={
                            expanded
                              ? t("positions.hideReservations")
                              : t("positions.showReservations")
                          }
                          onClick={() => toggle(row.line.id)}
                          data-testid="position-toggle"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <div className="font-mono text-xs">{row.line.sku ?? "—"}</div>
                      <div>{row.line.productName}</div>
                      {!row.line.variantId ? (
                        <div className="text-xs text-muted-foreground">
                          {t("positions.noCatalogItem")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right align-top tabular-nums">
                      {fmt(row.line.orderedQuantity)} {row.line.unit ?? ""}
                    </td>
                    <td className="py-2 pr-3 text-right align-top tabular-nums">
                      {fmt(row.reserved)}
                    </td>
                    <td className="py-2 pr-3 text-right align-top tabular-nums">
                      {fmt(row.issued)}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right align-top tabular-nums ${row.missing > 0 ? "font-semibold text-destructive" : ""}`}
                    >
                      {fmt(row.missing)}
                    </td>
                    <td className="py-2 pr-3 align-top text-xs">
                      {row.places.length > 0 ? row.places.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Badge variant={STATUS_VARIANT[row.status]} data-testid="position-status">
                        {t(`positions.statuses.${row.status}`)}
                      </Badge>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b bg-muted/10">
                      <td />
                      <td colSpan={7} className="py-2 pr-3">
                        <ReservationLinesTable
                          lines={row.own}
                          canOperate={canOperate}
                          showPart={false}
                          showOrder={false}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {reserving ? (
        <ReserveFromStockDialog
          repairOrderId={repairOrderId}
          rows={reservable.map((r) => ({ line: r.line, missing: r.missing }))}
          available={available}
          onClose={() => setReserving(false)}
        />
      ) : null}
    </section>
  );
}

function ReserveFromStockDialog({
  repairOrderId,
  rows,
  available,
  onClose,
}: {
  repairOrderId: string;
  rows: Array<{ line: PositionLine; missing: number }>;
  available: AvailableStock[];
  onClose: () => void;
}) {
  const t = useTranslations("modules.workshop.repairOrders.stock.reserve");
  const tErr = useTranslations("modules.warehouse.stockCommitments.errors");
  const tf = useTranslations("modules.warehouse.stockCommitments.fields");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picks, setPicks] = useState(
    () =>
      Object.fromEntries(
        rows.map(({ line, missing }) => {
          const best = available
            .filter((a) => a.variantId === line.variantId)
            .sort((a, b) => b.available - a.available)[0];
          return [
            line.id,
            {
              on: true,
              locationId: best?.locationId ?? "",
              quantity: fmt(Math.min(missing, best?.available ?? 0)),
            },
          ];
        })
      ) as Record<string, { on: boolean; locationId: string; quantity: string }>
  );

  const chosen = rows.flatMap(({ line, missing }) => {
    const pick = picks[line.id];
    if (!pick?.on) return [];
    const stock = available.find(
      (a) => a.variantId === line.variantId && a.locationId === pick.locationId
    );
    const qty = Number(pick.quantity.replace(",", "."));
    if (!stock || !Number.isFinite(qty) || qty <= 0 || qty > Math.min(missing, stock.available))
      return [null];
    return [
      {
        repairOrderLineId: line.id,
        locationId: stock.locationId,
        quantity: qty,
        variantId: line.variantId,
      },
    ];
  });
  const valid = chosen.length > 0 && chosen.every((c) => c !== null);

  const confirm = () =>
    startTransition(async () => {
      const result = await reserveForRepairOrderAction({
        repairOrderId,
        lines: chosen.filter((c): c is NonNullable<typeof c> => c !== null),
      });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("failed"));
        return;
      }
      toast.success(t("done", { number: result.data.reservationNumber }));
      onClose();
      router.refresh();
    });

  const update = (
    id: string,
    patch: Partial<{ on: boolean; locationId: string; quantity: string }>
  ) => setPicks((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto" data-testid="reserve-from-stock">
            {rows.map(({ line, missing }) => {
              const pick = picks[line.id];
              const options = available.filter((a) => a.variantId === line.variantId);
              return (
                <div
                  key={line.id}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[auto_1fr_200px_100px] sm:items-center"
                >
                  <Checkbox
                    checked={pick.on}
                    onCheckedChange={(v) => update(line.id, { on: v === true })}
                    aria-label={line.productName}
                  />
                  <div className="text-sm">
                    {t("line", {
                      part: `${line.sku ?? ""} ${line.productName}`.trim(),
                      missing: fmt(missing),
                    })}
                  </div>
                  <Select
                    value={pick.locationId}
                    onValueChange={(v) => update(line.id, { locationId: v })}
                  >
                    <SelectTrigger aria-label={t("location")}>
                      <SelectValue placeholder={t("location")} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.locationId} value={o.locationId}>
                          {locLabel(o.locationCode, o.locationName)} ·{" "}
                          {tf("available", { count: fmt(o.available) })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={pick.quantity}
                    aria-label={t("quantity")}
                    onChange={(e) => update(line.id, { quantity: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tf("cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={!valid || pending}
            data-testid="reserve-from-stock-confirm"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
