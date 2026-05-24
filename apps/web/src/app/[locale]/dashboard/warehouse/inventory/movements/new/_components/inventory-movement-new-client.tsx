"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, PackageSearch, Plus, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import { cn } from "@/lib/utils";
import {
  createDraftMovementAction,
  createInventoryBranchTransferAction,
  postMovementAction,
} from "@/app/actions/warehouse/inventory";

type BranchOption = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type OperationType =
  | "receipt"
  | "issue"
  | "transfer"
  | "adjust_increase"
  | "adjust_decrease"
  | "branch_transfer";

type InventoryMovementNewClientProps = {
  activeBranchId: string;
  canAdjust: boolean;
  branches: BranchOption[];
  locations: LocationOption[];
  variants: InventoryVariantOption[];
};

type MovementLineDraft = {
  key: string;
  variant_id: string;
  source_location_id: string | null;
  unit_id: string;
  quantity: number;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);
}

function getVariantAvailableQuantity(
  variant: InventoryVariantOption,
  sourceLocationId: string
): number {
  if (!sourceLocationId) return variant.available_quantity ?? 0;
  return (
    variant.location_summaries?.find((location) => location.location_id === sourceLocationId)
      ?.available_quantity ?? 0
  );
}

function getVariantOnHandQuantity(
  variant: InventoryVariantOption,
  sourceLocationId: string
): number {
  if (!sourceLocationId) return variant.on_hand_quantity ?? 0;
  return (
    variant.location_summaries?.find((location) => location.location_id === sourceLocationId)
      ?.on_hand_quantity ?? 0
  );
}

function formatLocationName(location: {
  location_name: string;
  location_code: string | null;
}): string {
  return location.location_code
    ? `${location.location_code} - ${location.location_name}`
    : location.location_name;
}

function movementIdFromResult(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value = record.movement_id ?? record.id;
  return typeof value === "string" ? value : null;
}

