"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "react-toastify";
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportCopyButton } from "@/components/warehouse/import-copy-button";
import { WarehouseImportReviewTable } from "@/components/warehouse/import-review-table";
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
  createMovementImportProductsAction,
  createMovementImportUnitsAction,
  listMovementImportSourcesAction,
  previewMovementImportFromSourceAction,
} from "@/app/actions/warehouse/inventory";
import {
  normalizeImportedSku,
  normalizeImportedUnitCode,
  skuCollisionFingerprint,
} from "@/lib/warehouse/import-utils";
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
type ProductMismatchAction = "create" | "assign_existing" | "skip";
type UnitExceptionGroup = {
  key: string;
  rawUnit: string;
  lines: EditableLine[];
  ambiguous: boolean;
};
type ProductExceptionGroup = {
  key: string;
  rawCode: string;
  normalizedCode: string | null;
  rawName: string;
  lines: EditableLine[];
  ambiguous: boolean;
  skipped: boolean;
};

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
  options: {
    deferLocationValidation?: boolean;
  } = {}
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
  options: {
    deferLocationValidation?: boolean;
  } = {}
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
  return line.normalized_product_code || skuCollisionFingerprint(line.raw_product_code);
}

function rawUnitKey(line: EditableLine) {
  return line.normalized_unit_code || skuCollisionFingerprint(line.raw_unit);
}

function unitExceptionKey(line: EditableLine) {
  return rawUnitKey(line) || `line:${line.source_line_id}`;
}

function isImportLineReady(line: EditableLine) {
  return (
    line.validation_errors.length === 0 &&
    Boolean(line.variant_id) &&
    Boolean(line.unit_id) &&
    Boolean(line.quantity && line.quantity > 0)
  );
}

function groupUnitId(group: ProductExceptionGroup) {
  const unitIds = [
    ...new Set(
      group.lines.map((line) => line.unit_id).filter((unitId): unitId is string => Boolean(unitId))
    ),
  ];
  return unitIds.length === 1 ? unitIds[0]! : "";
}

