"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Ban, BookmarkCheck, ChevronRight, Loader2, Lock, MoreHorizontal } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  findRepairOrderLinesNeedingAction,
  releaseReservationLinesAction,
  reserveForRepairOrderAction,
  transferReservationAction,
} from "@/app/actions/warehouse/reservations";
import {
  blockStockAction,
  issueBlockedStockAction,
  moveBlockedStockAction,
  unblockStockAction,
} from "@/app/actions/warehouse/blocks";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import type {
  RepairOrderLineNeed,
  ReservationLineView,
} from "@/server/services/inventory-reservations.service";
import type { BlockLineView, BlockReasonCode } from "@/server/services/inventory-blocks.service";

/**
 * Reservations (R) and blocked stock (B) on screens: tables with their
 * operations, and the "block" / "reserve for an order" dialogs of an item.
 * Every write is an engine operation with a reason in the history
 * (docs/RESERVATIONS_BLOCKS_PLAN.md, stages E4/E5).
 */

const REASON_CODES: BlockReasonCode[] = [
  "quality_check",
  "supplier_complaint",
  "damaged",
  "delivery_mismatch",
  "other",
];

type Result = { success: boolean; error?: string; data?: unknown };

/** Fired after every successful reservation / block operation. */
export const STOCK_CHANGED_EVENT = "warehouse:stock-changed";

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function useAge() {
  const t = useTranslations("modules.warehouse.stockCommitments.age");
  return (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return days <= 0 ? t("today") : t("days", { count: days });
  };
}

/** Runs an operation, toasts the outcome, refreshes the page on success. */
function useOperation() {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (op: () => Promise<Result>, success: (data: unknown) => string, done: () => void) =>
    startTransition(async () => {
      const result = await op();
      if (!result.success) {
        const code = result.error ?? "failed";
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.failed"));
        return;
      }
      toast.success(success(result.data));
      done();
      router.refresh();
      // Client-loaded views (the products list's item panel) reload on this.
      window.dispatchEvent(new Event(STOCK_CHANGED_EVENT));
    });
  return { pending, run };
}

function locLabel(code: string | null, name: string | null) {
  if (code && name) return `${code} · ${name}`;
  return code ?? name ?? "—";
}

// ---------------------------------------------------------------------------
// Dialog building blocks

function QuantityField({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.fields");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="sc-quantity">
        {t("quantity")}{" "}
        <span className="text-muted-foreground">({t("max", { max: fmt(max) })})</span>
      </Label>
      <Input
        id="sc-quantity"
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="sc-quantity"
      />
    </div>
  );
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("modules.warehouse.stockCommitments.fields");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="sc-reason">{t("reason")}</Label>
      <Textarea
        id="sc-reason"
        rows={2}
        value={value}
        placeholder={t("reasonPlaceholder")}
        onChange={(e) => onChange(e.target.value)}
        data-testid="sc-reason"
      />
    </div>
  );
}

