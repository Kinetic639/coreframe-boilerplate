"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2, Package, Plus, Save, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  InventoryMovementType,
  InventoryVariantOption,
} from "@/lib/warehouse/inventory-types";
import {
  createAndPostMovementAction,
  createDraftMovementAction,
  saveDraftMovementAction,
  saveAndPostDraftMovementAction,
} from "@/app/actions/warehouse/inventory";
import {
  InventoryItemPickerDialog,
  type InventoryItemPickerMode,
  type PickedMovementItem,
} from "@/components/warehouse/inventory-item-picker-dialog";
import {
  MovementTypePicker,
  MovementTypeEffectPreview,
} from "@/components/warehouse/movement-type-picker";

type LocationOption = { id: string; name: string; code: string | null };

type LineDraft = {
  key: string;
  variant_id: string;
  unit_id: string;
  sku: string;
  product_name: string;
  unit_code: string;
  brand_name: string | null;
  barcode: string | null;
  quantity: string;
  on_hand_at_source: number | null;
  source_location_id: string;
  destination_location_id: string;
};

export type MovementFormInitialValues = {
  movementId: string;
  movementTypeCode: string;
  draftNumber: string;
  documentDate: string;
  operationDate: string;
  counterpartyName: string;
  externalReference: string;
  note: string;
  lines: Array<{
    variant_id: string;
    unit_id: string;
    sku: string;
    product_name: string;
    unit_code: string;
    quantity: number;
    source_location_id: string | null;
    destination_location_id: string | null;
  }>;
};

type Props = {
  mode: "create" | "edit";
  branchName: string;
  movementTypes: InventoryMovementType[];
  stockableLocations: LocationOption[];
  variants: InventoryVariantOption[];
  initialValues?: MovementFormInitialValues;
};

