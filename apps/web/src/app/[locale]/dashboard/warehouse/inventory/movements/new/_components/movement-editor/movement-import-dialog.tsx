"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "react-toastify";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
  listMovementImportSourcesAction,
  previewMovementImportFromSourceAction,
} from "@/app/actions/warehouse/inventory";
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
  onApply: (document: ImportedMovementDocumentDraft) => void;
};

function errorsForLine(
  line: EditableLine,
  fieldPolicies: MovementFieldPolicyBundle,
  movementTypeCode: string
) {
  const errors: string[] = [];
  const policies = policiesForType(fieldPolicies, movementTypeCode);
  if (!line.variant_id) errors.push("Product is required");
  if (!line.unit_id) errors.push("Unit is required");
  if (!line.quantity || line.quantity <= 0) errors.push("Quantity is required");
  if (isFieldRequired(policies, MOVEMENT_FIELD_KEYS.sourceLocationId) && !line.source_location_id)
    errors.push("Source location is required");
  if (
    isFieldRequired(policies, MOVEMENT_FIELD_KEYS.destinationLocationId) &&
    !line.destination_location_id
  )
    errors.push("Destination location is required");
  if (
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
  movementTypeCode: string
): EditableDocument {
  const lines = document.lines.map((line) => ({
    ...line,
    validation_errors: errorsForLine(line, fieldPolicies, movementTypeCode),
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

export function MovementImportDialog({
  open,
  onOpenChange,
  movementTypes,
  fieldPolicies,
  currentMovementTypeCode,
  variants,
  units,
  stockableLocations,
  onApply,
}: Props) {
  const [sources, setSources] = useState<MovementImportSource[]>([]);
  const [sourceType, setSourceType] = useState("");
  const [sourceInput, setSourceInput] = useState<Record<string, string>>({});
  const [movementTypeCode, setMovementTypeCode] = useState(currentMovementTypeCode);
  const [preview, setPreview] = useState<MovementImportPreview | null>(null);
  const [documents, setDocuments] = useState<EditableDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [defaultDestinationId, setDefaultDestinationId] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedSource = sources.find((source) => source.source_type === sourceType) ?? null;
  const selectedDocument =
    documents.find((document) => document.source_document_id === selectedDocumentId) ?? null;
  const selectedDocumentErrors = selectedDocument?.validation_errors ?? [];
  const isSvwmsSessionImport = preview?.source_type === "svwms_wdd_matcher";
  const showDocumentSelector = documents.length > 1 && !isSvwmsSessionImport;
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
      setDefaultDestinationId("");
    });
  }, [movementTypeCode, open]);

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
      const nextDocuments = result.data.documents.map((document) =>
        documentWithRevalidatedLines(document, fieldPolicies, movementTypeCode)
      );
      setPreview(result.data);
      setDocuments(nextDocuments);
      setSelectedDocumentId(nextDocuments[0]?.source_document_id ?? "");
      setDefaultDestinationId("");
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
              const variant = variants.find((item) => item.id === updates.variant_id);
              if (variant) nextLine.unit_id = variant.unit_id;
            }
            return nextLine;
          }),
        };
        return documentWithRevalidatedLines(nextDocument, fieldPolicies, movementTypeCode);
      })
    );
  };

  const applyDefaultDestination = (destinationId: string) => {
    setDefaultDestinationId(destinationId);
    setDocuments((current) =>
      current.map((document) =>
        documentWithRevalidatedLines(
          {
            ...document,
            lines: document.lines.map((line) => ({
              ...line,
              destination_location_id: destinationId || null,
            })),
          },
          fieldPolicies,
          movementTypeCode
        )
      )
    );
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
      lines: selectedDocument.lines.map((line) => ({
        variant_id: line.variant_id!,
        unit_id: line.unit_id!,
        quantity: line.quantity!,
        source_location_id: line.source_location_id,
        destination_location_id: line.destination_location_id,
      })),
    });
    onOpenChange(false);
    toast.success("Imported data filled the movement form");
  };

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

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
                  setDefaultDestinationId("");
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

              {isSvwmsSessionImport && (
                <div className="grid gap-1 text-sm font-medium md:max-w-md">
                  Default destination
                  <select
                    value={defaultDestinationId}
                    onChange={(event) => applyDefaultDestination(event.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Select destination for imported items</option>
                    {stockableLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {locationLabel(location)}
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

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Imported item</th>
                      {isSvwmsSessionImport && (
                        <>
                          <th className="px-3 py-2 text-left">WDD</th>
                          <th className="px-3 py-2 text-left">Order</th>
                          <th className="px-3 py-2 text-left">Parsed location</th>
                        </>
                      )}
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
                            <div className="font-mono text-xs">{line.raw_product_code ?? "-"}</div>
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                              {line.raw_product_name ?? "-"}
                            </div>
                            {line.validation_errors.length > 0 && (
                              <div className="mt-1 text-xs text-destructive">
                                {line.validation_errors.join(", ")}
                              </div>
                            )}
                          </td>
                          {isSvwmsSessionImport && (
                            <>
                              <td className="px-3 py-2 align-top text-xs">
                                {rawMetadataString(line, "wdd_number") ?? "-"}
                              </td>
                              <td className="px-3 py-2 align-top text-xs">
                                {rawMetadataString(line, "order_number") ?? "-"}
                              </td>
                              <td className="px-3 py-2 align-top text-xs">
                                {rawMetadataString(line, "parsed_location") ??
                                  line.raw_destination_location ??
                                  line.raw_source_location ??
                                  "-"}
                              </td>
                            </>
                          )}
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
                              {variants.map((variant) => (
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
                              {units.map((unit) => (
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
                                  quantity: event.target.value ? Number(event.target.value) : null,
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
