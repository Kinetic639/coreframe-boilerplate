"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, PlusCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportCopyButton } from "@/components/warehouse/import-copy-button";
import { WarehouseImportReviewTable } from "@/components/warehouse/import-review-table";
import { RepairOrderImportReview } from "@/components/workshop/repair-order-import-review";
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
  applyRepairOrderImportAction,
  previewRepairOrderImportAction,
} from "@/app/actions/workshop/import";
import {
  normalizeImportedSku,
  normalizeImportedUnitCode,
  skuCollisionFingerprint,
} from "@/lib/warehouse/import-utils";
import type {
  InventoryUnitRow,
  InventoryVariantOption,
  MovementFieldPolicyBundle,
  MovementImportPreview,
  MovementImportPreviewDocument,
  MovementImportPreviewLine,
  MovementImportSource,
  MovementImportSourceField,
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
type QuickImportStep = "preview" | "repairOrders" | "products";
type UnitExceptionGroup = {
  key: string;
  rawUnit: string | null;
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
  fieldPolicies: MovementFieldPolicyBundle;
  /** The type chosen in the movement form; the import never picks its own. */
  currentMovementTypeCode: string;
  variants: InventoryVariantOption[];
  units: InventoryUnitRow[];
  stockableLocations: LocationOption[];
  currentDestinationLocationId?: string;
  canManageProducts: boolean;
  onApply: (document: ImportedMovementDocumentDraft) => void;
};

const SVWMS_SOURCE = "svwms_wdd_matcher";
// Quick import receives parts the catalog does not know yet in pieces.
const DEFAULT_UNIT_CODE = "SZT";
const DEFAULT_UNIT_NAME = "sztuka";
const PRODUCT_BATCH_SIZE = 200;

// Validation messages stay English codes (client and server share them);
// they are translated only for display.
const ERROR_KEYS: Record<string, string> = {
  "Product is required": "productRequired",
  "Unit is required": "unitRequired",
  "Quantity is required": "quantityRequired",
  "Source location is required": "sourceLocationRequired",
  "Destination location is required": "destinationLocationRequired",
  "Source and destination locations must differ": "locationsMustDiffer",
  "Product could not be resolved": "productNotResolved",
  "Unit could not be resolved": "unitNotResolved",
  "Product matched multiple records": "productMultiple",
  "Unit matched multiple records": "unitMultiple",
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

// Server actions fail with HTTP 200, so the toast is the only place the reason shows.
function withActionError(message: string, result: unknown) {
  const error = (result as { error?: unknown } | null)?.error;
  return typeof error === "string" && error.trim() ? `${message}: ${error}` : message;
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

// Read from the resolver status: client revalidation replaces the server's
// "matched multiple records" messages.
function isProductAmbiguous(line: EditableLine) {
  return !line.variant_id && line.product_resolution_status === "ambiguous";
}

function isUnitAmbiguous(line: EditableLine) {
  return !line.unit_id && line.unit_resolution_status === "ambiguous";
}

function groupUnitId(group: ProductExceptionGroup) {
  const unitIds = [
    ...new Set(
      group.lines.map((line) => line.unit_id).filter((unitId): unitId is string => Boolean(unitId))
    ),
  ];
  return unitIds.length === 1 ? unitIds[0]! : "";
}

type BlockReason = "ambiguous" | "selectUnit" | "noPermission";

function productCreateBlockReason(
  group: ProductExceptionGroup,
  canManageProducts: boolean
): BlockReason | null {
  if (group.ambiguous) return "ambiguous";
  if (!groupUnitId(group)) return "selectUnit";
  if (!canManageProducts) return "noPermission";
  return null;
}

function sortUnits(units: InventoryUnitRow[]) {
  return [...units].sort((a, b) => a.code.localeCompare(b.code));
}

function sortVariants(variants: InventoryVariantOption[]) {
  return [...variants].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function MovementImportDialog({
  open,
  onOpenChange,
  fieldPolicies,
  currentMovementTypeCode,
  variants,
  units,
  stockableLocations,
  currentDestinationLocationId,
  canManageProducts,
  onApply,
}: Props) {
  const t = useTranslations("warehouseInventory.movementImport");
  const movementTypeCode = currentMovementTypeCode;
  const [sources, setSources] = useState<MovementImportSource[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [sourceType, setSourceType] = useState("");
  const [sourceInput, setSourceInput] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<MovementImportPreview | null>(null);
  const [documents, setDocuments] = useState<EditableDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [variantOptions, setVariantOptions] = useState(variants);
  const [unitOptions, setUnitOptions] = useState(units);
  const [skippedProductKeys, setSkippedProductKeys] = useState<Set<string>>(() => new Set());
  const [excludedZls, setExcludedZls] = useState<Set<string>>(() => new Set());
  const [showManualReview, setShowManualReview] = useState(false);
  const [productMismatchActions, setProductMismatchActions] = useState<
    Record<string, ProductMismatchAction>
  >({});
  const [quickCreatePendingKey, setQuickCreatePendingKey] = useState<string | null>(null);
  const [quickStep, setQuickStep] = useState<QuickImportStep | null>(null);
  // Remounts the repair order review so it re-reads orders quick import created.
  const [repairOrderReviewKey, setRepairOrderReviewKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const tError = (error: string) => (ERROR_KEYS[error] ? t(`errors.${ERROR_KEYS[error]}`) : error);
  const sourceLabel = (type: string, fallback: string) =>
    t.has(`sources.${type}`) ? t(`sources.${type}`) : fallback;
  const fieldLabel = (field: MovementImportSourceField) =>
    t.has(`fields.${field.key}.label`) ? t(`fields.${field.key}.label`) : field.label;
  const fieldPlaceholder = (field: MovementImportSourceField) =>
    t.has(`fields.${field.key}.placeholder`)
      ? t(`fields.${field.key}.placeholder`)
      : (field.placeholder ?? t("selectPlaceholder"));

  const selectedSource = sources.find((source) => source.source_type === sourceType) ?? null;
  const selectedDocument =
    documents.find((document) => document.source_document_id === selectedDocumentId) ?? null;
  const isSvwmsSessionImport = preview?.source_type === SVWMS_SOURCE;
  const showDocumentSelector = documents.length > 1 && !isSvwmsSessionImport;
  const deferLocationValidation = isSvwmsSessionImport;
  // A session already received on a PZ: importing it again doubles the receipt.
  const alreadyImportedDocument = useMemo(() => {
    for (const field of selectedSource?.input_fields ?? []) {
      const value = sourceInput[field.key];
      const option = value ? field.options?.find((item) => item.value === value) : null;
      if (option?.imported_document) return option.imported_document;
    }
    return null;
  }, [selectedSource, sourceInput]);
  // Lines of repair orders unchecked in "Zlecenia z tej dostawy" stay out of
  // the PZ entirely -- not listed, not validated, not filled into the form.
  const orderLines = useMemo(
    () =>
      (selectedDocument?.lines ?? []).filter((line) => {
        if (!isSvwmsSessionImport) return true;
        const zl = rawMetadataString(line, "zl_number");
        return !zl || !excludedZls.has(zl);
      }),
    [excludedZls, isSvwmsSessionImport, selectedDocument]
  );
  const selectedActiveLines = useMemo(() => {
    if (!isSvwmsSessionImport) return orderLines;
    return orderLines.filter((line) => !skippedProductKeys.has(rawProductKey(line)));
  }, [isSvwmsSessionImport, orderLines, skippedProductKeys]);
  const selectedDocumentErrors = useMemo(
    () => [...new Set(selectedActiveLines.flatMap((line) => line.validation_errors))],
    [selectedActiveLines]
  );
  const canApply =
    Boolean(selectedDocument) &&
    selectedDocumentErrors.length === 0 &&
    selectedActiveLines.length > 0;

  const resetPreview = () => {
    setPreview(null);
    setDocuments([]);
    setSelectedDocumentId("");
    setSkippedProductKeys(new Set());
    setExcludedZls(new Set());
    setShowManualReview(false);
    setProductMismatchActions({});
  };

  useEffect(() => {
    if (!open || !movementTypeCode) return;
    startTransition(async () => {
      const result = await listMovementImportSourcesAction({
        movement_type_code: movementTypeCode,
      });
      setSourcesLoaded(true);
      if (!result.success || !("data" in result)) {
        toast.error(withActionError(t("toasts.loadSourcesFailed"), result));
        return;
      }
      setSources(result.data);
      // Keep the user's own choice; never pick a source for them.
      setSourceType((current) =>
        current && result.data.some((source) => source.source_type === current) ? current : ""
      );
      setSourceInput({});
      resetPreview();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on open / type change
  }, [movementTypeCode, open]);

  useEffect(() => setVariantOptions(variants), [variants]);
  useEffect(() => setUnitOptions(units), [units]);

  const validateSourceInput = () => {
    if (!sourceType || !movementTypeCode) return false;
    const missingField = selectedSource?.input_fields.find(
      (field) => field.required && !sourceInput[field.key]?.trim()
    );
    if (missingField) {
      toast.error(t("toasts.fieldRequired", { label: fieldLabel(missingField) }));
      return false;
    }
    return true;
  };

  const revalidatePreviewDocuments = (data: MovementImportPreview) =>
    data.documents.map((document) =>
      documentWithRevalidatedLines(document, fieldPolicies, movementTypeCode, {
        deferLocationValidation: data.source_type === SVWMS_SOURCE,
      })
    );

  const showPreviewDocuments = (data: MovementImportPreview, nextDocuments: EditableDocument[]) => {
    setPreview(data);
    setDocuments(nextDocuments);
    setSelectedDocumentId(nextDocuments[0]?.source_document_id ?? "");
    setSkippedProductKeys(new Set());
    setExcludedZls(new Set());
    setShowManualReview(false);
    setProductMismatchActions({});
  };

  const handlePreview = () => {
    if (!validateSourceInput()) return;

    startTransition(async () => {
      const result = await previewMovementImportFromSourceAction({
        source_type: sourceType,
        source_input: sourceInput,
        movement_type_code: movementTypeCode,
      });
      if (!result.success || !("data" in result)) {
        toast.error(withActionError(t("toasts.previewFailed"), result));
        return;
      }
      showPreviewDocuments(result.data, revalidatePreviewDocuments(result.data));
    });
  };

  const buildDraft = (
    data: MovementImportPreview,
    document: EditableDocument,
    lines: EditableLine[],
    variantList: InventoryVariantOption[],
    unitList: InventoryUnitRow[]
  ): ImportedMovementDocumentDraft => {
    const isSvwms = data.source_type === SVWMS_SOURCE;
    return {
      movementTypeCode,
      senderName: document.sender_name,
      senderDetails: document.sender_details,
      recipientName: document.recipient_name,
      recipientDetails: document.recipient_details,
      externalReference: document.external_reference,
      note: t("note", {
        source: sourceLabel(data.source_type, data.source_label),
        document: document.source_document_number ?? document.source_document_id,
      }),
      lines: lines.map((line) => {
        const variant = variantList.find((item) => item.id === line.variant_id);
        const unit = unitList.find((item) => item.id === line.unit_id);
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
          destination_location_id: isSvwms
            ? currentDestinationLocationId || null
            : line.destination_location_id,
          note: isSvwms ? lineContextNote(line) : null,
          source_type: data.source_type ?? null,
          source_label: data.source_label ?? null,
          source_line_id: line.source_line_id,
          source_order_number: isSvwms ? lineOrderNumber(line) : null,
          source_product_code: line.normalized_product_code ?? line.raw_product_code ?? null,
        };
      }),
    };
  };

  /**
   * One click from session to filled form: creates the session's missing
   * repair orders, gives unit-less lines their part's unit (or SZT), creates
   * missing parts, then fills the form. Stops on what needs a person (a part
   * matching several catalog items, a failed step) and leaves the manual
   * review open at that point.
   */
  const handleQuickImport = () => {
    if (!validateSourceInput()) return;

    startTransition(async () => {
      try {
        setQuickStep("preview");
        const result = await previewMovementImportFromSourceAction({
          source_type: sourceType,
          source_input: sourceInput,
          movement_type_code: movementTypeCode,
        });
        if (!result.success || !("data" in result)) {
          toast.error(withActionError(t("toasts.previewFailed"), result));
          return;
        }
        const data = result.data;
        const isSvwms = data.source_type === SVWMS_SOURCE;
        const defer = { deferLocationValidation: isSvwms };
        let nextDocuments = revalidatePreviewDocuments(data);
        let nextVariants = variantOptions;
        let nextUnits = unitOptions;
        let ordersCreated = 0;
        let productsCreated = 0;
        const stop = () => {
          setVariantOptions(nextVariants);
          setUnitOptions(nextUnits);
          showPreviewDocuments(data, nextDocuments);
        };
        const firstDocument = nextDocuments[0];
        if (!firstDocument || (!isSvwms && nextDocuments.length > 1)) {
          stop();
          return;
        }

        if (isSvwms) {
          const sessionId = firstDocument.source_metadata?.session_id;
          if (typeof sessionId === "string") {
            setQuickStep("repairOrders");
            const sessionInput = { session_id: sessionId };
            const orders = await previewRepairOrderImportAction({
              source_type: SVWMS_SOURCE,
              source_input: sessionInput,
            });
            if (!orders.success) {
              stop();
              toast.error(t("quickRepairOrdersFailed"));
              return;
            }
            const zlNumbers = (
              orders as {
                data: { orders: Array<{ willChange: boolean; zlNumber: string | null }> };
              }
            ).data.orders
              .filter((order) => order.willChange && order.zlNumber)
              .map((order) => order.zlNumber!);
            if (zlNumbers.length > 0) {
              const applied = await applyRepairOrderImportAction({
                source_type: SVWMS_SOURCE,
                source_input: sessionInput,
                zl_numbers: zlNumbers,
              });
              setRepairOrderReviewKey((key) => key + 1);
              if (!applied.success) {
                stop();
                toast.error(t("quickRepairOrdersFailed"));
                return;
              }
              ordersCreated = (applied as { data: { created: number } }).data.created;
            }
          }

          // A known part brings its own unit; anything else is received in pieces.
          const variantUnit = (line: EditableLine) =>
            line.variant_id
              ? (nextVariants.find((variant) => variant.id === line.variant_id)?.unit_id ?? null)
              : null;
          const needsDefaultUnit = nextDocuments.some((document) =>
            document.lines.some((line) => !line.unit_id && !variantUnit(line))
          );
          let defaultUnit =
            nextUnits.find((unit) => unit.code.trim().toUpperCase() === DEFAULT_UNIT_CODE) ?? null;
          if (needsDefaultUnit && !defaultUnit && canManageProducts) {
            const createdUnits = await createMovementImportUnitsAction({
              units: [{ key: DEFAULT_UNIT_CODE, code: DEFAULT_UNIT_CODE, name: DEFAULT_UNIT_NAME }],
            });
            const unit =
              createdUnits.success && "data" in createdUnits
                ? (createdUnits.data.created[0]?.unit as InventoryUnitRow | undefined)
                : undefined;
            if (unit) {
              defaultUnit = unit;
              nextUnits = sortUnits([...nextUnits, unit]);
            }
          }
          if (needsDefaultUnit && !defaultUnit) {
            stop();
            toast.error(t("quickNoUnit"));
            return;
          }
          nextDocuments = nextDocuments.map((document) =>
            documentWithRevalidatedLines(
              {
                ...document,
                lines: document.lines.map((line) => {
                  if (line.unit_id) return line;
                  const unitId = variantUnit(line) ?? defaultUnit?.id ?? null;
                  return unitId ? { ...line, unit_id: unitId } : line;
                }),
              },
              fieldPolicies,
              movementTypeCode,
              defer
            )
          );

          const ambiguousKeys = new Set<string>();
          const missingByKey = new Map<string, EditableLine>();
          for (const line of nextDocuments.flatMap((document) => document.lines)) {
            if (line.variant_id || !line.raw_product_code) continue;
            const key = rawProductKey(line);
            if (!key) continue;
            if (isProductAmbiguous(line)) ambiguousKeys.add(key);
            else if (!missingByKey.has(key)) missingByKey.set(key, line);
          }
          for (const key of ambiguousKeys) missingByKey.delete(key);

          if (missingByKey.size > 0) {
            if (!canManageProducts) {
              stop();
              toast.warning(t("quickNoProductPermission"));
              return;
            }
            setQuickStep("products");
            const products = Array.from(missingByKey.entries()).flatMap(([key, line]) => {
              const sku =
                line.normalized_product_code || normalizeImportedSku(line.raw_product_code);
              if (!sku || !line.unit_id) return [];
              const unit = nextUnits.find((item) => item.id === line.unit_id);
              const name =
                (line.normalized_product_name ?? line.raw_product_name ?? "").trim() || sku;
              return [
                {
                  key,
                  sku: sku.slice(0, 100),
                  name: name.slice(0, 200),
                  unit_id: line.unit_id,
                  unit_code: unit?.code ?? "",
                },
              ];
            });
            const created = new Map<string, InventoryVariantOption>();
            for (let start = 0; start < products.length; start += PRODUCT_BATCH_SIZE) {
              const batch = await createMovementImportProductsAction({
                products: products.slice(start, start + PRODUCT_BATCH_SIZE),
              });
              if (!batch.success || !("data" in batch)) {
                nextVariants = sortVariants([...nextVariants, ...created.values()]);
                stop();
                toast.error(withActionError(t("toasts.createProductsFailed"), batch));
                return;
              }
              for (const item of batch.data.created) created.set(item.key, item.variant);
            }
            productsCreated = created.size;
            nextVariants = sortVariants([...nextVariants, ...created.values()]);
            nextDocuments = nextDocuments.map((document) =>
              documentWithRevalidatedLines(
                {
                  ...document,
                  lines: document.lines.map((line) => {
                    if (line.variant_id) return line;
                    const variant = created.get(rawProductKey(line));
                    return variant
                      ? { ...line, variant_id: variant.id, unit_id: variant.unit_id }
                      : line;
                  }),
                },
                fieldPolicies,
                movementTypeCode,
                defer
              )
            );
          }

          if (ambiguousKeys.size > 0) {
            stop();
            toast.warning(t("quickStoppedAmbiguous", { count: ambiguousKeys.size }));
            return;
          }
        }

        const document = nextDocuments[0]!;
        const lines = document.lines;
        if (lines.length === 0 || !lines.every(isImportLineReady)) {
          stop();
          toast.warning(t("quickStoppedNeedsReview"));
          return;
        }
        setVariantOptions(nextVariants);
        setUnitOptions(nextUnits);
        onApply(buildDraft(data, document, lines, nextVariants, nextUnits));
        resetPreview();
        onOpenChange(false);
        toast.success(
          t("quickDone", {
            lines: lines.length,
            orders: ordersCreated,
            products: productsCreated,
          })
        );
      } finally {
        setQuickStep(null);
      }
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
      toast.error(t("toasts.firstRowUnitFirst"));
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

  // Most delivery lines share one unit (szt), so set it once for every
  // missing-product row that has none yet.
  const applyUnitToAllProducts = (unitId: string) => {
    if (!unitId) return;
    const targetKeys = new Set(svwmsActiveProductExceptionGroups.map((group) => group.key));
    updateMatchingLines(
      (candidate) => targetKeys.has(rawProductKey(candidate)) && !candidate.unit_id,
      { unit_id: unitId }
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
      toast.error(withActionError(t("toasts.createUnitsFailed"), result));
      return;
    }
    const created = new Map<string, InventoryUnitRow>(
      result.data.created.map((item) => [item.key, item.unit as InventoryUnitRow])
    );
    if (created.size === 0) {
      toast.error(t("toasts.noUnitsCreated"));
      return;
    }
    setUnitOptions((current) => sortUnits([...current, ...Array.from(created.values())]));
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
    toast.success(t("toasts.unitsCreated", { count: created.size }));
  };

  const handleCreateMissingProducts = async () => {
    if (!canManageProducts) return;
    if (selectedCreateProductGroups.length === 0) {
      if (blockedCreateProductGroups.length > 0) {
        toast.error(t("toasts.resolveUnitsFirst"));
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
      toast.error(withActionError(t("toasts.createProductsFailed"), result));
      return;
    }
    const created = new Map<string, InventoryVariantOption>(
      result.data.created.map((item) => [item.key, item.variant])
    );
    if (created.size === 0) {
      toast.error(t("toasts.noProductsCreated"));
      return;
    }
    setVariantOptions((current) => sortVariants([...current, ...Array.from(created.values())]));
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
    toast.success(t("toasts.productsCreated", { count: created.size }));
  };

  const handleApply = () => {
    if (!selectedDocument || !preview) return;
    if (!canApply) {
      toast.error(
        selectedDocumentErrors[0] ? tError(selectedDocumentErrors[0]) : t("toasts.resolveFirst")
      );
      return;
    }
    onApply(
      buildDraft(preview, selectedDocument, selectedActiveLines, variantOptions, unitOptions)
    );
    onOpenChange(false);
    toast.success(t("toasts.filled"));
  };

  const unitById = useMemo(
    () => new Map(unitOptions.map((unit) => [unit.id, unit])),
    [unitOptions]
  );
  const svwmsLines = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    return [...orderLines]
      .filter((line) => !skippedProductKeys.has(rawProductKey(line)))
      .sort((left, right) => {
        const leftOrder = lineOrderNumber(left) ?? "￿";
        const rightOrder = lineOrderNumber(right) ?? "￿";
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
  }, [isSvwmsSessionImport, orderLines, selectedDocument, skippedProductKeys]);
  const svwmsUnitExceptionGroups = useMemo(() => {
    if (!selectedDocument || !isSvwmsSessionImport) return [];
    const groups = new Map<string, UnitExceptionGroup>();
    for (const line of orderLines) {
      if (skippedProductKeys.has(rawProductKey(line))) continue;
      if (!line.variant_id) continue;
      if (line.unit_id) continue;
      const key = unitExceptionKey(line);
      const current = groups.get(key) ?? {
        key,
        rawUnit: line.normalized_unit_code ?? line.raw_unit ?? null,
        lines: [],
        ambiguous: false,
      };
      current.lines.push(line);
      current.ambiguous ||= isUnitAmbiguous(line);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [isSvwmsSessionImport, orderLines, selectedDocument, skippedProductKeys]);
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
    for (const line of orderLines) {
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
      current.ambiguous ||= isProductAmbiguous(line);
      current.skipped ||= skippedProductKeys.has(key);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [isSvwmsSessionImport, orderLines, selectedDocument, skippedProductKeys]);
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
    return orderLines.filter((line) => skippedProductKeys.has(rawProductKey(line))).length;
  }, [isSvwmsSessionImport, orderLines, selectedDocument, skippedProductKeys]);
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
  const busy = isPending || quickStep !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              {t("source")}
              <select
                value={sourceType}
                onChange={(event) => {
                  setSourceType(event.target.value);
                  setSourceInput({});
                  resetPreview();
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t("sourcePlaceholder")}</option>
                {sources.map((source) => (
                  <option key={source.source_type} value={source.source_type}>
                    {sourceLabel(source.source_type, source.label)}
                  </option>
                ))}
              </select>
            </label>

            {sourcesLoaded && sources.length === 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 md:col-span-2">
                {t("noSources")}
              </div>
            )}

            {(selectedSource?.input_fields ?? []).map((field) => (
              <label key={field.key} className="grid gap-1 text-sm font-medium">
                {fieldLabel(field)}
                {field.type === "select" ? (
                  <select
                    value={sourceInput[field.key] ?? ""}
                    onChange={(event) => {
                      setSourceInput((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }));
                      resetPreview();
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">{fieldPlaceholder(field)}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.imported_document
                          ? t("alreadyImportedOption", {
                              label: option.label,
                              document: option.imported_document,
                            })
                          : option.label}
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
                  <span className="text-xs text-muted-foreground">{t("noSessions")}</span>
                )}
              </label>
            ))}
          </div>

          {alreadyImportedDocument && (
            <div
              className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
              data-testid="import-already-imported"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("alreadyImported", { document: alreadyImportedDocument })}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">{t("quickImportHint")}</span>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={busy || !sourceType}
            >
              {isPending && quickStep === null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("manualReview")}
            </Button>
            <Button
              type="button"
              onClick={handleQuickImport}
              disabled={busy || !sourceType}
              data-testid="import-quick"
            >
              {quickStep ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {quickStep ? t(`quickStep.${quickStep}`) : t("quickImport")}
            </Button>
          </div>

          {documents.length > 0 && (
            <div className="mt-5 space-y-4">
              {showDocumentSelector && (
                <div className="grid gap-1 text-sm font-medium">
                  {t("sourceDocument")}
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
                  <span>{selectedDocumentErrors.map(tError).join(", ")}</span>
                </div>
              ) : !isSvwmsSessionImport ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("documentReady")}
                </div>
              ) : null}

              {isSvwmsSessionImport &&
                typeof selectedDocument?.source_metadata?.session_id === "string" && (
                  <section className="rounded-md border p-3" data-testid="import-repair-orders">
                    <h3 className="text-sm font-semibold">{t("repairOrders.title")}</h3>
                    <p className="text-muted-foreground mb-3 text-xs">{t("repairOrders.hint")}</p>
                    <RepairOrderImportReview
                      key={repairOrderReviewKey}
                      sourceType={SVWMS_SOURCE}
                      sourceInput={{ session_id: selectedDocument.source_metadata.session_id }}
                      canApply
                      compact
                      mode="receipt"
                      onSelectionChange={(zls) => setExcludedZls(new Set(zls))}
                    />
                  </section>
                )}

              {isSvwmsSessionImport && dialogView === "review_ready" && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("allReady")}
                </div>
              )}

              {isSvwmsSessionImport && dialogView === "resolve_mismatches" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {svwmsAllRowsSkipped ? (
                    <span>{t("allSkipped")}</span>
                  ) : (
                    <span>
                      {t("needsDecisions", {
                        rows: svwmsRowsNeedingDecisions,
                        groups: svwmsUnresolvedGroupCount,
                      })}
                    </span>
                  )}
                </div>
              )}

              {isSvwmsSessionImport ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-5">
                    <ImportSummaryTile
                      label={t("tiles.imported")}
                      value={selectedDocument?.lines.length ?? 0}
                    />
                    <ImportSummaryTile
                      label={t("tiles.ready")}
                      value={svwmsResolvedLineCount}
                      good
                    />
                    <ImportSummaryTile
                      label={t("tiles.missingUnits")}
                      value={svwmsMissingUnitGroups.length}
                      muted={svwmsMissingUnitGroups.length === 0}
                    />
                    <ImportSummaryTile
                      label={t("tiles.productExceptions")}
                      value={svwmsActiveProductExceptionGroups.length}
                      muted={svwmsActiveProductExceptionGroups.length === 0}
                    />
                    <ImportSummaryTile
                      label={t("tiles.skipped")}
                      value={svwmsSkippedLineCount}
                      muted={svwmsSkippedLineCount === 0}
                    />
                  </div>

                  {dialogView === "resolve_mismatches" ? (
                    <div className="space-y-4 rounded-md border bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                        <div>
                          <p className="font-medium">{t("decisions.title")}</p>
                          <p className="text-xs text-muted-foreground">{t("decisions.hint")}</p>
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
                              {t("actions.createUnits")}
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
                                {t("actions.createSelected", {
                                  count: selectedCreateProductGroups.length,
                                })}
                              </Button>
                            )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShowManualReview((current) => !current)}
                          >
                            {t("actions.toggleDetails")}
                          </Button>
                          {svwmsMissingProductGroups.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleSkipMissingProducts}
                              disabled={quickCreatePendingKey !== null}
                            >
                              {t("actions.skipMissing")}
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
                              {t("actions.restoreSkipped")}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-4 p-3">
                        {svwmsAllRowsSkipped && (
                          <div className="rounded-md border border-amber-500/30 bg-background p-3 text-sm">
                            {t("allSkippedPanel")}
                          </div>
                        )}

                        {svwmsUnitExceptionGroups.length > 0 && (
                          <WarehouseImportReviewTable
                            title={t("unitMismatches.title")}
                            description={t("unitMismatches.description")}
                            emptyMessage={t("items.empty")}
                            rows={svwmsUnitExceptionGroups}
                            rowKey={(group) => group.key}
                            minWidth="min-w-[1080px]"
                            columns={[
                              {
                                key: "no",
                                header: t("columns.no"),
                                className: "w-16 text-muted-foreground",
                                render: (_group, index) => index + 1,
                              },
                              {
                                key: "sku",
                                header: t("columns.sku"),
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
                                          {t("more", { count: group.lines.length - 1 })}
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                },
                              },
                              {
                                key: "name",
                                header: t("columns.name"),
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
                                header: t("columns.qty"),
                                className: "text-right",
                                render: (group) => (
                                  <span className="font-mono">
                                    {group.lines[0]?.quantity ?? "-"}
                                  </span>
                                ),
                              },
                              {
                                key: "order",
                                header: t("columns.order"),
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
                                header: t("columns.importedUnit"),
                                render: (group) => (
                                  <span className="font-mono text-xs">
                                    {group.rawUnit ?? t("noUnitProvided")}
                                  </span>
                                ),
                              },
                              {
                                key: "problem",
                                header: t("columns.problem"),
                                render: (group) => (
                                  <span className="text-xs text-destructive">
                                    {group.ambiguous
                                      ? t("problems.ambiguousUnit")
                                      : t("problems.missingUnit")}
                                  </span>
                                ),
                              },
                              {
                                key: "action",
                                header: t("columns.action"),
                                className: "min-w-64",
                                render: (group) => (
                                  <select
                                    value=""
                                    onChange={(event) =>
                                      handleMapUnitGroup(group.key, event.target.value)
                                    }
                                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                  >
                                    <option value="">{t("assignExistingUnit")}</option>
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

                        {svwmsActiveProductExceptionGroups.some((group) => !groupUnitId(group)) && (
                          <div
                            className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-3 text-sm"
                            data-testid="import-bulk-unit"
                          >
                            <span className="font-medium">{t("bulkUnit")}</span>
                            <select
                              value=""
                              onChange={(event) => applyUnitToAllProducts(event.target.value)}
                              className="h-9 min-w-56 rounded-md border bg-background px-2 text-sm"
                              aria-label={t("bulkUnitAria")}
                            >
                              <option value="">{t("selectUnit")}</option>
                              {unitOptions.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.code} - {unit.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {svwmsActiveProductExceptionGroups.length > 0 && (
                          <WarehouseImportReviewTable
                            title={t("productMismatches.title")}
                            description={t("productMismatches.description")}
                            emptyMessage={t("items.empty")}
                            rows={svwmsActiveProductExceptionGroups}
                            rowKey={(group) => group.key}
                            minWidth="min-w-[1040px]"
                            columns={[
                              {
                                key: "no",
                                header: t("columns.no"),
                                className: "w-16 text-muted-foreground",
                                render: (_group, index) => index + 1,
                              },
                              {
                                key: "sku",
                                header: t("columns.itemSku"),
                                render: (group) => (
                                  <span className="font-mono text-xs">
                                    {group.normalizedCode ?? group.rawCode}
                                  </span>
                                ),
                              },
                              {
                                key: "name",
                                header: t("columns.name"),
                                className: "min-w-64",
                                render: (group) => group.rawName,
                              },
                              {
                                key: "unit",
                                header: (
                                  <span className="flex items-center gap-1.5">
                                    {t("columns.unit")}
                                    <ImportCopyButton
                                      label="unit"
                                      title={t("actions.copyUnit")}
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
                                    <option value="">{t("selectUnit")}</option>
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
                                header: t("columns.rows"),
                                render: (group) => group.lines.length,
                              },
                              {
                                key: "problem",
                                header: t("columns.problem"),
                                render: (group) => (
                                  <span className="text-xs text-destructive">
                                    {group.ambiguous
                                      ? t("problems.multipleMatches")
                                      : !groupUnitId(group)
                                        ? t("problems.missingProductSelectUnit")
                                        : t("problems.missingProduct")}
                                  </span>
                                ),
                              },
                              {
                                key: "action",
                                header: (
                                  <span className="flex items-center gap-1.5">
                                    {t("columns.howToProceed")}
                                    <ImportCopyButton
                                      label="action"
                                      title={t("actions.copyAction")}
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
                                          {t("productActions.create")}
                                        </option>
                                        <option value="assign_existing">
                                          {t("productActions.assignExisting")}
                                        </option>
                                        <option value="skip">{t("productActions.skip")}</option>
                                      </select>

                                      {action === "assign_existing" ? (
                                        <select
                                          value=""
                                          onChange={(event) =>
                                            handleMapProductGroup(group.key, event.target.value)
                                          }
                                          className="h-9 rounded-md border bg-background px-2 text-sm"
                                        >
                                          <option value="">
                                            {t("productActions.pickExisting")}
                                          </option>
                                          {variantOptions.map((variant) => (
                                            <option key={variant.id} value={variant.id}>
                                              {variantLabel(variant)}
                                            </option>
                                          ))}
                                        </select>
                                      ) : action === "create" ? (
                                        <span className="self-center text-xs text-muted-foreground">
                                          {t("productActions.willCreate")}
                                        </span>
                                      ) : (
                                        <span className="self-center text-xs text-muted-foreground">
                                          {t("productActions.willSkip")}
                                        </span>
                                      )}
                                      {createBlockReason ? (
                                        <span className="text-xs text-muted-foreground sm:col-span-2">
                                          {t(`blockReasons.${createBlockReason}`)}
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
                                  <th className="px-3 py-2 text-left">{t("columns.order")}</th>
                                  <th className="px-3 py-2 text-left">{t("columns.sku")}</th>
                                  <th className="px-3 py-2 text-left">{t("columns.name")}</th>
                                  <th className="px-3 py-2 text-left">{t("columns.unit")}</th>
                                  <th className="px-3 py-2 text-left">{t("columns.problem")}</th>
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
                                        {line.validation_errors.map(tError).join(", ")}
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
                          {t("skippedRows", { count: svwmsSkippedLineCount })}
                        </div>
                      )}
                      <WarehouseImportReviewTable
                        title={t("items.title")}
                        description={t("items.description")}
                        emptyMessage={t("items.empty")}
                        rows={svwmsLines}
                        rowKey={(line) => line.source_line_id}
                        minWidth="min-w-[860px]"
                        columns={[
                          {
                            key: "no",
                            header: t("columns.no"),
                            className: "w-16 text-muted-foreground",
                            render: (_line, index) => index + 1,
                          },
                          {
                            key: "sku",
                            header: t("columns.sku"),
                            render: (line) => (
                              <span className="font-mono text-xs">
                                {line.normalized_product_code ?? line.raw_product_code ?? "-"}
                              </span>
                            ),
                          },
                          {
                            key: "name",
                            header: t("columns.name"),
                            className: "min-w-64",
                            render: (line) =>
                              line.normalized_product_name ?? line.raw_product_name ?? "-",
                          },
                          {
                            key: "qty",
                            header: t("columns.qty"),
                            className: "text-right",
                            render: (line) => (
                              <span className="font-mono">{line.quantity ?? "-"}</span>
                            ),
                          },
                          {
                            key: "unit",
                            header: t("columns.unit"),
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
                                <option value="">{t("selectUnit")}</option>
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
                            header: t("columns.order"),
                            render: (line) => (
                              <span className="font-mono text-xs">
                                {lineOrderNumber(line) ?? "-"}
                              </span>
                            ),
                          },
                          {
                            key: "status",
                            header: t("columns.status"),
                            render: (line) =>
                              isImportLineReady(line) ? (
                                <span className="text-emerald-700">{t("statusReady")}</span>
                              ) : (
                                <span className="text-destructive">
                                  {line.validation_errors.map(tError).join(", ") ||
                                    t("needsResolution")}
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
                        <th className="px-3 py-2 text-left">{t("columns.importedItem")}</th>
                        <th className="px-3 py-2 text-left">{t("columns.product")}</th>
                        <th className="px-3 py-2 text-left">{t("columns.unit")}</th>
                        <th className="px-3 py-2 text-left">{t("columns.qty")}</th>
                        <th className="px-3 py-2 text-left">{t("columns.source")}</th>
                        <th className="px-3 py-2 text-left">{t("columns.destination")}</th>
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
                                  {line.validation_errors.map(tError).join(", ")}
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
                                <option value="">{t("selectProduct")}</option>
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
                                <option value="">{t("selectUnit")}</option>
                                {unitOptions.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.code} - {unit.name}
                                  </option>
                                ))}
                              </select>
                              {selectedUnit && (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {t("importedUnitValue", { unit: line.raw_unit ?? "-" })}
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
                                <option value="">{t("noSource")}</option>
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
                                <option value="">{t("noDestination")}</option>
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
            {t("cancel")}
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
                {t("actions.createSelected", { count: selectedCreateProductGroups.length })}
              </Button>
            )}
          {documents.length > 0 && (
            <Button type="button" onClick={handleApply} disabled={!canApply || busy}>
              {t("fill")}
            </Button>
          )}
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