export function InventoryMovementNewClient({
  activeBranchId,
  canAdjust,
  branches,
  locations,
  variants,
}: InventoryMovementNewClientProps) {
  const t = useTranslations("warehouseInventory.movements");
  const tt = useTranslations("warehouseInventory.transfers");
  const tc = useTranslations("warehouseInventory.common");
  const router = useRouter();
  const [operationType, setOperationType] = useState<OperationType>("receipt");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState<MovementLineDraft[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId),
    [selectedVariantId, variants]
  );
  const destinationBranches = branches.filter((branch) => branch.id !== activeBranchId);
  const needsSource = ["issue", "transfer", "adjust_decrease", "branch_transfer"].includes(
    operationType
  );
  const needsDestination = ["receipt", "transfer", "adjust_increase"].includes(operationType);
  const isAdjustment = operationType === "adjust_increase" || operationType === "adjust_decrease";
  const selectedLocationOptions = useMemo(() => {
    if (!selectedVariant) return [];
    return [...(selectedVariant.location_summaries ?? [])]
      .filter((location) => location.available_quantity > 0)
      .sort((a, b) => formatLocationName(a).localeCompare(formatLocationName(b)));
  }, [selectedVariant]);
  const selectedAvailableQuantity = selectedVariant
    ? getVariantAvailableQuantity(selectedVariant, sourceLocationId)
    : 0;
  const selectedOnHandQuantity = selectedVariant
    ? getVariantOnHandQuantity(selectedVariant, sourceLocationId)
    : 0;
  const selectedUnit = selectedVariant?.unit_code || tt("unitBase");
  const filteredVariants = useMemo(() => {
    const query = itemSearch.trim().toLocaleLowerCase();

    return variants.filter((variant) => {
      const matchesQuery =
        !query ||
        variant.label.toLocaleLowerCase().includes(query) ||
        variant.sku.toLocaleLowerCase().includes(query) ||
        variant.product_name.toLocaleLowerCase().includes(query);

      if (!matchesQuery) return false;
      if (!needsSource || !availableOnly) return true;
      return (variant.available_quantity ?? 0) > 0;
    });
  }, [availableOnly, itemSearch, needsSource, variants]);
  const selectedIsUnavailable = Boolean(
    needsSource && selectedVariant && sourceLocationId && selectedAvailableQuantity <= 0
  );
  const needsSourceLocationSelection = Boolean(needsSource && selectedVariant && !sourceLocationId);
  const parsedQuantity = Number(quantity);
  const canAddLine = Boolean(
    selectedVariant &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    (!needsSource || sourceLocationId) &&
    (!needsSource || selectedAvailableQuantity >= parsedQuantity)
  );

  const resetDraftLine = () => {
    setSelectedVariantId("");
    setSourceLocationId("");
    setQuantity("");
  };

  const addLine = () => {
    if (!selectedVariant || !canAddLine) return;

    const key = `${selectedVariant.id}:${needsSource ? sourceLocationId : "none"}`;
    const nextLine: MovementLineDraft = {
      key,
      variant_id: selectedVariant.id,
      source_location_id: needsSource ? sourceLocationId : null,
      unit_id: selectedVariant.unit_id,
      quantity: parsedQuantity,
    };

    setLines((current) => {
      const existing = current.findIndex((line) => line.key === key);
      if (existing === -1) return [...current, nextLine];
      return current.map((line, index) => (index === existing ? nextLine : line));
    });
    resetDraftLine();
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const submitMovement = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const destination_location_id = String(formData.get("destination_location_id") ?? "");
      const note = String(formData.get("note") ?? "") || null;

      if (lines.length === 0) {
        setMessage(t("noLinesSelected"));
        return;
      }

      const result =
        operationType === "branch_transfer"
          ? await createInventoryBranchTransferAction({
              destination_branch_id: String(formData.get("destination_branch_id") ?? ""),
              notes: note,
              lines: lines.map((line) => ({
                variant_id: line.variant_id,
                source_location_id: line.source_location_id ?? "",
                unit_id: line.unit_id,
                quantity: line.quantity,
                lot_id: null,
                serial_id: null,
              })),
            })
          : await createDraftMovementAction({
              movement_kind:
                operationType === "adjust_increase" || operationType === "adjust_decrease"
                  ? "adjustment"
                  : operationType,
              adjustment_direction:
                operationType === "adjust_increase"
                  ? "increase"
                  : operationType === "adjust_decrease"
                    ? "decrease"
                    : null,
              reason_id: null,
              note,
              lines: lines.map((line) => ({
                variant_id: line.variant_id,
                source_location_id: line.source_location_id,
                destination_location_id:
                  operationType === "receipt" ||
                  operationType === "transfer" ||
                  operationType === "adjust_increase"
                    ? destination_location_id
                    : null,
                lot_id: null,
                serial_id: null,
                unit_id: line.unit_id,
                quantity: line.quantity,
                unit_cost: null,
                total_cost: null,
                currency: null,
                note: null,
              })),
            });

      if (result.success && operationType !== "branch_transfer") {
        const movementId = "data" in result ? movementIdFromResult(result.data) : null;
        if (!movementId) {
          setMessage(tc("unexpectedError"));
          return;
        }

        const postResult = await postMovementAction({ id: movementId });
        if (!postResult.success) {
          setMessage("error" in postResult ? postResult.error : tc("unexpectedError"));
          return;
        }
      }

      if (result.success) {
        router.push("/dashboard/warehouse/inventory/movements");
        router.refresh();
        return;
      }

      setMessage("error" in result ? result.error : tc("unexpectedError"));
    });
  };

  return (
    <form action={submitMovement} className="max-w-5xl space-y-6 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("operationDetails")}</h2>
          <p className="text-sm text-muted-foreground">{t("operationDetailsHelp")}</p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/warehouse/inventory/movements">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToMovements")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          {t("operationType")}
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={operationType}
            onChange={(event) => {
              const nextOperationType = event.target.value as OperationType;
              setOperationType(nextOperationType);
              setLines([]);
              resetDraftLine();
            }}
          >
            <option value="receipt">{t("receipt")}</option>
            <option value="issue">{t("issue")}</option>
            <option value="transfer">{t("internalTransfer")}</option>
            {canAdjust ? <option value="adjust_increase">{t("adjustIncrease")}</option> : null}
            {canAdjust ? <option value="adjust_decrease">{t("adjustDecrease")}</option> : null}
            <option value="branch_transfer">{t("branchTransfer")}</option>
          </select>
        </label>

        {operationType === "branch_transfer" ? (
          <label className="grid gap-2 text-sm font-medium">
            {tt("destinationBranch")}
            <select
              name="destination_branch_id"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">{tc("select")}</option>
              {destinationBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("itemPicker")}</div>
              <p className="text-xs text-muted-foreground">
                {needsSource ? t("itemPickerAvailabilityHelp") : t("itemPickerHelp")}
              </p>
            </div>
            {needsSource ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={availableOnly}
                  onChange={(event) => setAvailableOnly(event.target.checked)}
                />
                {t("availableOnly")}
              </label>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder={t("searchItems")}
              className="pl-9"
            />
          </div>

          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1fr_9rem_8rem_8rem] gap-3 border-b bg-muted/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <span>{tc("product")}</span>
              <span>{tc("sku")}</span>
              <span>{t("available")}</span>
              <span>{t("onHand")}</span>
            </div>
            <div className="max-h-72 overflow-auto">
              {filteredVariants.length ? (
                filteredVariants.map((variant) => {
                  const availableQuantity = variant.available_quantity ?? 0;
                  const onHandQuantity = variant.on_hand_quantity ?? 0;
                  const isSelected = selectedVariantId === variant.id;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={cn(
                        "grid w-full grid-cols-[1fr_9rem_8rem_8rem] gap-3 border-b px-3 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/60",
                        isSelected && "bg-primary/10 text-primary"
                      )}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setSourceLocationId("");
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-background",
                            isSelected && "border-primary"
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <PackageSearch className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{variant.product_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {variant.label}
                          </span>
                        </span>
                      </span>
                      <span className="truncate font-mono text-xs">{variant.sku}</span>
                      <span>
                        {formatQuantity(availableQuantity)} {variant.unit_code}
                      </span>
                      <span className="text-muted-foreground">
                        {formatQuantity(onHandQuantity)} {variant.unit_code}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("noItemsMatch")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-sm font-medium">
          {tc("unit")}
          <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {selectedVariant
              ? tt("unitSelected", { unit: selectedUnit })
              : tt("unitFollowsVariant")}
          </div>
        </div>

        {needsSource ? (
          <label className="grid gap-2 text-sm font-medium">
            {t("sourceLocation")}
            <select
              name="source_location_id"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sourceLocationId}
              onChange={(event) => setSourceLocationId(event.target.value)}
              required
              disabled={!selectedVariant || selectedLocationOptions.length === 0}
            >
              <option value="">
                {selectedVariant ? t("selectSourceAfterItem") : t("selectItemFirst")}
              </option>
              {selectedLocationOptions.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {formatLocationName(location)} · {formatQuantity(location.available_quantity)}{" "}
                  {selectedUnit}
                </option>
              ))}
            </select>
            {selectedVariant && selectedLocationOptions.length === 0 ? (
              <span className="text-xs text-destructive">{t("noSourceLocations")}</span>
            ) : null}
          </label>
        ) : null}

        {needsDestination ? (
          <label className="grid gap-2 text-sm font-medium">
            {t("destinationLocation")}
            <select
              name="destination_location_id"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">{tc("select")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code ? `${location.code} - ${location.name}` : location.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-medium">
          {t("quantityToAdd")}
          <Input
            type="number"
            min="0.000001"
            max={
              needsSource && selectedAvailableQuantity > 0 ? selectedAvailableQuantity : undefined
            }
            step="0.000001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
      </div>

      {selectedVariant ? (
        <div
          className={cn(
            "grid gap-2 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-3",
            selectedIsUnavailable && "border-destructive/50 bg-destructive/10"
          )}
        >
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {t("selectedItem")}
            </div>
            <div className="font-medium">{selectedVariant.product_name}</div>
            <div className="font-mono text-xs text-muted-foreground">{selectedVariant.sku}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {t("available")}
            </div>
            <div>
              {formatQuantity(selectedAvailableQuantity)} {selectedUnit}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {t("onHand")}
            </div>
            <div>
              {formatQuantity(selectedOnHandQuantity)} {selectedUnit}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={!canAddLine} onClick={addLine}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addLine")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-3 py-2">
          <div>
            <div className="text-sm font-semibold">{t("selectedLines")}</div>
            <div className="text-xs text-muted-foreground">
              {t("selectedLinesHelp", { count: lines.length })}
            </div>
          </div>
        </div>
        {lines.length ? (
          <div className="divide-y">
            {lines.map((line) => {
              const variant = variants.find((item) => item.id === line.variant_id);
              const sourceLocation = variant?.location_summaries?.find(
                (location) => location.location_id === line.source_location_id
              );

              return (
                <div
                  key={line.key}
                  className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[1fr_9rem_10rem_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {variant?.product_name ?? line.variant_id}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{variant?.label}</div>
                  </div>
                  <div className="truncate font-mono text-xs">{variant?.sku}</div>
                  <div className="text-muted-foreground">
                    {formatQuantity(line.quantity)} {variant?.unit_code}
                    {sourceLocation ? (
                      <span className="block text-xs">{formatLocationName(sourceLocation)}</span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeLine")}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("noLinesSelected")}
          </div>
        )}
      </div>

      <label className="grid gap-2 text-sm font-medium">
        {tc("notes")}
        <Input name="note" />
      </label>

      {isAdjustment ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-muted-foreground">
          {t("adjustmentWarning")}
        </p>
      ) : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || lines.length === 0}>
          <Send className="mr-2 h-4 w-4" />
          {t("postOperation")}
        </Button>
      </div>
    </form>
  );
}