function BlockReasonFields({
  code,
  onCode,
  description,
  onDescription,
  reference,
  onReference,
}: {
  code: BlockReasonCode;
  onCode: (v: BlockReasonCode) => void;
  description: string;
  onDescription: (v: string) => void;
  reference: string;
  onReference: (v: string) => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  return (
    <>
      <div className="grid gap-1.5">
        <Label>{t("fields.reasonCode")}</Label>
        <Select value={code} onValueChange={(v) => onCode(v as BlockReasonCode)}>
          <SelectTrigger data-testid="sc-reason-code">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REASON_CODES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`reasons.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sc-description">
          {code === "other" ? t("fields.descriptionRequired") : t("fields.description")}
        </Label>
        <Textarea
          id="sc-description"
          rows={2}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          data-testid="sc-description"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sc-reference">{t("fields.reference")}</Label>
        <Input
          id="sc-reference"
          value={reference}
          onChange={(e) => onReference(e.target.value)}
          data-testid="sc-reference"
        />
      </div>
    </>
  );
}

function OperationDialog({
  open,
  onOpenChange,
  title,
  description,
  note,
  confirm,
  canConfirm,
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  note?: string;
  confirm: string;
  canConfirm: boolean;
  pending: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.fields");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {note ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">{note}</p>
        ) : null}
        <div className="grid gap-3">{children}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || pending}
            data-testid="sc-confirm"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const positive = (v: string, max: number) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
};

// ---------------------------------------------------------------------------
// Selection: tick several lines, run one operation on all of them (one
// document / one engine call), or use a row's menu for that line alone.

function useLineSelection<T>(
  lines: T[],
  idOf: (line: T) => string,
  selectable: (line: T) => boolean
) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectableIds = lines.filter(selectable).map(idOf);
  const chosen = lines.filter((l) => selectable(l) && selected.has(idOf(l)));
  const allChosen = selectableIds.length > 0 && chosen.length === selectableIds.length;
  return {
    chosen,
    isChosen: (line: T) => selected.has(idOf(line)),
    toggle: (line: T) =>
      setSelected((prev) => {
        const next = new Set(prev);
        const id = idOf(line);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    allChosen,
    someChosen: chosen.length > 0 && !allChosen,
    toggleAll: () => setSelected(allChosen ? new Set() : new Set(selectableIds)),
    clear: () => setSelected(new Set()),
    hasSelectable: selectableIds.length > 0,
  };
}

function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.selection");
  if (count === 0) return null;
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
      data-testid="selection-bar"
    >
      <span className="font-medium">{t("selected", { count })}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        {t("clear")}
      </Button>
    </div>
  );
}

/** One editable quantity per part of the operation. */
function useQuantities<T>(lines: T[], idOf: (line: T) => string, maxOf: (line: T) => number) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [idOf(l), fmt(maxOf(l))]))
  );
  const parsed = lines.map((l) => positive(values[idOf(l)] ?? "", maxOf(l)));
  return {
    value: (line: T) => values[idOf(line)] ?? "",
    set: (line: T, v: string) => setValues((prev) => ({ ...prev, [idOf(line)]: v })),
    quantities: parsed,
    valid: parsed.every((q) => q !== null),
  };
}

function LineQuantityRow({
  label,
  detail,
  value,
  onChange,
  max,
  children,
}: {
  label: React.ReactNode;
  detail?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  max: number;
  children?: React.ReactNode;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.fields");
  return (
    <div className="flex items-start gap-3 border-b py-2 last:border-b-0" data-testid="sc-line">
      <div className="min-w-0 flex-1 text-sm">
        <div className="truncate">{label}</div>
        {detail ? <div className="truncate text-xs text-muted-foreground">{detail}</div> : null}
        {children}
      </div>
      <div className="w-24 shrink-0">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step="any"
          value={value}
          aria-label={t("quantity")}
          onChange={(e) => onChange(e.target.value)}
          data-testid="sc-quantity"
        />
        <div className="mt-0.5 text-right text-[11px] text-muted-foreground">
          {t("max", { max: fmt(max) })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservations

type ReservationKind = "release" | "transfer" | "block";
type ReservationDialog = { kind: ReservationKind; lines: ReservationLineView[] };

export function ReservationLinesTable({
  lines,
  canOperate,
  showPart = true,
  showOrder = true,
  showNumber = true,
}: {
  lines: ReservationLineView[];
  canOperate: boolean;
  showPart?: boolean;
  showOrder?: boolean;
  showNumber?: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [dialog, setDialog] = useState<ReservationDialog | null>(null);
  const selection = useLineSelection(
    lines,
    (l) => l.reservationLineId,
    (l) => canOperate && l.openQuantity > 0
  );

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("reservations.empty")}</p>;
  }
  const withSelection = canOperate && selection.hasSelectable;
  return (
    <div className="overflow-x-auto">
      <SelectionBar count={selection.chosen.length} onClear={selection.clear}>
        {(["release", "transfer", "block"] as const).map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialog({ kind, lines: selection.chosen })}
            data-testid={`selection-${kind}`}
          >
            {t(`actions.${kind}`)}
          </Button>
        ))}
      </SelectionBar>
      <table className="w-full min-w-[640px] text-sm" data-testid="reservation-lines">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {withSelection ? (
              <th className="w-8 py-1.5 pr-2">
                <Checkbox
                  checked={
                    selection.allChosen ? true : selection.someChosen ? "indeterminate" : false
                  }
                  onCheckedChange={selection.toggleAll}
                  aria-label={t("selection.selectAll")}
                  data-testid="reservation-select-all"
                />
              </th>
            ) : null}
            {showNumber ? (
              <th className="py-1.5 pr-3 font-medium">{t("reservations.number")}</th>
            ) : null}
            {showPart ? (
              <th className="py-1.5 pr-3 font-medium">{t("reservations.part")}</th>
            ) : null}
            {showOrder ? (
              <th className="py-1.5 pr-3 font-medium">{t("reservations.order")}</th>
            ) : null}
            <th className="py-1.5 pr-3 font-medium">{t("reservations.location")}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{t("reservations.quantity")}</th>
            <th className="py-1.5 pr-3 font-medium">{t("reservations.since")}</th>
            {canOperate ? <th className="py-1.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.reservationLineId}
              className="border-b last:border-b-0"
              data-testid="reservation-line"
            >
              {withSelection ? (
                <td className="py-1.5 pr-2">
                  {line.openQuantity > 0 ? (
                    <Checkbox
                      checked={selection.isChosen(line)}
                      onCheckedChange={() => selection.toggle(line)}
                      aria-label={line.sku ?? line.reservationNumber}
                      data-testid="reservation-select"
                    />
                  ) : null}
                </td>
              ) : null}
              {showNumber ? (
                <td className="py-1.5 pr-3 font-mono text-xs">{line.reservationNumber}</td>
              ) : null}
              {showPart ? (
                <td className="py-1.5 pr-3">
                  {line.productId ? (
                    <Link
                      href={{
                        pathname: "/dashboard/warehouse/items/[productId]",
                        params: { productId: line.productId },
                      }}
                      className="hover:underline"
                    >
                      <span className="mr-1.5 font-mono text-xs">{line.sku}</span>
                      {line.productName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              {showOrder ? (
                <td className="py-1.5 pr-3">
                  {line.repairOrderId ? (
                    <Link
                      href={{
                        pathname: "/dashboard/workshop/[id]",
                        params: { id: line.repairOrderId },
                      }}
                      className="font-mono text-xs hover:underline"
                    >
                      {line.zlNumber}
                    </Link>
                  ) : line.internalOrderId ? (
                    <Link
                      href={{
                        pathname: "/dashboard/warehouse/internal-orders/[id]",
                        params: { id: line.internalOrderId },
                      }}
                      className="font-mono text-xs hover:underline"
                    >
                      {line.internalOrderNumber}
                      {line.internalOrderDestination ? ` → ${line.internalOrderDestination}` : ""}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {line.clientName ? (
                    <div className="truncate text-xs text-muted-foreground">{line.clientName}</div>
                  ) : null}
                </td>
              ) : null}
              <td className="py-1.5 pr-3">{locLabel(line.locationCode, line.locationName)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {fmt(line.openQuantity + line.allocatedQuantity)} {line.unitCode ?? ""}
                {line.allocatedQuantity > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {t("reservations.inContainer", { quantity: fmt(line.allocatedQuantity) })}
                  </div>
                ) : null}
              </td>
              <td className="py-1.5 pr-3 text-xs text-muted-foreground">{age(line.createdAt)}</td>
              {canOperate ? (
                <td className="py-1.5 text-right">
                  {line.openQuantity > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("actions.more")}
                          data-testid="reservation-actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(["release", "transfer", "block"] as const).map((kind) => (
                          <DropdownMenuItem
                            key={kind}
                            onSelect={() => setDialog({ kind, lines: [line] })}
                          >
                            {t(`actions.${kind}`)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {dialog ? (
        <ReservationOperationDialog
          key={`${dialog.kind}:${dialog.lines.map((l) => l.reservationLineId).join(",")}`}
          dialog={dialog}
          onClose={(done) => {
            setDialog(null);
            if (done) selection.clear();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * For "move to another order": the open needs of other orders for the
 * selected parts, and -- once an order is picked -- which of its lines takes
 * which part (each part to a line of the same item that still needs it).
 */
function useTransferTargets(lines: ReservationLineView[], enabled: boolean, search: string) {
  const [needs, setNeeds] = useState<Array<RepairOrderLineNeed & { forVariant: string }> | null>(
    null
  );
  const variants = useMemo(() => {
    const byVariant = new Map<string, string | null>();
    for (const l of lines) byVariant.set(l.variantId, l.sku);
    return [...byVariant.entries()];
  }, [lines]);
  const sourceLineIds = useMemo(
    () => new Set(lines.map((l) => l.repairOrderLineId).filter(Boolean)),
    [lines]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const results = await Promise.all(
        variants.map(async ([variantId, sku]) => {
          const result = await findRepairOrderLinesNeedingAction({
            variantId,
            sku,
            query: search || null,
          });
          return result.success
            ? (result.data as RepairOrderLineNeed[]).map((n) => ({ ...n, forVariant: variantId }))
            : [];
        })
      );
      if (!cancelled) {
        setNeeds(results.flat().filter((n) => !sourceLineIds.has(n.repairOrderLineId)));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [enabled, variants, sourceLineIds, search]);

  const orders = useMemo(() => {
    const byOrder = new Map<
      string,
      { id: string; zlNumber: string | null; clientName: string | null }
    >();
    for (const n of needs ?? []) {
      if (!byOrder.has(n.repairOrderId)) {
        byOrder.set(n.repairOrderId, {
          id: n.repairOrderId,
          zlNumber: n.zlNumber,
          clientName: n.clientName,
        });
      }
    }
    return [...byOrder.values()];
  }, [needs]);

  /** Part -> a line of the order with the same item and need left (greedy, in order). */
  const assign = (orderId: string, quantities: Array<number | null>) => {
    const left = new Map<string, number>();
    for (const n of needs ?? []) {
      if (n.repairOrderId === orderId) left.set(n.repairOrderLineId, n.openNeed);
    }
    return lines.map((line, i) => {
      const want = quantities[i] ?? 0;
      const target = (needs ?? []).find(
        (n) =>
          n.repairOrderId === orderId &&
          n.forVariant === line.variantId &&
          (left.get(n.repairOrderLineId) ?? 0) >= want &&
          want > 0
      );
      if (!target) return null;
      left.set(target.repairOrderLineId, (left.get(target.repairOrderLineId) ?? 0) - want);
      return target;
    });
  };

  return { loading: enabled && needs === null, orders, assign };
}

function ReservationOperationDialog({
  dialog,
  onClose,
}: {
  dialog: ReservationDialog;
  onClose: (done?: boolean) => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const { lines, kind } = dialog;
  const qty = useQuantities(
    lines,
    (l) => l.reservationLineId,
    (l) => l.openQuantity
  );
  const [reason, setReason] = useState("");
  const [code, setCode] = useState<BlockReasonCode>("damaged");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [orderId, setOrderId] = useState("");
  const [search, setSearch] = useState("");
  const targets = useTransferTargets(lines, kind === "transfer", search);
  const assigned = kind === "transfer" && orderId ? targets.assign(orderId, qty.quantities) : null;

  const canConfirm =
    qty.valid &&
    (kind === "block"
      ? code !== "other" || description.trim().length > 0
      : reason.trim().length > 0 &&
        (kind !== "transfer" || (!!assigned && assigned.every((a) => a !== null))));

  const done = () => onClose(true);
  const confirm = () => {
    if (!qty.valid) return;
    const amounts = qty.quantities as number[];
    if (kind === "release") {
      run(
        () =>
          releaseReservationLinesAction({
            lines: lines.map((l, i) => ({
              reservationLineId: l.reservationLineId,
              quantity: amounts[i],
            })),
            reason,
          }) as Promise<Result>,
        () => t("toasts.released"),
        done
      );
    } else if (kind === "transfer" && assigned && assigned.every((a) => a !== null)) {
      run(
        () =>
          transferReservationAction({
            lines: lines.map((l, i) => ({
              reservationLineId: l.reservationLineId,
              quantity: amounts[i],
              targetRepairOrderLineId: assigned[i]!.repairOrderLineId,
            })),
            reason,
          }) as Promise<Result>,
        (data) =>
          t("toasts.transferred", {
            number: (data as { reservationNumber?: string })?.reservationNumber ?? "",
          }),
        done
      );
    } else if (kind === "block") {
      run(
        () =>
          blockStockAction({
            reasonCode: code,
            description: description || null,
            reference: reference ? { number: reference } : undefined,
            lines: lines.map((l, i) => ({
              quantity: amounts[i],
              reservationLineId: l.reservationLineId,
            })),
          }) as Promise<Result>,
        (data) =>
          t("toasts.blocked", { number: (data as { blockNumber?: string })?.blockNumber ?? "" }),
        done
      );
    }
  };

  const texts = {
    release: t.raw("dialogs.release") as { title: string; description: string; confirm: string },
    transfer: t.raw("dialogs.transfer") as { title: string; description: string; confirm: string },
    block: t.raw("dialogs.block") as {
      title: string;
      description: string;
      confirm: string;
      reservedNote: string;
    },
  }[kind];

  return (
    <OperationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={texts.title}
      description={texts.description}
      note={kind === "block" ? (texts as { reservedNote: string }).reservedNote : undefined}
      confirm={texts.confirm}
      canConfirm={canConfirm}
      pending={pending}
      onConfirm={confirm}
    >
      {kind === "transfer" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="sc-search">{t("fields.targetOrder")}</Label>
          <Input
            id="sc-search"
            value={search}
            placeholder={t("fields.searchZl")}
            onChange={(e) => setSearch(e.target.value)}
          />
          {targets.loading ? (
            <p className="text-xs text-muted-foreground">{t("fields.loading")}</p>
          ) : targets.orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("fields.noTargets")}</p>
          ) : (
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger data-testid="sc-target">
                <SelectValue placeholder={t("fields.targetOrder")} />
              </SelectTrigger>
              <SelectContent>
                {targets.orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.zlNumber ?? "—"}
                    {o.clientName ? ` · ${o.clientName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : null}
      <div className="max-h-72 overflow-y-auto rounded-md border px-3" data-testid="sc-lines">
        {lines.map((line, i) => (
          <LineQuantityRow
            key={line.reservationLineId}
            label={
              <>
                <span className="mr-1.5 font-mono text-xs">{line.sku}</span>
                {line.productName}
              </>
            }
            detail={`${line.reservationNumber} · ${line.zlNumber ?? "—"} · ${locLabel(line.locationCode, line.locationName)}`}
            value={qty.value(line)}
            onChange={(v) => qty.set(line, v)}
            max={line.openQuantity}
          >
            {assigned ? (
              assigned[i] ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  {t("fields.toLine", {
                    part: assigned[i]!.productName ?? assigned[i]!.productCode ?? "",
                    count: fmt(assigned[i]!.openNeed),
                  })}
                </div>
              ) : (
                <div className="text-xs text-destructive">{t("fields.noNeedInOrder")}</div>
              )
            ) : null}
          </LineQuantityRow>
        ))}
      </div>
      {kind === "block" ? (
        <BlockReasonFields
          code={code}
          onCode={setCode}
          description={description}
          onDescription={setDescription}
          reference={reference}
          onReference={setReference}
        />
      ) : (
        <ReasonField value={reason} onChange={setReason} />
      )}
    </OperationDialog>
  );
}

