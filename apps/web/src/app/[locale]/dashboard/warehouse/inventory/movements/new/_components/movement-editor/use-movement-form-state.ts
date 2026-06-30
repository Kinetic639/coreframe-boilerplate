import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import type {
  InventoryMovementType,
  InventoryUnitRow,
  InventoryVariantOption,
  MovementFieldPolicyBundle,
  MovementPartyDetails,
} from "@/lib/warehouse/inventory-types";
import { movementPolicyCapabilities } from "@/lib/warehouse/movement-field-policy";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  normalizeRichText,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";
import type { PickedMovementItem } from "@/components/warehouse/inventory-item-picker-dialog";
import type { SupplierFields } from "./movement-supplier-section";
import type { ImportedMovementDocumentDraft, LineDraft, MovementFormInitialValues } from "./types";

function initNoteValue(note?: string): RichTextValue | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note);
    return normalizeRichText(parsed);
  } catch {
    /* not JSON, wrap as plain text */
  }
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: note }] }] };
}

function emptyPartyFields(name = ""): SupplierFields {
  return {
    name,
    nip: "",
    phone: "",
    street: "",
    postalCode: "",
    city: "",
  };
}

function partyFieldsFromDetails(
  details: MovementPartyDetails | null | undefined,
  fallbackName = ""
): SupplierFields {
  return {
    name: details?.name ?? fallbackName,
    nip: details?.nip ?? "",
    phone: details?.phone ?? "",
    street: details?.street ?? "",
    postalCode: details?.postalCode ?? "",
    city: details?.city ?? "",
  };
}

