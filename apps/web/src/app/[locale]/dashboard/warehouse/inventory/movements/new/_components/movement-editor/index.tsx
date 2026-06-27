"use client";

import React, { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { FileText, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InventoryItemPickerMode } from "@/components/warehouse/inventory-item-picker-dialog";
import { InventoryItemPickerDialog } from "@/components/warehouse/inventory-item-picker-dialog";
import { MovementActionBar } from "./movement-action-bar";
import { MovementValidationStrip } from "./movement-validation-strip";
import { MovementDocumentDataTab } from "./movement-document-data-tab";
import { MovementImportDialog } from "./movement-import-dialog";
import { MovementPositionsTab } from "./movement-positions-tab";
import { useMovementFormState } from "./use-movement-form-state";
import { useMovementValidation } from "./use-movement-validation";
import { useMovementSubmission } from "./use-movement-submission";
import type { MovementFormProps } from "./types";

export type { MovementFormInitialValues } from "./types";

export function MovementDocumentForm({
  mode,
  branchName,
  createdByName,
  movementTypes,
  fieldPolicies,
  stockableLocations,
  variants,
  units,
  initialValues,
}: MovementFormProps) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const today = new Date().toISOString().split("T")[0];
  const isEdit = mode === "edit";

  const form = useMovementFormState(movementTypes, fieldPolicies, variants, units, initialValues);
  const validation = useMovementValidation(
    form.typeCode,
    form.requiresSourceLocation,
    form.requiresDestinationLocation,
    form.allowsSender ? form.senderName : "",
    form.allowsRecipient ? form.recipientName : "",
    form.srcLoc,
    form.dstLoc,
    form.lines
  );
  const { isPending, submit } = useMovementSubmission(
    mode,
    form.typeCode,
    form.requiresSourceLocation,
    form.senderName,
    form.senderDetails,
    form.recipientName,
    form.recipientDetails,
    form.externalReference,
    form.noteForSave,
    form.srcLoc,
    form.dstLoc,
    form.lines,
    validation,
    initialValues
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const pickerMode: InventoryItemPickerMode = form.is801 ? "stockInLocation" : "allItems";
  const pickerDisabled = form.is801 && !form.srcLoc;

  const handleOpenPicker = useCallback(() => {
    if (form.is801 && !form.srcLoc) {
      toast.error(t("selectSourceFirst"));
      return;
    }
    setPickerOpen(true);
  }, [form.is801, form.srcLoc]);

  const handleSaveDraft = useCallback(() => submit(false), [submit]);
  const handleSaveAndPost = useCallback(() => submit(true), [submit]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground">
      <MovementActionBar
        isEdit={isEdit}
        draftNumber={initialValues?.draftNumber}
        branchName={branchName}
        selType={form.selType}
        lineCount={form.lines.length}
        totalQty={form.totalQty}
        isPending={isPending}
        isValid={validation.isValid}
        onImport={!isEdit ? () => setImportOpen(true) : undefined}
        onSaveDraft={handleSaveDraft}
        onSaveAndPost={handleSaveAndPost}
      />

      <MovementValidationStrip
        validation={validation}
        documentTypeCode={form.selType?.document_type_code}
      />

      {/* Tab Navigation */}
      <div className="shrink-0 border-b select-none px-4">
        <div className="flex gap-0 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => form.setActiveTab("header")}
            className={cn(
              "py-2.5 px-4 text-xs uppercase font-bold tracking-wider flex items-center gap-2 border-b-2 transition-colors",
              form.activeTab === "header"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">A.</span> {t("documentHeader")}
            {validation.documentErrors.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] h-4 min-w-4 px-1 rounded-sm">
                {validation.documentErrors.length}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => form.setActiveTab("lines")}
            className={cn(
              "py-2.5 px-4 text-xs uppercase font-bold tracking-wider flex items-center gap-2 border-b-2 transition-colors",
              form.activeTab === "lines"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">B.</span> {t("positionsTab")}
            <Badge variant="secondary" className="ml-1 text-[10px] h-5 min-w-5 px-1.5 rounded-sm">
              {form.lines.length}
            </Badge>
            {validation.positionErrors.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] h-4 min-w-4 px-1 rounded-sm">
                {validation.positionErrors.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl w-full mx-auto px-4 py-4">
          {form.activeTab === "header" && (
            <MovementDocumentDataTab
              typeCode={form.typeCode}
              selType={form.selType}
              isEdit={isEdit}
              movementTypes={movementTypes}
              allowsSender={form.allowsSender}
              allowsRecipient={form.allowsRecipient}
              senderName={form.senderName}
              recipientName={form.recipientName}
              supplierFields={form.supplierFields}
              supplierLocked={form.supplierLocked}
              externalReference={form.externalReference}
              noteRichText={form.noteRichText}
              operationDate={initialValues?.operationDate ?? today}
              documentDate={
                isEdit ? (initialValues?.documentDate ?? t("atPosting")) : t("atPosting")
              }
              branchName={branchName}
              createdByName={createdByName ?? ""}
              onTypeChange={form.handleTypeChange}
              onSenderChange={form.setSenderName}
              onSenderDetailsChange={form.setSenderDetails}
              onRecipientChange={form.setRecipientName}
              onSupplierFieldsChange={form.setSupplierFields}
              onSupplierLockedChange={form.setSupplierLocked}
              onExternalRefChange={form.setExternalReference}
              onNoteRichTextChange={form.setNoteRichText}
            />
          )}
          {form.activeTab === "lines" && (
            <MovementPositionsTab
              selType={form.selType}
              isPZ={form.isPZ}
              is801={form.is801}
              srcLoc={form.srcLoc}
              dstLoc={form.dstLoc}
              stockableLocations={stockableLocations}
              lines={form.lines}
              pickerDisabled={pickerDisabled}
              onOpenPicker={handleOpenPicker}
              onRemoveLine={form.removeLine}
              onUpdateLineQty={form.updateLineQty}
              onSrcLocChange={form.handleSrcChange}
              onDstLocChange={form.setDstLoc}
            />
          )}
        </div>
      </main>

      <InventoryItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={pickerMode}
        sourceLocationId={form.is801 ? form.srcLoc : undefined}
        onAddItems={form.addPickedItems}
      />
      {!isEdit && (
        <MovementImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          movementTypes={movementTypes}
          currentMovementTypeCode={form.typeCode}
          variants={variants}
          units={units}
          stockableLocations={stockableLocations}
          fieldPolicies={fieldPolicies}
          onApply={form.applyImportedDocument}
        />
      )}
    </div>
  );
}
