"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Ban, BookmarkCheck, Loader2, Lock, MoreHorizontal } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
// Reservations

type ReservationDialog = { kind: "release" | "transfer" | "block"; line: ReservationLineView };

export function ReservationLinesTable({
  lines,
  canOperate,
  showPart = true,
  showOrder = true,
}: {
  lines: ReservationLineView[];
  canOperate: boolean;
  showPart?: boolean;
  showOrder?: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [dialog, setDialog] = useState<ReservationDialog | null>(null);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("reservations.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm" data-testid="reservation-lines">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">{t("reservations.number")}</th>
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
              <td className="py-1.5 pr-3 font-mono text-xs">{line.reservationNumber}</td>
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
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "release", line })}>
                          {t("actions.release")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "transfer", line })}>
                          {t("actions.transfer")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "block", line })}>
                          {t("actions.block")}
                        </DropdownMenuItem>
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
          key={`${dialog.kind}:${dialog.line.reservationLineId}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ReservationOperationDialog({
  dialog,
  onClose,
}: {
  dialog: ReservationDialog;
  onClose: () => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const { line, kind } = dialog;
  const max = line.openQuantity;
  const [quantity, setQuantity] = useState(fmt(max));
  const [reason, setReason] = useState("");
  const [code, setCode] = useState<BlockReasonCode>("damaged");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [target, setTarget] = useState<string>("");
  const [targets, setTargets] = useState<RepairOrderLineNeed[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (kind !== "transfer") return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const result = await findRepairOrderLinesNeedingAction({
        variantId: line.variantId,
        sku: line.sku,
        query: search || null,
        excludeLineId: line.repairOrderLineId,
      });
      if (!cancelled) setTargets(result.success ? (result.data as RepairOrderLineNeed[]) : []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [kind, line.variantId, line.sku, line.repairOrderLineId, search]);

  const qty = positive(quantity, max);
  const chosen = targets?.find((x) => x.repairOrderLineId === target) ?? null;
  const canConfirm =
    qty !== null &&
    (kind === "block"
      ? code !== "other" || description.trim().length > 0
      : reason.trim().length > 0 && (kind !== "transfer" || (!!chosen && qty <= chosen.openNeed)));

  const confirm = () => {
    if (qty === null) return;
    if (kind === "release") {
      run(
        () =>
          releaseReservationLinesAction({
            lines: [{ reservationLineId: line.reservationLineId, quantity: qty }],
            reason,
          }) as Promise<Result>,
        () => t("toasts.released"),
        onClose
      );
    } else if (kind === "transfer" && chosen) {
      run(
        () =>
          transferReservationAction({
            reservationLineId: line.reservationLineId,
            quantity: qty,
            targetRepairOrderLineId: chosen.repairOrderLineId,
            reason,
          }) as Promise<Result>,
        (data) =>
          t("toasts.transferred", {
            number: (data as { reservationNumber?: string })?.reservationNumber ?? "",
          }),
        onClose
      );
    } else if (kind === "block") {
      run(
        () =>
          blockStockAction({
            reasonCode: code,
            description: description || null,
            reference: reference ? { number: reference } : undefined,
            lines: [{ quantity: qty, reservationLineId: line.reservationLineId }],
          }) as Promise<Result>,
        (data) =>
          t("toasts.blocked", { number: (data as { blockNumber?: string })?.blockNumber ?? "" }),
        onClose
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
      <p className="text-sm">
        <span className="font-mono text-xs">{line.reservationNumber}</span> · {line.sku}{" "}
        {line.productName} · {line.zlNumber ?? "—"}
      </p>
      {kind === "transfer" ? (
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
      <QuantityField
        value={quantity}
        onChange={setQuantity}
        max={kind === "transfer" && chosen ? Math.min(max, chosen.openNeed) : max}
      />
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

type BlockDialog = {
  kind: "unblock" | "move" | "returnToSupplier" | "scrap";
  line: BlockLineView;
};

export function BlockLinesTable({
  lines,
  canOperate,
  branchId,
  showPart = true,
}: {
  lines: BlockLineView[];
  canOperate: boolean;
  branchId: string;
  showPart?: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const age = useAge();
  const [dialog, setDialog] = useState<BlockDialog | null>(null);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("blocks.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm" data-testid="block-lines">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">{t("blocks.number")}</th>
            {showPart ? <th className="py-1.5 pr-3 font-medium">{t("blocks.part")}</th> : null}
            <th className="py-1.5 pr-3 font-medium">{t("blocks.reason")}</th>
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
              <td className="py-1.5 pr-3 font-mono text-xs">{line.blockNumber}</td>
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
              <td className="py-1.5 pr-3">
                <Badge variant="outline">{t(`reasons.${line.reasonCode}`)}</Badge>
                {line.description ? (
                  <div className="mt-0.5 text-xs text-muted-foreground">{line.description}</div>
                ) : null}
                {line.referenceNumber ? (
                  <div className="font-mono text-xs text-muted-foreground">
                    {line.referenceNumber}
                  </div>
                ) : null}
              </td>
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
                      {(["unblock", "move", "returnToSupplier", "scrap"] as const).map((kind) => (
                        <DropdownMenuItem key={kind} onSelect={() => setDialog({ kind, line })}>
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
          key={`${dialog.kind}:${dialog.line.blockLineId}`}
          dialog={dialog}
          branchId={branchId}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function BlockOperationDialog({
  dialog,
  branchId,
  onClose,
}: {
  dialog: BlockDialog;
  branchId: string;
  onClose: () => void;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments");
  const { pending, run } = useOperation();
  const { line, kind } = dialog;
  const max = line.openQuantity;
  const [quantity, setQuantity] = useState(fmt(max));
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [destination, setDestination] = useState("");
  const locations = useWarehouseLocationsQuery(kind === "move" ? branchId : null);
  const destinations = useMemo(
    () =>
      (locations.data ?? []).filter(
        (l) =>
          l.id !== line.locationId &&
          (l as { can_store_inventory?: boolean }).can_store_inventory !== false
      ),
    [locations.data, line.locationId]
  );

  const qty = positive(quantity, max);
  const canConfirm = qty !== null && (kind === "move" ? !!destination : reason.trim().length > 0);

  const confirm = () => {
    if (qty === null) return;
    const lines = [{ blockLineId: line.blockLineId, quantity: qty }];
    if (kind === "unblock") {
      run(
        () => unblockStockAction({ lines, reason }) as Promise<Result>,
        () => t("toasts.unblocked"),
        onClose
      );
    } else if (kind === "move") {
      run(
        () =>
          moveBlockedStockAction({
            blockLineId: line.blockLineId,
            quantity: qty,
            destinationLocationId: destination,
          }) as Promise<Result>,
        (data) =>
          t("toasts.moved", {
            document: (data as { documentNumber?: string })?.documentNumber ?? "",
          }),
        onClose
      );
    } else {
      run(
        () =>
          issueBlockedStockAction({
            kind: kind === "scrap" ? "scrap" : "return_to_supplier",
            lines,
            reason,
            counterpartyName: kind === "returnToSupplier" ? supplier || null : null,
          }) as Promise<Result>,
        (data) =>
          t(kind === "scrap" ? "toasts.scrapped" : "toasts.returned", {
            document: (data as { documentNumber?: string })?.documentNumber ?? "",
          }),
        onClose
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
      <p className="text-sm">
        <span className="font-mono text-xs">{line.blockNumber}</span> · {line.sku}{" "}
        {line.productName} · {locLabel(line.locationCode, line.locationName)}
      </p>
      <QuantityField value={quantity} onChange={setQuantity} max={max} />
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
// List pages: search over the rows, then the table.

function matches(query: string, values: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => (v ?? "").toLowerCase().includes(q));
}

export function ReservationsList({
  lines,
  canOperate,
}: {
  lines: ReservationLineView[];
  canOperate: boolean;
}) {
  const t = useTranslations("modules.warehouse.stockCommitments.pages");
  const [query, setQuery] = useState("");
  const shown = lines.filter((l) =>
    matches(query, [
      l.reservationNumber,
      l.sku,
      l.productName,
      l.zlNumber,
      l.clientName,
      l.locationCode,
      l.locationName,
    ])
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("filter")}
          className="max-w-sm"
          data-testid="commitments-filter"
        />
        <span className="text-xs text-muted-foreground">{t("count", { count: shown.length })}</span>
      </div>
      <ReservationLinesTable lines={shown} canOperate={canOperate} />
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
  const t = useTranslations("modules.warehouse.stockCommitments.pages");
  const tr = useTranslations("modules.warehouse.stockCommitments.reasons");
  const [query, setQuery] = useState("");
  const shown = lines.filter((l) =>
    matches(query, [
      l.blockNumber,
      l.sku,
      l.productName,
      l.referenceNumber,
      l.description,
      tr(l.reasonCode),
      l.locationCode,
      l.locationName,
    ])
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("filter")}
          className="max-w-sm"
          data-testid="commitments-filter"
        />
        <span className="text-xs text-muted-foreground">{t("count", { count: shown.length })}</span>
      </div>
      <BlockLinesTable lines={shown} canOperate={canOperate} branchId={branchId} />
    </div>
  );
}