export function useMovementFormState(
  movementTypes: InventoryMovementType[],
  fieldPolicies: MovementFieldPolicyBundle,
  variants: InventoryVariantOption[],
  units: InventoryUnitRow[],
  initialValues?: MovementFormInitialValues,
  defaultRecipientName = ""
) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const initialTypeCode = initialValues?.movementTypeCode ?? movementTypes[0]?.code ?? "";
  const initialType = movementTypes.find((type) => type.code === initialTypeCode) ?? null;
  const isInitialIncomingReceipt = initialType?.document_type_code === "PZ";
  const defaultRecipientFields = useMemo(
    () => emptyPartyFields(defaultRecipientName),
    [defaultRecipientName]
  );
  const [typeCode, setTypeCode] = useState(initialTypeCode);
  const [senderName, setSenderName] = useState(initialValues?.senderName ?? "");
  const [senderDetails, setSenderDetails] = useState<MovementPartyDetails | null>(
    initialValues?.senderDetails ?? null
  );
  const [recipientName, setRecipientName] = useState(
    initialValues?.recipientName ?? (isInitialIncomingReceipt ? defaultRecipientName : "")
  );
  const [recipientDetails, setRecipientDetails] = useState<MovementPartyDetails | null>(
    initialValues?.recipientDetails ??
      (isInitialIncomingReceipt && defaultRecipientName ? defaultRecipientFields : null)
  );
  const [supplierFields, setSupplierFields] = useState(
    partyFieldsFromDetails(initialValues?.senderDetails, initialValues?.senderName ?? "")
  );
  const [supplierLocked, setSupplierLocked] = useState(false);
  const [recipientFields, setRecipientFields] = useState(
    partyFieldsFromDetails(
      initialValues?.recipientDetails,
      initialValues?.recipientName ?? (isInitialIncomingReceipt ? defaultRecipientName : "")
    )
  );
  const [recipientLocked, setRecipientLocked] = useState(
    isInitialIncomingReceipt && !!defaultRecipientName
  );
  const [externalReference, setExternalReference] = useState(
    initialValues?.externalReference ?? ""
  );
  const [noteRichText, setNoteRichText] = useState<RichTextValue | null>(() =>
    initNoteValue(initialValues?.note)
  );
  const notePlainText = useMemo(() => extractPlainText(noteRichText), [noteRichText]);
  const noteForSave = useMemo(
    () => (noteRichText ? JSON.stringify(noteRichText) : ""),
    [noteRichText]
  );
  const [srcLoc, setSrcLoc] = useState(() => initialValues?.lines?.[0]?.source_location_id ?? "");
  const [dstLoc, setDstLoc] = useState(
    () => initialValues?.lines?.[0]?.destination_location_id ?? ""
  );
  const [activeTab, setActiveTab] = useState<"header" | "lines">("header");
  const [manualCorrectionMode, setManualCorrectionMode] = useState(false);

  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (!initialValues?.lines?.length) return [];
    return initialValues.lines.map((l) => ({
      key: crypto.randomUUID(),
      origin: "manual",
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
      note: l.note ?? null,
    }));
  });

  const selType = useMemo(
    () => movementTypes.find((t) => t.code === typeCode) ?? null,
    [movementTypes, typeCode]
  );
  const capabilities = useMemo(
    () => movementPolicyCapabilities(fieldPolicies, typeCode),
    [fieldPolicies, typeCode]
  );
  const requiresSourceLocation = capabilities.requiresSourceLocation;
  const requiresDestinationLocation = capabilities.requiresDestinationLocation;
  const allowsSender = capabilities.allowsSender;
  const allowsRecipient = capabilities.allowsRecipient;
  const isPZ = selType?.document_type_code === "PZ";
  const is801 = requiresSourceLocation && requiresDestinationLocation;
  const totalQty = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0), [lines]);

  const handleTypeChange = useCallback(
    (code: string) => {
      if (code === typeCode) return;
      if (lines.length > 0) {
        if (!window.confirm(t("changingTypeClears"))) return;
        setLines([]);
      }
      setTypeCode(code);
      const nextType = movementTypes.find((type) => type.code === code) ?? null;
      if (nextType?.document_type_code === "PZ" && !recipientName.trim()) {
        setRecipientName(defaultRecipientName);
        setRecipientDetails(defaultRecipientFields);
        setRecipientFields(defaultRecipientFields);
        setRecipientLocked(!!defaultRecipientName);
      }
      setManualCorrectionMode(false);
      setSrcLoc("");
      setDstLoc("");
    },
    [
      defaultRecipientFields,
      defaultRecipientName,
      movementTypes,
      recipientName,
      typeCode,
      lines.length,
      t,
    ]
  );

  const handleSrcChange = useCallback(
    (v: string) => {
      if (v === srcLoc) return;
      if (lines.length > 0 && srcLoc) {
        if (!window.confirm(t("changingSourceClears"))) return;
        setLines([]);
        setManualCorrectionMode(false);
      }
      setSrcLoc(v);
    },
    [srcLoc, lines.length, t]
  );

  const removeLine = useCallback(
    (key: string) => {
      setLines((p) =>
        p.filter((l) => l.key !== key || (l.origin === "imported" && !manualCorrectionMode))
      );
    },
    [manualCorrectionMode]
  );

  const updateLineQty = useCallback(
    (key: string, val: string) => {
      setLines((p) =>
        p.map((l) => {
          if (l.key !== key) return l;
          if (l.origin === "imported" && !manualCorrectionMode) return l;
          let q = Number(val);
          if (is801 && l.on_hand_at_source !== null && q > l.on_hand_at_source)
            q = l.on_hand_at_source;
          return { ...l, quantity: q > 0 ? String(q) : val };
        })
      );
    },
    [is801]
  );

  const addPickedItems = useCallback(
    (items: PickedMovementItem[]) => {
      setLines((prev) => {
        if (prev.some((line) => line.origin === "imported") && !manualCorrectionMode) return prev;
        const next = [...prev];
        for (const item of items) {
          const idx = next.findIndex((l) => l.variant_id === item.variant_id);
          if (idx >= 0) {
            let newQty = Number(next[idx].quantity) + item.quantity;
            if (
              is801 &&
              next[idx].on_hand_at_source !== null &&
              newQty > (next[idx].on_hand_at_source ?? Infinity)
            )
              newQty = next[idx].on_hand_at_source!;
            next[idx] = { ...next[idx], quantity: String(newQty) };
          } else {
            next.push({
              key: crypto.randomUUID(),
              origin: "manual",
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
              note: null,
            });
          }
        }
        return next;
      });
    },
    [is801, manualCorrectionMode, srcLoc, dstLoc]
  );

  const isImportedMovement = useMemo(
    () => lines.some((line) => line.origin === "imported"),
    [lines]
  );
  const importedLinesLocked = isImportedMovement && !manualCorrectionMode;

  const enableManualCorrections = useCallback(() => {
    if (!isImportedMovement) return;
    if (
      !window.confirm(
        "Manual corrections may break alignment with the imported SVWMS source data. Continue?"
      )
    ) {
      return;
    }
    setManualCorrectionMode(true);
  }, [isImportedMovement]);

  const applyImportedDocument = useCallback(
    (document: ImportedMovementDocumentDraft) => {
      if (
        lines.length > 0 &&
        !window.confirm("Importing data will replace the current unsaved movement lines.")
      ) {
        return;
      }
      const nextType = movementTypes.find((type) => type.code === document.movementTypeCode);
      const nextRequiresSource = !!nextType?.requires_source_location;
      const nextRequiresDestination = !!nextType?.requires_destination_location;
      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      const unitById = new Map(units.map((unit) => [unit.id, unit]));
      const importedLines: LineDraft[] = document.lines.map((line) => {
        const variant = variantById.get(line.variant_id);
        const unit = unitById.get(line.unit_id);
        return {
          key: crypto.randomUUID(),
          origin: "imported",
          source_type: line.source_type ?? null,
          source_label: line.source_label ?? null,
          source_line_id: line.source_line_id ?? null,
          source_order_number: line.source_order_number ?? null,
          variant_id: line.variant_id,
          unit_id: line.unit_id,
          sku: variant?.sku ?? line.sku ?? line.variant_id,
          product_name: variant?.product_name ?? line.product_name ?? line.sku ?? line.variant_id,
          unit_code: unit?.code ?? variant?.unit_code ?? line.unit_code ?? "",
          brand_name: null,
          barcode: null,
          quantity: String(line.quantity),
          on_hand_at_source:
            variant?.location_summaries?.find(
              (summary) => summary.location_id === line.source_location_id
            )?.available_quantity ?? null,
          source_location_id: line.source_location_id ?? "",
          destination_location_id: line.destination_location_id ?? "",
          note: line.note ?? null,
        };
      });

      setTypeCode(document.movementTypeCode);
      setSenderName(document.senderName ?? "");
      setSenderDetails(document.senderDetails ?? null);
      setRecipientName(
        document.recipientName ??
          (nextType?.document_type_code === "PZ" ? defaultRecipientName : "")
      );
      setRecipientDetails(
        document.recipientDetails ??
          (nextType?.document_type_code === "PZ" ? defaultRecipientFields : null)
      );
      setSupplierFields(partyFieldsFromDetails(document.senderDetails, document.senderName ?? ""));
      setRecipientFields(
        partyFieldsFromDetails(
          document.recipientDetails,
          document.recipientName ??
            (nextType?.document_type_code === "PZ" ? defaultRecipientName : "")
        )
      );
      setRecipientLocked(nextType?.document_type_code === "PZ" && !!defaultRecipientName);
      setExternalReference(document.externalReference ?? "");
      setNoteRichText(initNoteValue(document.note ?? undefined));
      setSrcLoc(
        nextRequiresSource
          ? (document.lines.find((line) => line.source_location_id)?.source_location_id ?? "")
          : ""
      );
      setDstLoc(
        nextRequiresDestination
          ? (document.lines.find((line) => line.destination_location_id)?.destination_location_id ??
              dstLoc)
          : ""
      );
      setLines(importedLines);
      setManualCorrectionMode(false);
      setActiveTab("lines");
    },
    [
      defaultRecipientFields,
      defaultRecipientName,
      dstLoc,
      lines.length,
      movementTypes,
      t,
      units,
      variants,
    ]
  );

  return {
    typeCode,
    selType,
    isPZ,
    is801,
    requiresSourceLocation,
    requiresDestinationLocation,
    allowsSender,
    allowsRecipient,
    senderName,
    setSenderName,
    senderDetails,
    setSenderDetails,
    recipientName,
    setRecipientName,
    recipientDetails,
    setRecipientDetails,
    recipientFields,
    setRecipientFields,
    recipientLocked,
    setRecipientLocked,
    supplierFields,
    setSupplierFields,
    supplierLocked,
    setSupplierLocked,
    externalReference,
    setExternalReference,
    noteRichText,
    setNoteRichText,
    notePlainText,
    noteForSave,
    srcLoc,
    dstLoc,
    setDstLoc,
    lines,
    totalQty,
    isImportedMovement,
    importedLinesLocked,
    manualCorrectionMode,
    enableManualCorrections,
    activeTab,
    setActiveTab,
    handleTypeChange,
    handleSrcChange,
    removeLine,
    updateLineQty,
    addPickedItems,
    applyImportedDocument,
  };
}