// ---------------------------------------------------------------------------
// Blocked stock

type BlockKind = "unblock" | "move" | "returnToSupplier" | "scrap";
type BlockDialog = { kind: BlockKind; lines: BlockLineView[] };
const BLOCK_KINDS: BlockKind[] = ["unblock", "move", "returnToSupplier", "scrap"];

export function BlockLinesTable({
  lines,
  canOperate,
  branchId,
  showPart = true,
  showNumber = true,
  showReason = true,
}: {
  lines: BlockLineView[];
  canOperate: boolean;
  branchId: string;
  showPart?: boolean;
  showNumber?: boolean;
  showReason?: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [dialog, setDialog] = useState<BlockDialog | null>(null);
  const selection = useLineSelection(
    lines,
    (l) => l.blockLineId,
    (l) => canOperate && l.openQuantity > 0
  );

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("blocks.empty")}</p>;
  }
  const withSelection = canOperate && selection.hasSelectable;
  return (
    <div className="overflow-x-auto">
      <SelectionBar count={selection.chosen.length} onClear={selection.clear}>
        {BLOCK_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialog({ kind, lines: selection.chosen })}
            data-testid={`selection-${kind}`}
          >
            {t(`actions.${kind}`)}
          </Button>
        ))}
      </SelectionBar>
      <table className="w-full min-w-[640px] text-sm" data-testid="block-lines">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {withSelection ? (
              <th className="w-8 py-1.5 pr-2">
                <Checkbox
                  checked={
                    selection.allChosen ? true : selection.someChosen ? "indeterminate" : false
                  }
                  onCheckedChange={selection.toggleAll}
                  aria-label={t("selection.selectAll")}
                  data-testid="block-select-all"
                />
              </th>
            ) : null}
            {showNumber ? <th className="py-1.5 pr-3 font-medium">{t("blocks.number")}</th> : null}
            {showPart ? <th className="py-1.5 pr-3 font-medium">{t("blocks.part")}</th> : null}
            {showReason ? <th className="py-1.5 pr-3 font-medium">{t("blocks.reason")}</th> : null}
            <th className="py-1.5 pr-3 font-medium">{t("blocks.location")}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{t("blocks.quantity")}</th>
            <th className="py-1.5 pr-3 font-medium">{t("blocks.since")}</th>
            {canOperate ? <th className="py-1.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.blockLineId}
              className="border-b last:border-b-0"
              data-testid="block-line"
            >
              {withSelection ? (
                <td className="py-1.5 pr-2">
                  <Checkbox
                    checked={selection.isChosen(line)}
                    onCheckedChange={() => selection.toggle(line)}
                    aria-label={line.sku ?? line.blockNumber}
                    data-testid="block-select"
                  />
                </td>
              ) : null}
              {showNumber ? (
                <td className="py-1.5 pr-3 font-mono text-xs">{line.blockNumber}</td>
              ) : null}
              {showPart ? (
                <td className="py-1.5 pr-3">
                  {line.productId ? (
                    <Link
                      href={{
                        pathname: "/dashboard/warehouse/items/[productId]",
                        params: { productId: line.productId },
                      }}
                      className="hover:underline"
                    >
                      <span className="mr-1.5 font-mono text-xs">{line.sku}</span>
                      {line.productName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              {showReason ? (
                <td className="py-1.5 pr-3">
                  <BlockReasonCell line={line} />
                </td>
              ) : null}
              <td className="py-1.5 pr-3">{locLabel(line.locationCode, line.locationName)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {fmt(line.openQuantity)} {line.unitCode ?? ""}
              </td>
              <td className="py-1.5 pr-3 text-xs text-muted-foreground">{age(line.createdAt)}</td>
              {canOperate ? (
                <td className="py-1.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("actions.more")}
                        data-testid="block-actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {BLOCK_KINDS.map((kind) => (
                        <DropdownMenuItem
                          key={kind}
                          onSelect={() => setDialog({ kind, lines: [line] })}
                        >
                          {t(`actions.${kind}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {dialog ? (
        <BlockOperationDialog
          key={`${dialog.kind}:${dialog.lines.map((l) => l.blockLineId).join(",")}`}
          dialog={dialog}
          branchId={branchId}
          onClose={(done) => {
            setDialog(null);
            if (done) selection.clear();
          }}
        />
      ) : null}
    </div>
  );
}

function BlockReasonCell({ line }: { line: BlockLineView }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  return (
    <>
      <Badge variant="outline">{t(`reasons.${line.reasonCode}`)}</Badge>
      {line.description ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{line.description}</div>
      ) : null}
      {line.referenceNumber ? (
        <div className="font-mono text-xs text-muted-foreground">{line.referenceNumber}</div>
      ) : null}
    </>
  );
}

function BlockOperationDialog({
  dialog,
  branchId,
  onClose,
}: {
  dialog: BlockDialog;
  branchId: string;
  onClose: (done?: boolean) => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const { lines, kind } = dialog;
  const qty = useQuantities(
    lines,
    (l) => l.blockLineId,
    (l) => l.openQuantity
  );
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [destination, setDestination] = useState("");
  const locations = useWarehouseLocationsQuery(kind === "move" ? branchId : null);
  const sources = useMemo(() => new Set(lines.map((l) => l.locationId)), [lines]);
  const destinations = useMemo(
    () =>
      (locations.data ?? []).filter(
        (l) =>
          !sources.has(l.id) &&
          (l as { can_store_inventory?: boolean }).can_store_inventory !== false
      ),
    [locations.data, sources]
  );

  const canConfirm = qty.valid && (kind === "move" ? !!destination : reason.trim().length > 0);
  const done = () => onClose(true);

  const confirm = () => {
    if (!qty.valid) return;
    const amounts = qty.quantities as number[];
    const payload = lines.map((l, i) => ({ blockLineId: l.blockLineId, quantity: amounts[i] }));
    if (kind === "unblock") {
      run(
        () => unblockStockAction({ lines: payload, reason }) as Promise<Result>,
        () => t("toasts.unblocked"),
        done
      );
    } else if (kind === "move") {
      run(
        () =>
          moveBlockedStockAction({
            lines: payload,
            destinationLocationId: destination,
          }) as Promise<Result>,
        (data) =>
          t("toasts.moved", {
            document: (data as { documentNumber?: string })?.documentNumber ?? "",
          }),
        done
      );
    } else {
      run(
        () =>
          issueBlockedStockAction({
            kind: kind === "scrap" ? "scrap" : "return_to_supplier",
            lines: payload,
            reason,
            counterpartyName: kind === "returnToSupplier" ? supplier || null : null,
          }) as Promise<Result>,
        (data) =>
          t(kind === "scrap" ? "toasts.scrapped" : "toasts.returned", {
            document: (data as { documentNumber?: string })?.documentNumber ?? "",
          }),
        done
      );
    }
  };

  const texts = t.raw(`dialogs.${kind}`) as { title: string; description: string; confirm: string };
  return (
    <OperationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={texts.title}
      description={texts.description}
      confirm={texts.confirm}
      canConfirm={canConfirm}
      pending={pending}
      onConfirm={confirm}
    >
      <div className="max-h-72 overflow-y-auto rounded-md border px-3" data-testid="sc-lines">
        {lines.map((line) => (
          <LineQuantityRow
            key={line.blockLineId}
            label={
              <>
                <span className="mr-1.5 font-mono text-xs">{line.sku}</span>
                {line.productName}
              </>
            }
            detail={`${line.blockNumber} · ${locLabel(line.locationCode, line.locationName)}`}
            value={qty.value(line)}
            onChange={(v) => qty.set(line, v)}
            max={line.openQuantity}
          />
        ))}
      </div>
      {kind === "move" ? (
        <div className="grid gap-1.5">
          <Label>{t("fields.destination")}</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger data-testid="sc-destination">
              <SelectValue placeholder={t("fields.destination")} />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {locLabel(l.code ?? null, l.name ?? null)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          {kind === "returnToSupplier" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="sc-supplier">{t("fields.supplier")}</Label>
              <Input
                id="sc-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          ) : null}
          <ReasonField value={reason} onChange={setReason} />
        </>
      )}
    </OperationDialog>
  );
}

// ---------------------------------------------------------------------------
// Item card: block / reserve for an order

export type StockAtLocation = {
  variantId: string;
  sku: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  available: number;
};

function LocationPicker({
  stock,
  value,
  onChange,
}: {
  stock: StockAtLocation[];
  value: string;
  onChange: (key: string) => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.fields");
  if (stock.length === 0)
    return <p className="text-sm text-muted-foreground">{t("noAvailable")}</p>;
  return (
    <div className="grid gap-1.5">
      <Label>{t("location")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid="sc-location">
          <SelectValue placeholder={t("location")} />
        </SelectTrigger>
        <SelectContent>
          {stock.map((s) => (
            <SelectItem
              key={`${s.variantId}:${s.locationId}`}
              value={`${s.variantId}:${s.locationId}`}
            >
              {s.sku ? `${s.sku} · ` : ""}
              {locLabel(s.locationCode, s.locationName)} ·{" "}
              {t("available", { count: fmt(s.available) })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ItemStockActions({ stock }: { stock: StockAtLocation[] }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const [open, setOpen] = useState<"block" | "reserve" | null>(null);
  const available = stock.filter((s) => s.available > 0);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen("reserve")}
        disabled={available.length === 0}
        data-testid="item-reserve-for-order"
      >
        <BookmarkCheck className="mr-2 h-4 w-4" />
        {t("actions.reserveForOrder")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen("block")}
        disabled={available.length === 0}
        data-testid="item-block"
      >
        <Lock className="mr-2 h-4 w-4" />
        {t("actions.block")}
      </Button>
      {open === "block" ? (
        <ItemBlockDialog stock={available} onClose={() => setOpen(null)} />
      ) : null}
      {open === "reserve" ? (
        <ItemReserveDialog stock={available} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}

function ItemBlockDialog({ stock, onClose }: { stock: StockAtLocation[]; onClose: () => void }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const [key, setKey] = useState(
    stock.length === 1 ? `${stock[0].variantId}:${stock[0].locationId}` : ""
  );
  const chosen = stock.find((s) => `${s.variantId}:${s.locationId}` === key) ?? null;
  const [quantity, setQuantity] = useState("1");
  const [code, setCode] = useState<BlockReasonCode>("damaged");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const qty = chosen ? positive(quantity, chosen.available) : null;
  const canConfirm = qty !== null && (code !== "other" || description.trim().length > 0);
  const texts = t.raw("dialogs.block") as { title: string; description: string; confirm: string };

  return (
    <OperationDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={texts.title}
      description={texts.description}
      confirm={texts.confirm}
      canConfirm={canConfirm}
      pending={pending}
      onConfirm={() =>
        chosen &&
        qty !== null &&
        run(
          () =>
            blockStockAction({
              reasonCode: code,
              description: description || null,
              reference: reference ? { number: reference } : undefined,
              lines: [
                { quantity: qty, variantId: chosen.variantId, locationId: chosen.locationId },
              ],
            }) as Promise<Result>,
          (data) =>
            t("toasts.blocked", { number: (data as { blockNumber?: string })?.blockNumber ?? "" }),
          onClose
        )
      }
    >
      <LocationPicker stock={stock} value={key} onChange={setKey} />
      {chosen ? (
        <QuantityField value={quantity} onChange={setQuantity} max={chosen.available} />
      ) : null}
      <BlockReasonFields
        code={code}
        onCode={setCode}
        description={description}
        onDescription={setDescription}
        reference={reference}
        onReference={setReference}
      />
    </OperationDialog>
  );
}

function ItemReserveDialog({ stock, onClose }: { stock: StockAtLocation[]; onClose: () => void }) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const [key, setKey] = useState(
    stock.length === 1 ? `${stock[0].variantId}:${stock[0].locationId}` : ""
  );
  const chosen = stock.find((s) => `${s.variantId}:${s.locationId}` === key) ?? null;
  const [targets, setTargets] = useState<RepairOrderLineNeed[] | null>(null);
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!chosen) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const result = await findRepairOrderLinesNeedingAction({
        variantId: chosen.variantId,
        sku: chosen.sku,
        query: search || null,
      });
      if (!cancelled) setTargets(result.success ? (result.data as RepairOrderLineNeed[]) : []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [chosen, search]);

  const line = targets?.find((x) => x.repairOrderLineId === target) ?? null;
  const max = chosen && line ? Math.min(chosen.available, line.openNeed) : 0;
  const qty = positive(quantity, max);
  const texts = t.raw("dialogs.reserve") as { title: string; description: string; confirm: string };

  return (
    <OperationDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={texts.title}
      description={texts.description}
      confirm={texts.confirm}
      canConfirm={qty !== null && !!line}
      pending={pending}
      onConfirm={() =>
        chosen &&
        line &&
        qty !== null &&
        run(
          () =>
            reserveForRepairOrderAction({
              repairOrderId: line.repairOrderId,
              lines: [
                {
                  repairOrderLineId: line.repairOrderLineId,
                  locationId: chosen.locationId,
                  quantity: qty,
                  variantId: chosen.variantId,
                },
              ],
              reason: reason || null,
            }) as Promise<Result>,
          (data) =>
            t("toasts.reserved", {
              number: (data as { reservationNumber?: string })?.reservationNumber ?? "",
            }),
          onClose
        )
      }
    >
      <LocationPicker stock={stock} value={key} onChange={setKey} />
      {chosen ? (
        <div className="grid gap-1.5">
          <Label htmlFor="sc-search">{t("fields.target")}</Label>
          <Input
            id="sc-search"
            value={search}
            placeholder={t("fields.searchZl")}
            onChange={(e) => setSearch(e.target.value)}
          />
          {targets === null ? (
            <p className="text-xs text-muted-foreground">{t("fields.loading")}</p>
          ) : targets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("fields.noTargets")}</p>
          ) : (
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger data-testid="sc-target">
                <SelectValue placeholder={t("fields.target")} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((x) => (
                  <SelectItem key={x.repairOrderLineId} value={x.repairOrderLineId}>
                    {x.zlNumber} · {x.productName ?? x.productCode} ·{" "}
                    {t("fields.needs", { count: fmt(x.openNeed) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : null}
      {line ? <QuantityField value={quantity} onChange={setQuantity} max={max} /> : null}
      <ReasonField value={reason} onChange={setReason} />
    </OperationDialog>
  );
}

/** "D · R · B" next to an on-hand figure. */
export function StockStates({
  available,
  reserved,
  blocked,
  unit,
}: {
  available: number;
  reserved: number;
  blocked: number;
  unit?: string | null;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.states");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs" data-testid="stock-states">
      <Badge variant="secondary" title={t("available")}>
        D {fmt(available)}
      </Badge>
      {reserved > 0 ? (
        <Badge variant="outline" title={t("reserved")}>
          <BookmarkCheck className="mr-1 h-3 w-3" />R {fmt(reserved)}
        </Badge>
      ) : null}
      {blocked > 0 ? (
        <Badge
          variant="outline"
          className="border-destructive/40 text-destructive"
          title={t("blocked")}
        >
          <Ban className="mr-1 h-3 w-3" />B {fmt(blocked)}
        </Badge>
      ) : null}
      {unit ? <span className="text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// List pages: one row per document (REZ / BLK), its parts when opened.

function matches(query: string, values: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => (v ?? "").toLowerCase().includes(q));
}

/** Lines grouped by their document, in the order the documents first appear. */
function byDocument<T>(lines: T[], idOf: (line: T) => string) {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const id = idOf(line);
    const group = groups.get(id);
    if (group) group.push(line);
    else groups.set(id, [line]);
  }
  return [...groups.entries()].map(([id, group]) => ({ id, lines: group }));
}

function oldest(dates: string[]) {
  return dates.reduce((a, b) => (a < b ? a : b));
}

function ListFilter({
  query,
  onQuery,
  count,
}: {
  query: string;
  onQuery: (v: string) => void;
  count: number;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.pages");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={t("filter")}
        className="max-w-sm"
        data-testid="commitments-filter"
      />
      <span className="text-xs text-muted-foreground">{t("documents", { count })}</span>
    </div>
  );
}

function DocumentRow({
  open,
  onToggle,
  number,
  children,
  testId,
}: {
  open: boolean;
  onToggle: () => void;
  number: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
      data-testid={testId}
    >
      <ChevronRight
        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
      />
      <span className="font-mono text-xs font-medium">{number}</span>
      {children}
    </button>
  );
}

export function ReservationsList({
  lines,
  canOperate,
}: {
  lines: ReservationLineView[];
  canOperate: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const shown = lines.filter((l) =>
    matches(query, [
      l.reservationNumber,
      l.sku,
      l.productName,
      l.zlNumber,
      l.internalOrderNumber,
      l.internalOrderDestination,
      l.clientName,
      l.locationCode,
      l.locationName,
    ])
  );
  const documents = byDocument(shown, (l) => l.reservationId);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-3">
      <ListFilter query={query} onQuery={setQuery} count={documents.length} />
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reservations.empty")}</p>
      ) : (
        <div className="divide-y rounded-md border" data-testid="reservation-documents">
          {documents.map((doc) => {
            const first = doc.lines[0];
            const total = doc.lines.reduce((s, l) => s + l.openQuantity + l.allocatedQuantity, 0);
            const inContainer = doc.lines.reduce((s, l) => s + l.allocatedQuantity, 0);
            const isOpen = open.has(doc.id) || query.trim().length > 0;
            return (
              <div key={doc.id} data-testid="reservation-document">
                <DocumentRow
                  open={isOpen}
                  onToggle={() => toggle(doc.id)}
                  number={first.reservationNumber}
                  testId="reservation-document-toggle"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs">
                      {first.zlNumber ??
                        (first.internalOrderNumber
                          ? `${first.internalOrderNumber}${first.internalOrderDestination ? ` → ${first.internalOrderDestination}` : ""}`
                          : "—")}
                    </span>
                    {first.clientName ? (
                      <span className="ml-2 text-xs text-muted-foreground">{first.clientName}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("reservations.parts", { count: doc.lines.length })}
                  </span>
                  <span className="ml-auto tabular-nums">
                    {fmt(total)}
                    {inContainer > 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("reservations.inContainer", { quantity: fmt(inContainer) })}
                      </span>
                    ) : null}
                  </span>
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {age(oldest(doc.lines.map((l) => l.createdAt)))}
                  </span>
                </DocumentRow>
                {isOpen ? (
                  <div className="border-t bg-muted/20 px-3 py-2">
                    {first.repairOrderId ? (
                      <Link
                        href={{
                          pathname: "/dashboard/workshop/[id]",
                          params: { id: first.repairOrderId },
                        }}
                        className="mb-2 inline-block text-xs hover:underline"
                      >
                        {t("reservations.openOrder")}
                      </Link>
                    ) : null}
                    <ReservationLinesTable
                      lines={doc.lines}
                      canOperate={canOperate}
                      showOrder={false}
                      showNumber={false}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BlocksList({
  lines,
  canOperate,
  branchId,
}: {
  lines: BlockLineView[];
  canOperate: boolean;
  branchId: string;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const shown = lines.filter((l) =>
    matches(query, [
      l.blockNumber,
      l.sku,
      l.productName,
      l.referenceNumber,
      l.description,
      t(`reasons.${l.reasonCode}`),
      l.locationCode,
      l.locationName,
    ])
  );
  const documents = byDocument(shown, (l) => l.blockId);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-3">
      <ListFilter query={query} onQuery={setQuery} count={documents.length} />
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("blocks.empty")}</p>
      ) : (
        <div className="divide-y rounded-md border" data-testid="block-documents">
          {documents.map((doc) => {
            const first = doc.lines[0];
            const total = doc.lines.reduce((s, l) => s + l.openQuantity, 0);
            const isOpen = open.has(doc.id) || query.trim().length > 0;
            return (
              <div key={doc.id} data-testid="block-document">
                <DocumentRow
                  open={isOpen}
                  onToggle={() => toggle(doc.id)}
                  number={first.blockNumber}
                  testId="block-document-toggle"
                >
                  <span className="min-w-0">
                    <Badge variant="outline">{t(`reasons.${first.reasonCode}`)}</Badge>
                    {first.referenceNumber ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {first.referenceNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("reservations.parts", { count: doc.lines.length })}
                  </span>
                  <span className="ml-auto tabular-nums">{fmt(total)}</span>
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {age(oldest(doc.lines.map((l) => l.createdAt)))}
                  </span>
                </DocumentRow>
                {isOpen ? (
                  <div className="border-t bg-muted/20 px-3 py-2">
                    {first.description ? (
                      <p className="mb-2 text-xs text-muted-foreground">{first.description}</p>
                    ) : null}
                    <BlockLinesTable
                      lines={doc.lines}
                      canOperate={canOperate}
                      branchId={branchId}
                      showNumber={false}
                      showReason={false}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
