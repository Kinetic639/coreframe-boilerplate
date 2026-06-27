"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "react-toastify";
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
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
import {
  createEnhancedInventoryProductAction,
  createInventoryUnitAction,
  listMovementImportSourcesAction,
  previewMovementImportFromSourceAction,
} from "@/app/actions/warehouse/inventory";
import { normalizeImportedSku, skuCollisionFingerprint } from "@/lib/warehouse/import-utils";
import type {
  InventoryMovementType,
  InventoryUnitRow,
  InventoryVariantOption,
  MovementFieldPolicyBundle,
  MovementImportPreview,
  MovementImportPreviewDocument,
  MovementImportPreviewLine,
  MovementImportSource,
} from "@/lib/warehouse/inventory-types";
import {
  isFieldRequired,
  MOVEMENT_FIELD_KEYS,
  policiesForType,
} from "@/lib/warehouse/movement-field-policy";
import type { ImportedMovementDocumentDraft, LocationOption } from "./types";

type EditableDocument = MovementImportPreviewDocument;
type EditableLine = MovementImportPreviewLine;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementTypes: InventoryMovementType[];
  fieldPolicies: MovementFieldPolicyBundle;
  currentMovementTypeCode: string;
  variants: InventoryVariantOption[];
  units: InventoryUnitRow[];
  stockableLocations: LocationOption[];
  currentDestinationLocationId?: string;
  canManageProducts: boolean;
  onApply: (document: ImportedMovementDocumentDraft) => void;
};

function errorsForLine(
  line: EditableLine,
  fieldPolicies: MovementFieldPolicyBundle,
  movementTypeCode: string,
  options: { deferLocationValidation?: boolean } = {}
) {
  const errors: string[] = [];
  const policies = policiesForType(fieldPolicies, movementTypeCode);
  if (!line.variant_id) errors.push("Product is required");
  if (!line.unit_id) errors.push("Unit is required");
  if (!line.quantity || line.quantity <= 0) errors.push("Quantity is required");
  if (
    !options.deferLocationValidation &&
    isFieldRequired(policies, MOVEMENT_FIELD_KEYS.sourceLocationId) &&
    !line.source_location_id
  )
    errors.push("Source location is required");
  if (
    !options.deferLocationValidation &&
    isFieldRequired(policies, MOVEMENT_FIELD_KEYS.destinationLocationId) &&
    !line.destination_location_id
  )
    errors.push("Destination location is required");
  if (
    !options.deferLocationValidation &&
    line.source_location_id &&
    line.destination_location_id &&
    line.source_location_id === line.destination_location_id
  ) {
    errors.push("Source and destination locations must differ");
  }
  return errors;
}

function documentWithRevalidatedLines(
  document: EditableDocument,
  fieldPolicies: MovementFieldPolicyBundle,
  movementTypeCode: string,
  options: { deferLocationValidation?: boolean } = {}
): EditableDocument {
  const lines = document.lines.map((line) => ({
    ...line,
    validation_errors: errorsForLine(line, fieldPolicies, movementTypeCode, options),
  }));
  return {
    ...document,
    validation_errors: [...new Set(lines.flatMap((line) => line.validation_errors))],
    lines,
  };
}

function locationLabel(location: LocationOption) {
  return location.code ? `${location.code} - ${location.name}` : location.name;
}

function variantLabel(variant: InventoryVariantOption) {
  return `${variant.sku} - ${variant.product_name}`;
}

