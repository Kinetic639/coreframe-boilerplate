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

export function useMovementFormState(
  movementTypes: InventoryMovementType[],
  fieldPolicies: MovementFieldPolicyBundle,
  variants: InventoryVariantOption[],
  units: InventoryUnitRow[],
  initialValues?: MovementFormInitialValues
) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [typeCode, setTypeCode] = useState(
    initialValues?.movementTypeCode ?? movementTypes[0]?.code ?? ""
  );
  const [senderName, setSenderName] = useState(initialValues?.senderName ?? "");
  const [senderDetails, setSenderDetails] = useState<MovementPartyDetails | null>(null);
  const [recipientName, setRecipientName] = useState(initialValues?.recipientName ?? "");
  const [recipientDetails, setRecipientDetails] = useState<MovementPartyDetails | null>(null);
  const [supplierFields, setSupplierFields] = useState({
    name: initialValues?.senderName ?? "",
    nip: "",
    phone: "",
    street: "",
    postalCode: "",
    city: "",
  });
  const [supplierLocked, setSupplierLocked] = useState(false);
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

  const [lines, setLines] = useState<LineDraft[]>(() => {
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
      setSrcLoc("");
      setDstLoc("");
    },
    [typeCode, lines.length, t]
  );

  const handleSrcChange = useCallback(
    (v: string) => {
      if (v === srcLoc) return;
      if (lines.length > 0 && srcLoc) {
        if (!window.confirm(t("changingSourceClears"))) return;
        setLines([]);
      }
      setSrcLoc(v);
    },
    [srcLoc, lines.length, t]
  );

  const removeLine = useCallback((key: string) => {
    setLines((p) => p.filter((l) => l.key !== key));
  }, []);

  const updateLineQty = useCallback(
    (key: string, val: string) => {
      setLines((p) =>
        p.map((l) => {
          if (l.key !== key) return l;
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
    },
    [is801, srcLoc, dstLoc]
  );

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
          variant_id: line.variant_id,
          unit_id: line.unit_id,
          sku: variant?.sku ?? "",
          product_name: variant?.product_name ?? "",
          unit_code: unit?.code ?? variant?.unit_code ?? "",
          brand_name: null,
          barcode: null,
          quantity: String(line.quantity),
          on_hand_at_source:
            variant?.location_summaries?.find(
              (summary) => summary.location_id === line.source_location_id
            )?.available_quantity ?? null,
          source_location_id: line.source_location_id ?? "",
          destination_location_id: line.destination_location_id ?? "",
        };
      });

      setTypeCode(document.movementTypeCode);
      setSenderName(document.senderName ?? "");
      setRecipientName(document.recipientName ?? "");
      setSupplierFields((current) => ({
        ...current,
        name: document.senderName ?? "",
      }));
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
              "")
          : ""
      );
      setLines(importedLines);
      setActiveTab("lines");
    },
    [lines.length, movementTypes, t, units, variants]
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
