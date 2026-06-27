"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InventoryMovementType } from "@/lib/warehouse/inventory-types";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { MovementTypePicker } from "@/components/warehouse/movement-type-picker";
import { MovementSupplierSection, type SupplierFields } from "./movement-supplier-section";

type Props = {
  typeCode: string;
  selType: InventoryMovementType | null;
  isEdit: boolean;
  movementTypes: InventoryMovementType[];
  allowsSender: boolean;
  allowsRecipient: boolean;
  senderName: string;
  recipientName: string;
  supplierFields: SupplierFields;
  supplierLocked: boolean;
  externalReference: string;
  noteRichText: RichTextValue | null;
  operationDate: string;
  documentDate: string;
  branchName: string;
  createdByName: string;
  onTypeChange: (code: string) => void;
  onSenderChange: (val: string) => void;
  onSenderDetailsChange: (details: SupplierFields) => void;
  onRecipientChange: (val: string) => void;
  onSupplierFieldsChange: (fields: SupplierFields) => void;
  onSupplierLockedChange: (locked: boolean) => void;
  onExternalRefChange: (val: string) => void;
  onNoteRichTextChange: (val: RichTextValue) => void;
};

function LBL({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export const MovementDocumentDataTab = React.memo(function MovementDocumentDataTab({
  typeCode,
  selType,
  isEdit,
  movementTypes,
  allowsSender,
  allowsRecipient,
  senderName,
  recipientName,
  supplierFields,
  supplierLocked,
  externalReference,
  noteRichText,
  operationDate,
  documentDate,
  branchName,
  createdByName,
  onTypeChange,
  onSenderChange,
  onSenderDetailsChange,
  onRecipientChange,
  onSupplierFieldsChange,
  onSupplierLockedChange,
  onExternalRefChange,
  onNoteRichTextChange,
}: Props) {
  const t = useTranslations("warehouseInventory.movementEditor");

  return (
    <div className="space-y-4">
      {/* Movement Type */}
      <section className="rounded-sm border bg-card p-4">
        <div className="flex items-center justify-between border-b pb-2 mb-3">
          <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
            <FileText className="h-4 w-4" />
            {t("movementType")}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {t("typeSelection")}
          </span>
        </div>
        <MovementTypePicker
          value={typeCode || null}
          onChange={onTypeChange}
          movementTypes={movementTypes}
          readonly={isEdit}
        />
      </section>

      {/* Document Details */}
      {selType && (
        <section className="rounded-sm border bg-card p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground border-b pb-2 mb-3">
            {t("documentDetails")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <LBL label={t("branchWarehouse")}>
              <Input value={branchName} readOnly className="h-9 text-sm bg-muted/30" />
            </LBL>
            <LBL label={t("createdBy")}>
              <Input value={createdByName || "—"} readOnly className="h-9 text-sm bg-muted/30" />
            </LBL>
            <LBL label={t("operationDate")}>
              <Input
                type="date"
                value={operationDate}
                readOnly
                className="h-9 text-sm bg-muted/30 font-mono"
              />
            </LBL>
            <LBL label={t("documentDate")}>
              <Input
                value={documentDate}
                readOnly
                className="h-9 text-sm bg-muted/30 text-muted-foreground text-center font-mono"
              />
            </LBL>
            <LBL label={t("externalReference")}>
              <Input
                placeholder={t("externalRefPlaceholder")}
                value={externalReference}
                onChange={(e) => onExternalRefChange(e.target.value)}
                className="h-9 text-sm font-mono placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
              />
            </LBL>
          </div>
        </section>
      )}

      {/* Sender / recipient fields are controlled by movement field policy. */}
      {selType && allowsSender && (
        <MovementSupplierSection
          fields={supplierFields}
          locked={supplierLocked}
          onFieldsChange={onSupplierFieldsChange}
          onLockedChange={onSupplierLockedChange}
          onSenderChange={onSenderChange}
          onDetailsChange={onSenderDetailsChange}
        />
      )}

      {selType && allowsRecipient && (
        <section className="rounded-sm border bg-card p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground border-b pb-2 mb-3">
            {t("recipient")}
          </div>
          <LBL label={t("recipient")}>
            <Input
              placeholder={t("recipientPlaceholder")}
              value={recipientName}
              onChange={(event) => onRecipientChange(event.target.value)}
              className="h-9 text-sm"
            />
          </LBL>
        </section>
      )}

      {/* Note */}
      {selType && (
        <section className="rounded-sm border bg-card p-4">
          <RichTextEditorField
            value={noteRichText}
            onChange={onNoteRichTextChange}
            placeholder={t("notesPlaceholder")}
            mode="simple"
            maxLength={2000}
            contentClassName="min-h-[80px] [&_.ProseMirror]:min-h-[60px]"
            label={t("movementNotes")}
          />
        </section>
      )}
    </div>
  );
});