function rawMetadataString(line: EditableLine, key: string) {
  const value = line.raw_metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function lineOrderNumber(line: EditableLine) {
  return (
    rawMetadataString(line, "movement_order_number") ??
    rawMetadataString(line, "zl_number") ??
    rawMetadataString(line, "order_number") ??
    rawMetadataString(line, "zw_number")
  );
}

function lineContextNote(line: EditableLine) {
  const orderNumber = lineOrderNumber(line);
  return orderNumber ? `Zlecenie: ${orderNumber}` : null;
}

function rawProductKey(line: EditableLine) {
  return skuCollisionFingerprint(line.raw_product_code);
}

function rawUnitKey(line: EditableLine) {
  return skuCollisionFingerprint(line.raw_unit);
}

export function MovementImportDialog({
  open,
  onOpenChange,
  movementTypes,
  fieldPolicies,
  currentMovementTypeCode,
  variants,
  units,
  stockableLocations,
  currentDestinationLocationId,
  canManageProducts,
  onApply,
}: Props) {
  const [sources, setSources] = useState<MovementImportSource[]>([]);
  const [sourceType, setSourceType] = useState("");
  const [sourceInput, setSourceInput] = useState<Record<string, string>>({});
  const [movementTypeCode, setMovementTypeCode] = useState(currentMovementTypeCode);
  const [preview, setPreview] = useState<MovementImportPreview | null>(null);
  const [documents, setDocuments] = useState<EditableDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [variantOptions, setVariantOptions] = useState(variants);
  const [unitOptions, setUnitOptions] = useState(units);
  const [quickCreatePendingKey, setQuickCreatePendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSource = sources.find((source) => source.source_type === sourceType) ?? null;
  const selectedDocument =
    documents.find((document) => document.source_document_id === selectedDocumentId) ?? null;
  const selectedDocumentErrors = selectedDocument?.validation_errors ?? [];
  const isSvwmsSessionImport = preview?.source_type === "svwms_wdd_matcher";
  const showDocumentSelector = documents.length > 1 && !isSvwmsSessionImport;
  const deferLocationValidation = isSvwmsSessionImport;
  const canApply =
    Boolean(selectedDocument) &&
    selectedDocumentErrors.length === 0 &&
    selectedDocument!.lines.length > 0;

  useEffect(() => {
    if (!open) return;
    setMovementTypeCode((current) => current || currentMovementTypeCode || movementTypes[0]?.code);
  }, [currentMovementTypeCode, movementTypes, open]);

  useEffect(() => {
    if (!open || !movementTypeCode) return;
    startTransition(async () => {
      const result = await listMovementImportSourcesAction({
        movement_type_code: movementTypeCode,
      });
      if (!result.success || !("data" in result)) {
        toast.error("Could not load movement import sources");
        return;
      }
      setSources(result.data);
      setSourceType((current) =>
        current && result.data.some((source) => source.source_type === current)
          ? current
          : result.data[0]?.source_type || ""
      );
      setSourceInput({});
      setPreview(null);
      setDocuments([]);
      setSelectedDocumentId("");
    });
  }, [movementTypeCode, open]);

  useEffect(() => setVariantOptions(variants), [variants]);
  useEffect(() => setUnitOptions(units), [units]);

  const handlePreview = () => {
    if (!sourceType || !movementTypeCode) return;
    const source = sources.find((item) => item.source_type === sourceType);
    const missingField = source?.input_fields.find(
      (field) => field.required && !sourceInput[field.key]?.trim()
    );
    if (missingField) {
      toast.error(`${missingField.label} is required`);
      return;
    }

    startTransition(async () => {
      const result = await previewMovementImportFromSourceAction({
        source_type: sourceType,
        source_input: sourceInput,
        movement_type_code: movementTypeCode,
      });
      if (!result.success || !("data" in result)) {
        toast.error("Could not preview movement import");
        return;
      }
      const nextDeferLocationValidation = result.data.source_type === "svwms_wdd_matcher";
      const nextDocuments = result.data.documents.map((document) =>
        documentWithRevalidatedLines(document, fieldPolicies, movementTypeCode, {
          deferLocationValidation: nextDeferLocationValidation,
        })
      );
      setPreview(result.data);
      setDocuments(nextDocuments);
      setSelectedDocumentId(nextDocuments[0]?.source_document_id ?? "");
    });
  };

  const updateLine = (
    sourceLineId: string,
    updates: Partial<
      Pick<
        EditableLine,
        "variant_id" | "unit_id" | "source_location_id" | "destination_location_id" | "quantity"
      >
    >
  ) => {
    setDocuments((current) =>
      current.map((document) => {
        if (document.source_document_id !== selectedDocumentId) return document;
        const nextDocument = {
          ...document,
          lines: document.lines.map((line) => {
            if (line.source_line_id !== sourceLineId) return line;
            const nextLine = { ...line, ...updates };
            if (updates.variant_id) {
              const variant = variantOptions.find((item) => item.id === updates.variant_id);
              if (variant) nextLine.unit_id = variant.unit_id;
            }
            return nextLine;
          }),
        };
        return documentWithRevalidatedLines(nextDocument, fieldPolicies, movementTypeCode, {
          deferLocationValidation,
        });
      })
    );
  };

  const updateMatchingLines = (
    predicate: (line: EditableLine) => boolean,
    updates: Partial<
      Pick<
        EditableLine,
        "variant_id" | "unit_id" | "source_location_id" | "destination_location_id"
      >
    >
  ) => {
    setDocuments((current) =>
      current.map((document) =>
        documentWithRevalidatedLines(
          {
            ...document,
            lines: document.lines.map((line) => (predicate(line) ? { ...line, ...updates } : line)),
          },
          fieldPolicies,
          movementTypeCode,
          { deferLocationValidation }
        )
      )
    );
  };

  const handleMapUnitGroup = (groupKey: string, unitId: string) => {
    updateMatchingLines((candidate) => !candidate.unit_id && rawUnitKey(candidate) === groupKey, {
      unit_id: unitId || null,
    });
  };

  const handleMapProductGroup = (groupKey: string, variantId: string) => {
    const variant = variantOptions.find((item) => item.id === variantId);
    updateMatchingLines(
      (candidate) => !candidate.variant_id && rawProductKey(candidate) === groupKey,
      variant ? { variant_id: variant.id, unit_id: variant.unit_id } : { variant_id: null }
    );
  };

  const handleCreateMissingUnits = async () => {
    if (!canManageProducts) return;
    if (svwmsMissingUnitGroups.length === 0) return;
    setQuickCreatePendingKey("bulk-units");
    const created = new Map<string, InventoryUnitRow>();
    for (const group of svwmsMissingUnitGroups) {
      const code = normalizeImportedSku(group.rawUnit);
      if (!code) continue;
      const result = await createInventoryUnitAction({
        code,
        name: code,
        unit_kind: "count",
        precision: 0,
      });
      if (!result.success || !("data" in result)) {
        setQuickCreatePendingKey(null);
        toast.error(`Could not create unit ${code}`);
        return;
      }
      created.set(group.key, result.data);
    }
    setQuickCreatePendingKey(null);
    if (created.size === 0) {
      toast.error("No missing units could be created");
      return;
    }
    setUnitOptions((current) =>
      [...current, ...Array.from(created.values())].sort((a, b) => a.code.localeCompare(b.code))
    );
    setDocuments((current) =>
      current.map((document) =>
        documentWithRevalidatedLines(
          {
            ...document,
            lines: document.lines.map((line) => {
              if (line.unit_id) return line;
              const unit = created.get(rawUnitKey(line));
              return unit ? { ...line, unit_id: unit.id } : line;
            }),
          },
          fieldPolicies,
          movementTypeCode,
          { deferLocationValidation }
        )
      )
    );
    toast.success(`Created ${created.size} unit${created.size === 1 ? "" : "s"}`);
  };

  const handleCreateMissingProducts = async () => {
    if (!canManageProducts) return;
    if (svwmsMissingProductGroups.length === 0) return;
    const missingUnitGroup = svwmsMissingProductGroups.find((group) =>
      group.lines.some((line) => !line.unit_id)
    );
    if (missingUnitGroup) {
      toast.error("Resolve units before creating missing products");
      return;
    }
    setQuickCreatePendingKey("bulk-products");
    const created = new Map<string, InventoryVariantOption>();
    for (const group of svwmsMissingProductGroups) {
      const first = group.lines[0];
      const sku = normalizeImportedSku(group.rawCode);
      const unitId = first.unit_id;
      if (!sku || !unitId) continue;
      const unit = unitOptions.find((item) => item.id === unitId);
      const name = group.rawName?.trim() || sku;
      const result = await createEnhancedInventoryProductAction({
        name,
        product_type: "stocked",
        base_unit_id: unitId,
        sku,
        returnable: true,
        track_inventory: false,
        variants: [{ sku, name }],
        attributes: [],
        tags: [],
        custom_fields: [],
        unit_conversions: [],
      });
      if (!result.success || !("data" in result)) {
        setQuickCreatePendingKey(null);
        toast.error(`Could not create product ${sku}`);
        return;
      }
      const variantId = result.data.variant_ids[0];
      if (!variantId) {
        setQuickCreatePendingKey(null);
        toast.error(`Created product ${sku} did not return a variant`);
        return;
      }
      created.set(group.key, {
        id: variantId,
        sku: result.data.sku ?? sku,
        label: `${sku} - ${name}`,
        product_name: name,
        unit_id: unitId,
        unit_code: unit?.code ?? first.raw_unit ?? "",
      });
    }
    setQuickCreatePendingKey(null);
    if (created.size === 0) {
      toast.error("No missing products could be created");
      return;
    }
    setVariantOptions((current) =>
      [...current, ...Array.from(created.values())].sort((a, b) => a.sku.localeCompare(b.sku))
    );
    setDocuments((current) =>
      current.map((document) =>
        documentWithRevalidatedLines(
          {
            ...document,
            lines: document.lines.map((line) => {
              if (line.variant_id) return line;
              const variant = created.get(rawProductKey(line));
              return variant ? { ...line, variant_id: variant.id, unit_id: variant.unit_id } : line;
            }),
          },
          fieldPolicies,
          movementTypeCode,
          { deferLocationValidation }
        )
      )
    );
    toast.success(`Created ${created.size} product${created.size === 1 ? "" : "s"}`);
  };

  const handleApply = () => {
    if (!selectedDocument || !canApply) return;
    onApply({
      movementTypeCode,
      senderName: selectedDocument.sender_name,
      recipientName: selectedDocument.recipient_name,
      externalReference: selectedDocument.external_reference,
      note: preview
        ? `Imported from ${preview.source_label}: ${
            selectedDocument.source_document_number ?? selectedDocument.source_document_id
          }`
        : null,
      lines: selectedDocument.lines.map((line) => {
        const variant = variantOptions.find((item) => item.id === line.variant_id);
        const unit = unitOptions.find((item) => item.id === line.unit_id);
        return {
          variant_id: line.variant_id!,
          unit_id: line.unit_id!,
          sku: variant?.sku,
          product_name: variant?.product_name,
          unit_code: unit?.code ?? variant?.unit_code,
          quantity: line.quantity!,
          source_location_id: line.source_location_id,
          destination_location_id: isSvwmsSessionImport
            ? currentDestinationLocationId || null
            : line.destination_location_id,
          note: isSvwmsSessionImport ? lineContextNote(line) : null,
        };
      }),
    });
    onOpenChange(false);
    toast.success("Imported data filled the movement form");
  };

  const unitById = useMemo(
    () => new Map(unitOptions.map((unit) => [unit.id, unit])),
    [unitOptions]
  );
  const svwmsLines = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    return [...selectedDocument.lines].sort((left, right) => {
      const leftOrder = lineOrderNumber(left) ?? "\uffff";
      const rightOrder = lineOrderNumber(right) ?? "\uffff";
      const orderCompare = leftOrder.localeCompare(rightOrder, "pl", {
        numeric: true,
        sensitivity: "base",
      });
      if (orderCompare !== 0) return orderCompare;
      return (
        left.line_number - right.line_number ||
        left.source_line_id.localeCompare(right.source_line_id)
      );
    });
  }, [isSvwmsSessionImport, selectedDocument]);
  const svwmsMissingUnitGroups = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    const groups = new Map<string, { key: string; rawUnit: string; lines: EditableLine[] }>();
    for (const line of selectedDocument.lines) {
      if (line.unit_id || !line.raw_unit) continue;
      const key = rawUnitKey(line);
      if (!key) continue;
      const current = groups.get(key) ?? { key, rawUnit: line.raw_unit, lines: [] };
      current.lines.push(line);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [isSvwmsSessionImport, selectedDocument]);
  const svwmsProductExceptionGroups = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    const groups = new Map<
      string,
      {
        key: string;
        rawCode: string;
        rawName: string;
        lines: EditableLine[];
        ambiguous: boolean;
      }
    >();
    for (const line of selectedDocument.lines) {
      if (line.variant_id || !line.raw_product_code) continue;
      const key = rawProductKey(line);
      if (!key) continue;
      const current = groups.get(key) ?? {
        key,
        rawCode: line.raw_product_code,
        rawName: line.raw_product_name ?? line.raw_product_code,
        lines: [],
        ambiguous: false,
      };
      current.lines.push(line);
      current.ambiguous ||= line.validation_errors.some((error) =>
        error.toLowerCase().includes("multiple")
      );
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [isSvwmsSessionImport, selectedDocument]);
  const svwmsMissingProductGroups = useMemo(
    () => svwmsProductExceptionGroups.filter((group) => !group.ambiguous),
    [svwmsProductExceptionGroups]
  );
  const svwmsResolvedLineCount = useMemo(
    () =>
      selectedDocument?.lines.filter((line) => line.variant_id && line.unit_id && line.quantity)
        .length ?? 0,
    [selectedDocument]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Import movement data</DialogTitle>
          <DialogDescription>
            Preview source data, resolve missing fields, then fill the unsaved movement form.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-9rem)] overflow-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              Movement type
              <select
                value={movementTypeCode}
                onChange={(event) => setMovementTypeCode(event.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {movementTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.code} - {type.name_pl ?? type.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Source
              <select
                value={sourceType}
                onChange={(event) => {
                  setSourceType(event.target.value);
                  setSourceInput({});
                  setPreview(null);
                  setDocuments([]);
                  setSelectedDocumentId("");
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {sources.map((source) => (
                  <option key={source.source_type} value={source.source_type}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>

            {sources.length === 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 md:col-span-3">
                No import sources are available for this movement type.
              </div>
            )}

            {(selectedSource?.input_fields ?? []).map((field) => (
              <label key={field.key} className="grid gap-1 text-sm font-medium">
                {field.label}
                {field.type === "select" ? (
                  <select
                    value={sourceInput[field.key] ?? ""}
                    onChange={(event) =>
                      setSourceInput((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">{field.placeholder ?? "Select"}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={sourceInput[field.key] ?? ""}
                    onChange={(event) =>
                      setSourceInput((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="h-9"
                  />
                )}
                {field.type === "select" && (field.options ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No branch sessions are ready to import.
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={handlePreview} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Preview data
            </Button>
          </div>

          {documents.length > 0 && (
            <div className="mt-5 space-y-4">
              {showDocumentSelector && (
                <div className="grid gap-1 text-sm font-medium">
                  Source document
                  <select
                    value={selectedDocumentId}
                    onChange={(event) => setSelectedDocumentId(event.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {documents.map((document) => (
                      <option key={document.source_document_id} value={document.source_document_id}>
                        {document.source_document_number ?? document.source_document_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDocumentErrors.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{selectedDocumentErrors.join(", ")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  This source document is ready to fill the form.
                </div>
              )}

              {isSvwmsSessionImport ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <ImportSummaryTile
                      label="Imported lines"
                      value={selectedDocument?.lines.length ?? 0}
                    />
                    <ImportSummaryTile label="Ready" value={svwmsResolvedLineCount} good />
                    <ImportSummaryTile
                      label="Missing units"
                      value={svwmsMissingUnitGroups.length}
                      muted={svwmsMissingUnitGroups.length === 0}
                    />
                    <ImportSummaryTile
                      label="Product exceptions"
                      value={svwmsProductExceptionGroups.length}
                      muted={svwmsProductExceptionGroups.length === 0}
                    />
                  </div>

                  {(svwmsMissingUnitGroups.length > 0 ||
                    svwmsProductExceptionGroups.length > 0) && (
                    <div className="rounded-md border bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                        <div>
                          <p className="font-medium">Resolve import exceptions</p>
                          <p className="text-xs text-muted-foreground">
                            Resolve each imported code once; matching rows update together.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canManageProducts && svwmsMissingUnitGroups.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleCreateMissingUnits}
                              disabled={quickCreatePendingKey !== null}
                            >
                              {quickCreatePendingKey === "bulk-units" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <PlusCircle className="mr-2 h-4 w-4" />
                              )}
                              Create missing units
                            </Button>
                          )}
                          {canManageProducts && svwmsMissingProductGroups.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleCreateMissingProducts}
                              disabled={
                                quickCreatePendingKey !== null ||
                                svwmsMissingProductGroups.some((group) =>
                                  group.lines.some((line) => !line.unit_id)
                                )
                              }
                            >
                              {quickCreatePendingKey === "bulk-products" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <PlusCircle className="mr-2 h-4 w-4" />
                              )}
                              Create missing products
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 p-3">
                        {svwmsMissingUnitGroups.map((group) => (
                          <div
                            key={group.key}
                            className="grid items-center gap-2 rounded-md border bg-background p-2 md:grid-cols-[1fr_220px]"
                          >
                            <div>
                              <div className="font-mono text-sm font-medium">{group.rawUnit}</div>
                              <div className="text-xs text-muted-foreground">
                                {group.lines.length} row{group.lines.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <select
                              value=""
                              onChange={(event) =>
                                handleMapUnitGroup(group.key, event.target.value)
                              }
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="">Map to existing unit</option>
                              {unitOptions.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.code} - {unit.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}

                        {svwmsProductExceptionGroups.map((group) => (
                          <div
                            key={group.key}
                            className="grid items-center gap-2 rounded-md border bg-background p-2 md:grid-cols-[1fr_280px]"
                          >
                            <div>
                              <div className="font-mono text-sm font-medium">{group.rawCode}</div>
                              <div className="text-xs text-muted-foreground">
                                {group.rawName} · {group.lines.length} row
                                {group.lines.length === 1 ? "" : "s"}
                                {group.ambiguous ? " · multiple matches" : ""}
                              </div>
                            </div>
                            <select
                              value=""
                              onChange={(event) =>
                                handleMapProductGroup(group.key, event.target.value)
                              }
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="">Map to existing product</option>
                              {variantOptions.map((variant) => (
                                <option key={variant.id} value={variant.id}>
                                  {variantLabel(variant)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Zlecenie / Order</th>
                          <th className="px-3 py-2 text-left">Product code</th>
                          <th className="px-3 py-2 text-left">Product name</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Product match</th>
                          <th className="px-3 py-2 text-left">Unit match</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {svwmsLines.map((line) => {
                          const variant = variantOptions.find(
                            (item) => item.id === line.variant_id
                          );
                          const unit = line.unit_id ? unitById.get(line.unit_id) : null;
                          const ready = !!line.variant_id && !!line.unit_id && !!line.quantity;
                          return (
                            <tr key={line.source_line_id}>
                              <td className="px-3 py-2 font-mono text-xs">
                                {lineOrderNumber(line) ?? "-"}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {line.raw_product_code ?? "-"}
                              </td>
                              <td className="px-3 py-2">{line.raw_product_name ?? "-"}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {line.quantity ?? "-"}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {line.raw_unit ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {variant ? variantLabel(variant) : "Missing"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {unit ? `${unit.code} - ${unit.name}` : "Missing"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {ready ? (
                                  <span className="text-emerald-700">Ready</span>
                                ) : (
                                  <span className="text-destructive">
                                    {line.validation_errors.join(", ") || "Needs resolution"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Imported item</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-left">Destination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedDocument?.lines ?? []).map((line) => {
                        const selectedUnit = line.unit_id ? unitById.get(line.unit_id) : null;
                        return (
                          <tr key={line.source_line_id}>
                            <td className="px-3 py-2 align-top">
                              <div className="font-mono text-xs">
                                {line.raw_product_code ?? "-"}
                              </div>
                              <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                                {line.raw_product_name ?? "-"}
                              </div>
                              {line.validation_errors.length > 0 && (
                                <div className="mt-1 text-xs text-destructive">
                                  {line.validation_errors.join(", ")}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.variant_id ?? ""}
                                onChange={(event) =>
                                  updateLine(line.source_line_id, {
                                    variant_id: event.target.value || null,
                                  })
                                }
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">Select product</option>
                                {variantOptions.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {variantLabel(variant)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.unit_id ?? ""}
                                onChange={(event) =>
                                  updateLine(line.source_line_id, {
                                    unit_id: event.target.value || null,
                                  })
                                }
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">Select unit</option>
                                {unitOptions.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.code} - {unit.name}
                                  </option>
                                ))}
                              </select>
                              {selectedUnit && (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  Imported: {line.raw_unit ?? "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Input
                                type="number"
                                min="0.000001"
                                value={line.quantity ?? ""}
                                onChange={(event) =>
                                  updateLine(line.source_line_id, {
                                    quantity: event.target.value
                                      ? Number(event.target.value)
                                      : null,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.source_location_id ?? ""}
                                onChange={(event) =>
                                  updateLine(line.source_line_id, {
                                    source_location_id: event.target.value || null,
                                  })
                                }
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">No source</option>
                                {stockableLocations.map((location) => (
                                  <option key={location.id} value={location.id}>
                                    {locationLabel(location)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.destination_location_id ?? ""}
                                onChange={(event) =>
                                  updateLine(line.source_line_id, {
                                    destination_location_id: event.target.value || null,
                                  })
                                }
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">No destination</option>
                                {stockableLocations.map((location) => (
                                  <option key={location.id} value={location.id}>
                                    {locationLabel(location)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={!canApply || isPending}>
            Fill movement form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportSummaryTile({
  label,
  value,
  good = false,
  muted = false,
}: {
  label: string;
  value: number;
  good?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div
        className={
          good
            ? "mt-1 text-2xl font-semibold text-emerald-700"
            : muted
              ? "mt-1 text-2xl font-semibold text-muted-foreground"
              : "mt-1 text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