function productCreateBlockReason(group: ProductExceptionGroup, canManageProducts: boolean) {
  if (group.ambiguous) return "Ambiguous product must be assigned.";
  if (!groupUnitId(group)) return "Select unit first.";
  if (!canManageProducts) return "Product creation permission is required.";
  return null;
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
  const [skippedProductKeys, setSkippedProductKeys] = useState<Set<string>>(() => new Set());
  const [showManualReview, setShowManualReview] = useState(false);
  const [productMismatchActions, setProductMismatchActions] = useState<
    Record<string, ProductMismatchAction>
  >({});
  const [quickCreatePendingKey, setQuickCreatePendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSource = sources.find((source) => source.source_type === sourceType) ?? null;
  const selectedDocument =
    documents.find((document) => document.source_document_id === selectedDocumentId) ?? null;
  const isSvwmsSessionImport = preview?.source_type === "svwms_wdd_matcher";
  const showDocumentSelector = documents.length > 1 && !isSvwmsSessionImport;
  const deferLocationValidation = isSvwmsSessionImport;
  const selectedActiveLines = useMemo(() => {
    const lines = selectedDocument?.lines ?? [];
    if (!isSvwmsSessionImport) return lines;
    return lines.filter((line) => !skippedProductKeys.has(rawProductKey(line)));
  }, [isSvwmsSessionImport, selectedDocument, skippedProductKeys]);
  const selectedDocumentErrors = useMemo(
    () => [...new Set(selectedActiveLines.flatMap((line) => line.validation_errors))],
    [selectedActiveLines]
  );
  const canApply =
    Boolean(selectedDocument) &&
    selectedDocumentErrors.length === 0 &&
    selectedActiveLines.length > 0;

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
      setSkippedProductKeys(new Set());
      setShowManualReview(false);
      setProductMismatchActions({});
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
      setSkippedProductKeys(new Set());
      setShowManualReview(false);
      setProductMismatchActions({});
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
    updateMatchingLines(
      (candidate) => !candidate.unit_id && unitExceptionKey(candidate) === groupKey,
      {
        unit_id: unitId || null,
      }
    );
  };

  const handleMapProductGroup = (groupKey: string, variantId: string) => {
    const variant = variantOptions.find((item) => item.id === variantId);
    setSkippedProductKeys((current) => {
      if (!current.has(groupKey)) return current;
      const next = new Set(current);
      next.delete(groupKey);
      return next;
    });
    updateMatchingLines(
      (candidate) => !candidate.variant_id && rawProductKey(candidate) === groupKey,
      variant ? { variant_id: variant.id, unit_id: variant.unit_id } : { variant_id: null }
    );
  };

  const handleMapProductGroupUnit = (groupKey: string, unitId: string) => {
    updateMatchingLines(
      (candidate) => !candidate.unit_id && rawProductKey(candidate) === groupKey,
      { unit_id: unitId || null }
    );
  };

  const handleProductMismatchActionChange = (groupKey: string, action: ProductMismatchAction) => {
    setProductMismatchActions((current) => ({ ...current, [groupKey]: action }));
    if (action === "skip") {
      handleSkipProductGroup(groupKey);
      return;
    }
    setSkippedProductKeys((current) => {
      if (!current.has(groupKey)) return current;
      const next = new Set(current);
      next.delete(groupKey);
      return next;
    });
  };

  const handleSkipProductGroup = (groupKey: string) => {
    setSkippedProductKeys((current) => new Set(current).add(groupKey));
  };

  const handleSkipMissingProducts = () => {
    setSkippedProductKeys((current) => {
      const next = new Set(current);
      for (const group of svwmsMissingProductGroups) next.add(group.key);
      return next;
    });
    setShowManualReview(false);
  };

  const handleRestoreSkippedProducts = () => {
    setSkippedProductKeys(new Set());
    setShowManualReview(false);
    setProductMismatchActions({});
  };

  const copyFirstProductUnitToAll = () => {
    const firstGroup = svwmsActiveProductExceptionGroups[0];
    const firstUnitId = firstGroup ? groupUnitId(firstGroup) : "";
    if (!firstUnitId) {
      toast.error("Select a unit in the first product mismatch row first");
      return;
    }
    const targetKeys = new Set(
      svwmsActiveProductExceptionGroups
        .filter((group) => group.lines.some((line) => !line.unit_id))
        .map((group) => group.key)
    );
    updateMatchingLines(
      (candidate) => targetKeys.has(rawProductKey(candidate)) && !candidate.unit_id,
      { unit_id: firstUnitId }
    );
  };

  const copyFirstProductActionToAll = () => {
    const firstGroup = svwmsActiveProductExceptionGroups[0];
    if (!firstGroup) return;
    const firstAction =
      productMismatchActions[firstGroup.key] ??
      (productCreateBlockReason(firstGroup, canManageProducts) ? "assign_existing" : "create");
    setProductMismatchActions((current) => {
      const next = { ...current };
      for (const group of svwmsActiveProductExceptionGroups) {
        if (firstAction === "create" && productCreateBlockReason(group, canManageProducts))
          continue;
        if (firstAction === "skip" && group.ambiguous) continue;
        next[group.key] = firstAction;
      }
      return next;
    });
    if (firstAction === "skip") {
      setSkippedProductKeys((current) => {
        const next = new Set(current);
        for (const group of svwmsActiveProductExceptionGroups) {
          if (!group.ambiguous) next.add(group.key);
        }
        return next;
      });
    }
  };

  const handleCreateMissingUnits = async () => {
    if (!canManageProducts) return;
    if (svwmsMissingUnitGroups.length === 0) return;
    setQuickCreatePendingKey("bulk-units");
    const result = await createMovementImportUnitsAction({
      units: svwmsMissingUnitGroups.flatMap((group) => {
        const code = normalizeImportedUnitCode(group.rawUnit);
        return code ? [{ key: group.key, code, name: code }] : [];
      }),
    });
    setQuickCreatePendingKey(null);
    if (!result.success || !("data" in result)) {
      toast.error("Could not create missing units");
      return;
    }
    const created = new Map<string, InventoryUnitRow>(
      result.data.created.map((item) => [item.key, item.unit])
    );
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
    if (selectedCreateProductGroups.length === 0) {
      if (blockedCreateProductGroups.length > 0) {
        toast.error("Resolve units before creating selected products");
      }
      return;
    }
    setQuickCreatePendingKey("bulk-products");
    const result = await createMovementImportProductsAction({
      products: selectedCreateProductGroups.flatMap((group) => {
        const first = group.lines[0];
        const sku = group.normalizedCode || normalizeImportedSku(group.rawCode);
        const unitId = groupUnitId(group);
        if (!sku || !unitId) return [];
        const unit = unitOptions.find((item) => item.id === unitId);
        const name = group.rawName?.trim() || sku;
        return [
          {
            key: group.key,
            sku,
            name,
            unit_id: unitId,
            unit_code: unit?.code ?? first.raw_unit ?? "",
          },
        ];
      }),
    });
    setQuickCreatePendingKey(null);
    if (!result.success || !("data" in result)) {
      toast.error("Could not create missing products");
      return;
    }
    const created = new Map<string, InventoryVariantOption>(
      result.data.created.map((item) => [item.key, item.variant])
    );
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
    setSkippedProductKeys((current) => {
      if (current.size === 0) return current;
      const next = new Set(current);
      for (const key of created.keys()) next.delete(key);
      return next;
    });
    setProductMismatchActions((current) => {
      const next = { ...current };
      for (const key of created.keys()) delete next[key];
      return next;
    });
    toast.success(`Created ${created.size} product${created.size === 1 ? "" : "s"}`);
  };

  const handleApply = () => {
    if (!selectedDocument) return;
    if (!canApply) {
      toast.error(selectedDocumentErrors[0] ?? "Resolve import issues before filling the form");
      return;
    }
    onApply({
      movementTypeCode,
      senderName: selectedDocument.sender_name,
      senderDetails: selectedDocument.sender_details,
      recipientName: selectedDocument.recipient_name,
      recipientDetails: selectedDocument.recipient_details,
      externalReference: selectedDocument.external_reference,
      note: preview
        ? `Imported from ${preview.source_label}: ${
            selectedDocument.source_document_number ?? selectedDocument.source_document_id
          }`
        : null,
      lines: selectedActiveLines.map((line) => {
        const variant = variantOptions.find((item) => item.id === line.variant_id);
        const unit = unitOptions.find((item) => item.id === line.unit_id);
        return {
          variant_id: line.variant_id!,
          unit_id: line.unit_id!,
          sku: variant?.sku ?? line.normalized_product_code ?? line.raw_product_code ?? "",
          product_name:
            variant?.product_name ??
            line.normalized_product_name ??
            line.raw_product_name ??
            line.raw_product_code ??
            "",
          unit_code: unit?.code ?? variant?.unit_code ?? line.normalized_unit_code ?? line.raw_unit,
          quantity: line.quantity!,
          source_location_id: line.source_location_id,
          destination_location_id: isSvwmsSessionImport
            ? currentDestinationLocationId || null
            : line.destination_location_id,
          note: isSvwmsSessionImport ? lineContextNote(line) : null,
          source_type: preview?.source_type ?? null,
          source_label: preview?.source_label ?? null,
          source_line_id: line.source_line_id,
          source_order_number: isSvwmsSessionImport ? lineOrderNumber(line) : null,
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
    return [...selectedDocument.lines]
      .filter((line) => !skippedProductKeys.has(rawProductKey(line)))
      .sort((left, right) => {
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
  }, [isSvwmsSessionImport, selectedDocument, skippedProductKeys]);
  const svwmsUnitExceptionGroups = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    const groups = new Map<string, UnitExceptionGroup>();
    for (const line of selectedDocument.lines) {
      if (skippedProductKeys.has(rawProductKey(line))) continue;
      if (!line.variant_id) continue;
      if (line.unit_id) continue;
      const key = unitExceptionKey(line);
      const current = groups.get(key) ?? {
        key,
        rawUnit: line.normalized_unit_code ?? line.raw_unit ?? "No unit provided",
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
  }, [isSvwmsSessionImport, selectedDocument, skippedProductKeys]);
  const svwmsMissingUnitGroups = useMemo(
    () => svwmsUnitExceptionGroups.filter((group) => !group.ambiguous),
    [svwmsUnitExceptionGroups]
  );
  const svwmsAmbiguousUnitGroups = useMemo(
    () => svwmsUnitExceptionGroups.filter((group) => group.ambiguous),
    [svwmsUnitExceptionGroups]
  );
  const svwmsProductExceptionGroups = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    const groups = new Map<string, ProductExceptionGroup>();
    for (const line of selectedDocument.lines) {
      if (line.variant_id || !line.raw_product_code) continue;
      const key = rawProductKey(line);
      if (!key) continue;
      const current = groups.get(key) ?? {
        key,
        rawCode: line.raw_product_code,
        normalizedCode: line.normalized_product_code,
        rawName: line.normalized_product_name ?? line.raw_product_name ?? line.raw_product_code,
        lines: [],
        ambiguous: false,
        skipped: skippedProductKeys.has(key),
      };
      current.lines.push(line);
      current.ambiguous ||= line.validation_errors.some((error) =>
        error.toLowerCase().includes("multiple")
      );
      current.skipped ||= skippedProductKeys.has(key);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [isSvwmsSessionImport, selectedDocument, skippedProductKeys]);
  const svwmsMissingProductGroups = useMemo(
    () => svwmsProductExceptionGroups.filter((group) => !group.ambiguous && !group.skipped),
    [svwmsProductExceptionGroups]
  );
  const svwmsAmbiguousProductGroups = useMemo(
    () => svwmsProductExceptionGroups.filter((group) => group.ambiguous && !group.skipped),
    [svwmsProductExceptionGroups]
  );
  const svwmsActiveProductExceptionGroups = useMemo(
    () => svwmsProductExceptionGroups.filter((group) => !group.skipped),
    [svwmsProductExceptionGroups]
  );
  const productActionForGroup = (group: ProductExceptionGroup): ProductMismatchAction =>
    productMismatchActions[group.key] ??
    (productCreateBlockReason(group, canManageProducts) ? "assign_existing" : "create");
  const selectedCreateProductGroups = svwmsActiveProductExceptionGroups.filter(
    (group) =>
      productActionForGroup(group) === "create" &&
      !productCreateBlockReason(group, canManageProducts)
  );
  const blockedCreateProductGroups = svwmsActiveProductExceptionGroups.filter(
    (group) =>
      productActionForGroup(group) === "create" &&
      productCreateBlockReason(group, canManageProducts)
  );
  const canCreateSelectedProducts =
    canManageProducts && selectedCreateProductGroups.length > 0 && quickCreatePendingKey === null;
  const svwmsSkippedLineCount = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return 0;
    return selectedDocument.lines.filter((line) => skippedProductKeys.has(rawProductKey(line)))
      .length;
  }, [isSvwmsSessionImport, selectedDocument, skippedProductKeys]);
  const svwmsResolvedLineCount = useMemo(
    () => selectedActiveLines.filter(isImportLineReady).length,
    [selectedActiveLines]
  );
  const svwmsRowsNeedingDecisions = useMemo(
    () => selectedActiveLines.filter((line) => !isImportLineReady(line)).length,
    [selectedActiveLines]
  );
  const svwmsUnresolvedGroupCount =
    svwmsMissingUnitGroups.length +
    svwmsAmbiguousUnitGroups.length +
    svwmsMissingProductGroups.length +
    svwmsAmbiguousProductGroups.length;
  const svwmsAllRowsSkipped =
    Boolean(selectedDocument) &&
    isSvwmsSessionImport &&
    selectedDocument!.lines.length > 0 &&
    selectedActiveLines.length === 0;
  const dialogView = !selectedDocument
    ? "select_source"
    : isSvwmsSessionImport &&
        (svwmsUnresolvedGroupCount > 0 || svwmsRowsNeedingDecisions > 0 || svwmsAllRowsSkipped)
      ? "resolve_mismatches"
      : "review_ready";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Import movement data</DialogTitle>
          <DialogDescription>
            Preview source data, resolve missing fields, then fill the unsaved movement form.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
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
                  setSkippedProductKeys(new Set());
                  setShowManualReview(false);
                  setProductMismatchActions({});
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

              {!isSvwmsSessionImport && selectedDocumentErrors.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{selectedDocumentErrors.join(", ")}</span>
                </div>
              ) : !isSvwmsSessionImport ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  This source document is ready to fill the form.
                </div>
              ) : null}

              {isSvwmsSessionImport && dialogView === "review_ready" && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  All active rows are resolved. Review the normalized list, then fill the movement
                  form.
                </div>
              )}

              {isSvwmsSessionImport && dialogView === "resolve_mismatches" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {svwmsAllRowsSkipped ? (
                    <span>
                      All imported rows are skipped. Restore at least one row before filling the
                      movement form.
                    </span>
                  ) : (
                    <span>
                      Import needs decisions: {svwmsRowsNeedingDecisions} row
                      {svwmsRowsNeedingDecisions === 1 ? "" : "s"} need handling across{" "}
                      {svwmsUnresolvedGroupCount} normalized group
                      {svwmsUnresolvedGroupCount === 1 ? "" : "s"}. Fill movement form is blocked
                      until active mismatches are resolved or skipped.
                    </span>
                  )}
                </div>
              )}

              {isSvwmsSessionImport ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-5">
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
                      value={svwmsActiveProductExceptionGroups.length}
                      muted={svwmsActiveProductExceptionGroups.length === 0}
                    />
                    <ImportSummaryTile
                      label="Skipped rows"
                      value={svwmsSkippedLineCount}
                      muted={svwmsSkippedLineCount === 0}
                    />
                  </div>

                  {dialogView === "resolve_mismatches" ? (
                    <div className="space-y-4 rounded-md border bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                        <div>
                          <p className="font-medium">Import needs decisions</p>
                          <p className="text-xs text-muted-foreground">
                            Handle normalized product and unit groups once. Matching rows update
                            together.
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
                          {canManageProducts &&
                            (selectedCreateProductGroups.length > 0 ||
                              blockedCreateProductGroups.length > 0) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCreateMissingProducts}
                                disabled={!canCreateSelectedProducts}
                              >
                                {quickCreatePendingKey === "bulk-products" ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                )}
                                Create selected items ({selectedCreateProductGroups.length})
                              </Button>
                            )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShowManualReview((current) => !current)}
                          >
                            Review manually
                          </Button>
                          {svwmsMissingProductGroups.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleSkipMissingProducts}
                              disabled={quickCreatePendingKey !== null}
                            >
                              Skip missing products
                            </Button>
                          )}
                          {svwmsSkippedLineCount > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRestoreSkippedProducts}
                              disabled={quickCreatePendingKey !== null}
                            >
                              Restore skipped
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-4 p-3">
                        {svwmsAllRowsSkipped && (
                          <div className="rounded-md border border-amber-500/30 bg-background p-3 text-sm">
                            All imported rows are currently skipped. Restore skipped rows or choose
                            another session before filling the movement form.
                          </div>
                        )}

                        {svwmsUnitExceptionGroups.length > 0 && (
                          <WarehouseImportReviewTable
                            title="Unit mismatches"
                            description="Resolve units first so missing products can be created with the correct base unit."
                            rows={svwmsUnitExceptionGroups}
                            rowKey={(group) => group.key}
                            minWidth="min-w-[1080px]"
                            columns={[
                              {
                                key: "no",
                                header: "No.",
                                className: "w-16 text-muted-foreground",
                                render: (_group, index) => index + 1,
                              },
                              {
                                key: "sku",
                                header: "SKU",
                                render: (group) => {
                                  const line = group.lines[0];
                                  return (
                                    <div className="grid gap-0.5">
                                      <span className="font-mono text-xs">
                                        {line?.normalized_product_code ??
                                          line?.raw_product_code ??
                                          "-"}
                                      </span>
                                      {group.lines.length > 1 ? (
                                        <span className="text-xs text-muted-foreground">
                                          +{group.lines.length - 1} more
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                },
                              },
                              {
                                key: "name",
                                header: "Name",
                                className: "min-w-64",
                                render: (group) => {
                                  const line = group.lines[0];
                                  return (
                                    line?.normalized_product_name ??
                                    line?.raw_product_name ??
                                    line?.raw_product_code ??
                                    "-"
                                  );
                                },
                              },
                              {
                                key: "qty",
                                header: "Qty",
                                className: "text-right",
                                render: (group) => (
                                  <span className="font-mono">
                                    {group.lines[0]?.quantity ?? "-"}
                                  </span>
                                ),
                              },
                              {
                                key: "order",
                                header: "Zlecenie / Order",
                                render: (group) => (
                                  <span className="font-mono text-xs">
                                    {group.lines[0]
                                      ? (lineOrderNumber(group.lines[0]) ?? "-")
                                      : "-"}
                                  </span>
                                ),
                              },
                              {
                                key: "unit",
                                header: "Imported unit",
                                render: (group) => (
                                  <span className="font-mono text-xs">{group.rawUnit}</span>
                                ),
                              },
                              {
                                key: "problem",
                                header: "Problem",
                                render: (group) => (
                                  <span className="text-xs text-destructive">
                                    {group.ambiguous ? "Ambiguous unit" : "Missing unit"}
                                  </span>
                                ),
                              },
                              {
                                key: "action",
                                header: "Action",
                                className: "min-w-64",
                                render: (group) => (
                                  <select
                                    value=""
                                    onChange={(event) =>
                                      handleMapUnitGroup(group.key, event.target.value)
                                    }
                                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                  >
                                    <option value="">Assign existing unit</option>
                                    {unitOptions.map((unit) => (
                                      <option key={unit.id} value={unit.id}>
                                        {unit.code} - {unit.name}
                                      </option>
                                    ))}
                                  </select>
                                ),
                              },
                            ]}
                          />
                        )}

                        {svwmsActiveProductExceptionGroups.length > 0 && (
                          <WarehouseImportReviewTable
                            title="Product mismatches"
                            description="Choose how to handle each normalized item before filling the movement form."
                            rows={svwmsActiveProductExceptionGroups}
                            rowKey={(group) => group.key}
                            minWidth="min-w-[1040px]"
                            columns={[
                              {
                                key: "no",
                                header: "No.",
                                className: "w-16 text-muted-foreground",
                                render: (_group, index) => index + 1,
                              },
                              {
                                key: "sku",
                                header: "Item SKU",
                                render: (group) => (
                                  <span className="font-mono text-xs">
                                    {group.normalizedCode ?? group.rawCode}
                                  </span>
                                ),
                              },
                              {
                                key: "name",
                                header: "Name",
                                className: "min-w-64",
                                render: (group) => group.rawName,
                              },
                              {
                                key: "unit",
                                header: (
                                  <span className="flex items-center gap-1.5">
                                    Unit
                                    <ImportCopyButton
                                      label="unit"
                                      onClick={copyFirstProductUnitToAll}
                                    />
                                  </span>
                                ),
                                className: "min-w-56",
                                render: (group) => (
                                  <select
                                    value={groupUnitId(group)}
                                    onChange={(event) =>
                                      handleMapProductGroupUnit(group.key, event.target.value)
                                    }
                                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                  >
                                    <option value="">Select unit</option>
                                    {unitOptions.map((unit) => (
                                      <option key={unit.id} value={unit.id}>
                                        {unit.code} - {unit.name}
                                      </option>
                                    ))}
                                  </select>
                                ),
                              },
                              {
                                key: "rows",
                                header: "Rows",
                                render: (group) => group.lines.length,
                              },
                              {
                                key: "problem",
                                header: "Problem",
                                render: (group) => (
                                  <span className="text-xs text-destructive">
                                    {group.ambiguous
                                      ? "Multiple matches"
                                      : !groupUnitId(group)
                                        ? "Missing product · select unit first"
                                        : "Missing product"}
                                  </span>
                                ),
                              },
                              {
                                key: "action",
                                header: (
                                  <span className="flex items-center gap-1.5">
                                    How to proceed
                                    <ImportCopyButton
                                      label="action"
                                      onClick={copyFirstProductActionToAll}
                                    />
                                  </span>
                                ),
                                className: "min-w-[420px]",
                                render: (group) => {
                                  const createBlockReason = productCreateBlockReason(
                                    group,
                                    canManageProducts
                                  );
                                  const action = productActionForGroup(group);
                                  return (
                                    <div className="grid gap-2 sm:grid-cols-[170px_minmax(180px,1fr)]">
                                      <select
                                        value={action}
                                        onChange={(event) =>
                                          handleProductMismatchActionChange(
                                            group.key,
                                            event.target.value as ProductMismatchAction
                                          )
                                        }
                                        className="h-9 rounded-md border bg-background px-2 text-sm"
                                      >
                                        <option
                                          value="create"
                                          disabled={Boolean(createBlockReason)}
                                        >
                                          Create item
                                        </option>
                                        <option value="assign_existing">
                                          Assign existing item
                                        </option>
                                        <option value="skip">Skip</option>
                                      </select>

                                      {action === "assign_existing" ? (
                                        <select
                                          value=""
                                          onChange={(event) =>
                                            handleMapProductGroup(group.key, event.target.value)
                                          }
                                          className="h-9 rounded-md border bg-background px-2 text-sm"
                                        >
                                          <option value="">Pick existing item</option>
                                          {variantOptions.map((variant) => (
                                            <option key={variant.id} value={variant.id}>
                                              {variantLabel(variant)}
                                            </option>
                                          ))}
                                        </select>
                                      ) : action === "create" ? (
                                        <span className="self-center text-xs text-muted-foreground">
                                          Will be created by bulk action.
                                        </span>
                                      ) : (
                                        <span className="self-center text-xs text-muted-foreground">
                                          Row group will be skipped.
                                        </span>
                                      )}
                                      {createBlockReason ? (
                                        <span className="text-xs text-muted-foreground sm:col-span-2">
                                          {createBlockReason}
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                },
                              },
                            ]}
                          />
                        )}

                        {showManualReview && (
                          <div className="overflow-x-auto rounded-md border bg-background">
                            <table className="w-full min-w-[840px] text-sm">
                              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 text-left">Zlecenie / Order</th>
                                  <th className="px-3 py-2 text-left">Normalized SKU</th>
                                  <th className="px-3 py-2 text-left">Normalized name</th>
                                  <th className="px-3 py-2 text-left">Normalized unit</th>
                                  <th className="px-3 py-2 text-left">Problem</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {selectedActiveLines
                                  .filter((line) => line.validation_errors.length > 0)
                                  .map((line) => (
                                    <tr key={line.source_line_id}>
                                      <td className="px-3 py-2 font-mono text-xs">
                                        {lineOrderNumber(line) ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-xs">
                                        {line.normalized_product_code ??
                                          line.raw_product_code ??
                                          "-"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {line.normalized_product_name ??
                                          line.raw_product_name ??
                                          "-"}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-xs">
                                        {line.normalized_unit_code ?? line.raw_unit ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-destructive">
                                        {line.validation_errors.join(", ")}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {svwmsSkippedLineCount > 0 && (
                        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          {svwmsSkippedLineCount} skipped row
                          {svwmsSkippedLineCount === 1 ? "" : "s"} will not be added to this
                          movement.
                        </div>
                      )}
                      <WarehouseImportReviewTable
                        title="Imported items"
                        description="Review the resolved items before filling the movement form."
                        rows={svwmsLines}
                        rowKey={(line) => line.source_line_id}
                        minWidth="min-w-[860px]"
                        columns={[
                          {
                            key: "no",
                            header: "No.",
                            className: "w-16 text-muted-foreground",
                            render: (_line, index) => index + 1,
                          },
                          {
                            key: "sku",
                            header: "SKU",
                            render: (line) => (
                              <span className="font-mono text-xs">
                                {line.normalized_product_code ?? line.raw_product_code ?? "-"}
                              </span>
                            ),
                          },
                          {
                            key: "name",
                            header: "Name",
                            className: "min-w-64",
                            render: (line) =>
                              line.normalized_product_name ?? line.raw_product_name ?? "-",
                          },
                          {
                            key: "qty",
                            header: "Qty",
                            className: "text-right",
                            render: (line) => (
                              <span className="font-mono">{line.quantity ?? "-"}</span>
                            ),
                          },
                          {
                            key: "unit",
                            header: "Unit",
                            className: "min-w-44",
                            render: (line) => (
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
                            ),
                          },
                          {
                            key: "order",
                            header: "Zlecenie / Order",
                            render: (line) => (
                              <span className="font-mono text-xs">
                                {lineOrderNumber(line) ?? "-"}
                              </span>
                            ),
                          },
                          {
                            key: "status",
                            header: "Status",
                            render: (line) =>
                              isImportLineReady(line) ? (
                                <span className="text-emerald-700">Ready</span>
                              ) : (
                                <span className="text-destructive">
                                  {line.validation_errors.join(", ") || "Needs resolution"}
                                </span>
                              ),
                          },
                        ]}
                      />
                    </div>
                  )}
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

        <DialogFooter className="shrink-0 border-t bg-background px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {dialogView === "resolve_mismatches" &&
            (selectedCreateProductGroups.length > 0 || blockedCreateProductGroups.length > 0) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateMissingProducts}
                disabled={!canCreateSelectedProducts}
              >
                {quickCreatePendingKey === "bulk-products" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Create selected items ({selectedCreateProductGroups.length})
              </Button>
            )}
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