export function MovementDocumentForm({
  mode,
  branchName,
  movementTypes,
  stockableLocations,
  variants,
  initialValues,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  const [typeCode, setTypeCode] = useState(initialValues?.movementTypeCode ?? "");
  const today = new Date().toISOString().split("T")[0];
  const [counterpartyName, setCounterpartyName] = useState(initialValues?.counterpartyName ?? "");
  const [externalReference, setExternalReference] = useState(
    initialValues?.externalReference ?? ""
  );
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [srcLoc, setSrcLoc] = useState(() => initialValues?.lines?.[0]?.source_location_id ?? "");
  const [dstLoc, setDstLoc] = useState(
    () => initialValues?.lines?.[0]?.destination_location_id ?? ""
  );

  const initLines: LineDraft[] = useMemo(() => {
    if (!initialValues?.lines?.length) return [];
    return initialValues.lines.map((l) => ({
      key: crypto.randomUUID(),
      variant_id: l.variant_id,
      unit_id: l.unit_id,
      sku: l.sku,
      product_name: l.product_name,
      unit_code: l.unit_code,
      brand_name: null,
      barcode: null,
      quantity: String(l.quantity),
      on_hand_at_source: null,
      source_location_id: l.source_location_id ?? "",
      destination_location_id: l.destination_location_id ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lines, setLines] = useState<LineDraft[]>(initLines);
  const [errors, setErrors] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selType = movementTypes.find((t) => t.code === typeCode) ?? null;
  const isPZ = typeCode === "101";
  const is801 = typeCode === "801";
  const pickerMode: InventoryItemPickerMode = is801 ? "stockInLocation" : "allItems";
  const pickerDisabled = is801 && !srcLoc;

  function removeLine(key: string) {
    setLines((p) => p.filter((l) => l.key !== key));
  }
  function updateQty(key: string, v: string) {
    setLines((p) => p.map((l) => (l.key === key ? { ...l, quantity: v } : l)));
  }

  function handlePickerAddItems(items: PickedMovementItem[]) {
    setLines((prev) => {
      const next = [...prev];
      for (const item of items) {
        const existingIdx = next.findIndex(
          (l) =>
            l.variant_id === item.variant_id &&
            (l.source_location_id || srcLoc) === (srcLoc || "") &&
            (l.destination_location_id || dstLoc) === (dstLoc || "")
        );
        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          next[existingIdx] = {
            ...existing,
            quantity: String(Number(existing.quantity) + item.quantity),
          };
        } else {
          next.push({
            key: crypto.randomUUID(),
            variant_id: item.variant_id,
            unit_id: item.unit_id,
            sku: item.sku,
            product_name: item.product_name,
            unit_code: item.unit_code,
            brand_name: item.brand_name,
            barcode: item.barcode,
            quantity: String(item.quantity),
            on_hand_at_source: item.available_quantity,
            source_location_id: srcLoc,
            destination_location_id: dstLoc,
          });
        }
      }
      return next;
    });
  }

  function handleSrcChange(v: string) {
    if (v === srcLoc) return;
    if (lines.length > 0 && srcLoc) {
      if (!window.confirm("Changing source location clears selected items. Continue?")) return;
      setLines([]);
    }
    setSrcLoc(v);
  }

  function validate(): string[] {
    const e: string[] = [];
    if (!typeCode) e.push("Select a movement type.");
    // Dates are automatic, no validation needed
    if (isPZ && !dstLoc) e.push("Destination location required.");
    if (is801 && !srcLoc) e.push("Source location required.");
    if (is801 && !dstLoc) e.push("Destination location required.");
    if (is801 && srcLoc && srcLoc === dstLoc) e.push("Source and destination cannot be the same.");
    if (lines.length === 0) e.push("Add at least one item.");
    lines.forEach((l, i) => {
      const q = Number(l.quantity);
      if (!l.quantity || q <= 0) e.push(`#${i + 1} ${l.sku}: qty must be > 0.`);
      if (is801 && l.on_hand_at_source !== null && q > l.on_hand_at_source)
        e.push(`#${i + 1} ${l.sku}: qty ${q} exceeds available ${l.on_hand_at_source}.`);
    });
    return e;
  }

  function buildLines() {
    return lines.map((l) => ({
      variant_id: l.variant_id,
      unit_id: l.unit_id,
      quantity: Number(l.quantity),
      source_location_id: is801 ? l.source_location_id || srcLoc || null : null,
      destination_location_id: l.destination_location_id || dstLoc || null,
      note: null,
    }));
  }

  function submit(andPost: boolean) {
    const errs = validate();
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    startTransition(async () => {
      const ls = buildLines();
      if (isEdit && initialValues) {
        const payload = {
          movement_id: initialValues.movementId,
          counterparty_name: counterpartyName || null,
          external_reference: externalReference || null,
          note: note || null,
          lines: ls,
        };
        const dp = {
          pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
          params: { movementId: initialValues.movementId },
        };
        if (andPost) {
          const r = (await saveAndPostDraftMovementAction(payload)) as any;
          if (!r.success) {
            toast.error(r.error ?? "Failed");
            return;
          }
          toast.success(`Document ${r.data?.document_number ?? ""} posted.`);
          router.push(dp);
        } else {
          const r = (await saveDraftMovementAction(payload)) as any;
          if (!r.success) {
            toast.error(r.error ?? "Failed");
            return;
          }
          toast.success("Draft saved.");
          router.push(dp);
        }
      } else {
        const bp = {
          movement_type_code: typeCode,
          counterparty_name: counterpartyName || null,
          external_reference: externalReference || null,
          note: note || null,
          idempotency_key: crypto.randomUUID(),
          lines: ls,
        };
        if (andPost) {
          const r = (await createAndPostMovementAction(bp)) as any;
          if (!r.success) {
            toast.error(r.error ?? "Failed");
            return;
          }
          toast.success(`Document ${r.data?.document_number ?? ""} posted.`);
          router.push({
            pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
            params: { movementId: r.data?.movement_id },
          });
        } else {
          const r = (await createDraftMovementAction(bp)) as any;
          if (!r.success) {
            toast.error(r.error ?? "Failed");
            return;
          }
          toast.success(`Draft ${r.data?.draft_number ?? ""} created.`);
          router.push({
            pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
            params: { movementId: r.data?.movement_id },
          });
        }
      }
    });
  }

  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const locLabel = (loc: LocationOption) => (loc.code ? `${loc.code} — ${loc.name}` : loc.name);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col text-sm">
      {/* ── Toolbar ── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold truncate">
            {isEdit ? `Edit ${initialValues?.draftNumber ?? "Draft"}` : "New Movement"}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">·</span>
          <span className="hidden text-xs text-muted-foreground sm:inline truncate">
            {branchName}
          </span>
          {selType && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {selType.document_type_code}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Draft
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => submit(false)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3 w-3" />
            )}
            Save Draft
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => submit(true)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3 w-3" />
            )}
            Save & Post
          </Button>
        </div>
      </div>

      {/* ── Errors ── */}
      {errors.length > 0 && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-3 py-1.5">
          <ul className="list-inside list-disc text-xs text-destructive">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-3 space-y-3">
          {/* ── Movement Type ── */}
          <div className="rounded border bg-card">
            <div className="px-3 py-1.5 border-b bg-muted/40 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Movement Type
              </span>
              <MovementTypeEffectPreview type={selType} />
            </div>
            <div className="p-2">
              <MovementTypePicker
                value={typeCode || null}
                onChange={(code) => {
                  if (code === typeCode) return;
                  if (lines.length > 0) {
                    if (!window.confirm("Changing movement type clears selected items. Continue?"))
                      return;
                    setLines([]);
                  }
                  setTypeCode(code);
                  setSrcLoc("");
                  setDstLoc("");
                }}
                movementTypes={movementTypes}
                readonly={isEdit}
              />
            </div>
          </div>

          {selType && (
            <>
              {/* ── Document Data + Locations ── */}
              <div className="rounded border bg-card">
                <div className="px-3 py-1.5 border-b bg-muted/40">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Document Data
                  </span>
                </div>
                <div className="p-2">
                  <div className="grid gap-x-3 gap-y-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {/* Branch */}
                    {isPZ && (
                      <Field label="Destination Branch">
                        <div className="flex items-center h-8 px-2 rounded-md border border-input bg-muted/30 text-xs text-foreground">
                          {branchName}
                        </div>
                      </Field>
                    )}
                    {is801 && (
                      <Field label="Branch (source & dest.)">
                        <div className="flex items-center h-8 px-2 rounded-md border border-input bg-muted/30 text-xs text-foreground">
                          {branchName}
                        </div>
                      </Field>
                    )}
                    {/* Dates — auto-filled, read-only */}
                    <Field label="Operation Date">
                      <div className="flex items-center h-8 px-2 rounded-md border border-input bg-muted/30 text-xs text-foreground tabular-nums">
                        {initialValues?.operationDate ?? today}
                      </div>
                    </Field>
                    <Field label="Document Date">
                      <div className="flex items-center h-8 px-2 rounded-md border border-input bg-muted/30 text-xs text-muted-foreground tabular-nums">
                        {isEdit
                          ? (initialValues?.documentDate ?? "Set at posting")
                          : "Set at posting"}
                      </div>
                    </Field>
                    <Field label="External Reference">
                      <Input
                        placeholder="PO number..."
                        value={externalReference}
                        onChange={(e) => setExternalReference(e.target.value)}
                        className="h-8"
                      />
                    </Field>
                    {isPZ && (
                      <Field label="Counterparty / Supplier">
                        <Input
                          placeholder="Supplier name..."
                          value={counterpartyName}
                          onChange={(e) => setCounterpartyName(e.target.value)}
                          className="h-8"
                        />
                      </Field>
                    )}
                    {is801 && (
                      <Field label="Source Location / Bin" required>
                        <select
                          value={srcLoc}
                          onChange={(e) => handleSrcChange(e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Select source...</option>
                          {stockableLocations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {locLabel(l)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field
                      label={isPZ ? "Destination Location / Bin" : "Destination Location / Bin"}
                      required
                    >
                      <select
                        value={dstLoc}
                        onChange={(e) => setDstLoc(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Select destination...</option>
                        {stockableLocations
                          .filter((l) => l.id !== srcLoc)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {locLabel(l)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Note">
                      <Input
                        placeholder="Optional note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-8"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* ── Positions ── */}
              <div className="rounded border bg-card flex-1">
                <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Positions · {lines.length} items · {totalQty} qty
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={pickerDisabled}
                    onClick={() => setPickerOpen(true)}
                  >
                    <Search className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                </div>

                {pickerDisabled ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    Select a source location first to add items
                  </div>
                ) : lines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-xs text-muted-foreground mb-2">No items added</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Search className="mr-1 h-3 w-3" /> Search & Add
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="w-8 px-2 py-1.5 text-center">#</th>
                          <th className="px-2 py-1.5 text-left">SKU</th>
                          <th className="px-2 py-1.5 text-left">Product</th>
                          <th className="px-2 py-1.5 text-left w-16">Unit</th>
                          {is801 && <th className="px-2 py-1.5 text-right w-20">Avail.</th>}
                          <th className="px-2 py-1.5 text-right w-24">Qty</th>
                          <th className="w-8 px-2 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((line, idx) => {
                          const q = Number(line.quantity) || 0;
                          const over =
                            is801 && line.on_hand_at_source !== null && q > line.on_hand_at_source;
                          return (
                            <tr key={line.key} className={cn("group", over && "bg-destructive/5")}>
                              <td className="px-2 py-1.5 text-center text-muted-foreground">
                                {idx + 1}
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="font-mono font-medium">{line.sku}</span>
                                {line.barcode && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    {line.barcode}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <span>{line.product_name}</span>
                                {line.brand_name && (
                                  <span className="ml-1 text-muted-foreground">
                                    ({line.brand_name})
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <Badge variant="outline" className="text-[9px]">
                                  {line.unit_code}
                                </Badge>
                              </td>
                              {is801 && (
                                <td className="px-2 py-1.5 text-right font-mono text-emerald-500">
                                  {line.on_hand_at_source ?? "—"}
                                </td>
                              )}
                              <td className="px-2 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0.000001"
                                    step="0.000001"
                                    max={
                                      line.on_hand_at_source !== null
                                        ? line.on_hand_at_source
                                        : undefined
                                    }
                                    value={line.quantity}
                                    onChange={(e) => updateQty(line.key, e.target.value)}
                                    className={cn(
                                      "h-7 w-20 text-right text-xs",
                                      over && "border-destructive"
                                    )}
                                  />
                                  {over && (
                                    <span className="text-[9px] text-destructive whitespace-nowrap">
                                      max {line.on_hand_at_source}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLine(line.key)}
                                  className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border-t px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-xs text-muted-foreground"
                        onClick={() => setPickerOpen(true)}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add another item
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer info ── */}
              <div className="flex items-center justify-between rounded border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  {isPZ && (
                    <span>
                      Effect: <span className="text-emerald-500">+on_hand</span> at destination
                    </span>
                  )}
                  {is801 && (
                    <span>
                      Effect: <span className="text-red-400">−on_hand</span> source →{" "}
                      <span className="text-emerald-500">+on_hand</span> destination
                    </span>
                  )}
                  <span>·</span>
                  <span>
                    Doc: <strong>{selType.document_type_code}</strong>
                  </span>
                </div>
                <span>Document number assigned after posting</span>
              </div>
            </>
          )}
        </div>
      </div>

      <InventoryItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={pickerMode}
        sourceLocationId={is801 ? srcLoc : undefined}
        onAddItems={handlePickerAddItems}
      />
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
