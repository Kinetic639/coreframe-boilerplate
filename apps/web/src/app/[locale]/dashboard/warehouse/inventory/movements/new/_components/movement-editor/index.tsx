"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { UnitTransferPrompt } from "./unit-transfer-prompt";
import { DocumentWarehouseSection, useDocumentUnits } from "./document-warehouse-section";

export type { MovementFormInitialValues } from "./types";

export function MovementDocumentForm({
  mode,
  organizationName,
  activeBranch,
  branchName,
  createdByName,
  movementTypes,
  fieldPolicies,
  stockableLocations,
  variants,
  units,
  canManageProducts,
  initialValues,
  receivingLocationId = null,
  initialTypeCode,
  autoImport = null,
}: MovementFormProps) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const today = new Date().toISOString().split("T")[0];
  const isEdit = mode === "edit";
  const defaultRecipientName = [organizationName, branchName].filter(Boolean).join(" / ");

  const form = useMovementFormState(
    movementTypes,
    fieldPolicies,
    variants,
    units,
    initialValues,
    defaultRecipientName,
    activeBranch,
    initialTypeCode
  );
  // The document's AutoStacja magazyn and, for an MM, the target magazyn (U3).
  // In edit mode an untouched choice is not sent: the draft keeps its own.
  const documentUnits = useDocumentUnits();
  const [warehouseId, setWarehouseIdState] = useState<string | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseIdState] = useState<string | null>(null);
  const [warehouseTouched, setWarehouseTouched] = useState(false);
  const setWarehouseId = useCallback((id: string | null) => {
    setWarehouseIdState(id);
    setWarehouseTouched(true);
  }, []);
  const setDestinationWarehouseId = useCallback((id: string | null) => {
    setDestinationWarehouseIdState(id);
    setWarehouseTouched(true);
  }, []);
  // One magazyn in the branch: it is the document's magazyn.
  useEffect(() => {
    if (isEdit || warehouseTouched || !documentUnits) return;
    const all = documentUnits.flatMap((u) => u.warehouses);
    if (all.length === 1) setWarehouseIdState(all[0].id);
  }, [documentUnits, isEdit, warehouseTouched]);
  const fromMatcher = form.lines.some((l) => l.source_type === "svwms_wdd_matcher");
  const changesWarehouse = form.is801 && Boolean(destinationWarehouseId);

  const validation = useMovementValidation(
    form.typeCode,
    form.requiresSourceLocation,
    form.requiresDestinationLocation,
    form.allowsSender ? form.senderName : "",
    form.allowsRecipient ? form.recipientName : "",
    form.srcLoc,
    form.dstLoc,
    form.lines,
    changesWarehouse
  );
  const { isPending, submit, transferPrompt, confirmTransfer, cancelTransferPrompt } =
    useMovementSubmission(
      mode,
      form.typeCode,
      form.requiresSourceLocation,
      form.allowsSender ? form.senderName : "",
      form.allowsSender ? form.senderDetails : null,
      form.allowsRecipient ? form.recipientName : "",
      form.allowsRecipient ? form.recipientDetails : null,
      form.externalReference,
      form.noteForSave,
      form.srcLoc,
      form.dstLoc,
      form.lines,
      validation,
      initialValues,
      {
        warehouseId: form.is801 || !fromMatcher ? warehouseId : null,
        destinationWarehouseId: form.is801 ? destinationWarehouseId : null,
        send: !isEdit || warehouseTouched,
      }
    );

  // Zone 5: a PZ always goes to the receiving zone (the server enforces it
  // too); keep the routing in sync so validation and the summary agree.
  const lockedDestinationId = form.isPZ ? receivingLocationId : null;
  const { dstLoc, setDstLoc } = form;
  useEffect(() => {
    if (lockedDestinationId && dstLoc !== lockedDestinationId) setDstLoc(lockedDestinationId);
  }, [lockedDestinationId, dstLoc, setDstLoc]);

  const [pickerOpen, setPickerOpen] = useState(false);
  // Opened from the Matcher's "Utwórz PZ": the import starts by itself.
  const [importOpen, setImportOpen] = useState(() => !isEdit && Boolean(autoImport));
  const pickerMode: InventoryItemPickerMode = form.is801 ? "stockInLocation" : "allItems";
  const pickerDisabled = form.is801 && !form.srcLoc;

  const handleOpenPicker = useCallback(() => {
    if (form.importedLinesLocked) {
      toast.error(t("manualCorrectionsRequired"));
      return;
    }
    if (form.is801 && !form.srcLoc) {
      toast.error(t("selectSourceFirst"));
      return;
    }
    setPickerOpen(true);
  }, [form.importedLinesLocked, form.is801, form.srcLoc, t]);

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
            <DocumentWarehouseSection
              units={documentUnits}
              warehouseId={warehouseId}
              destinationWarehouseId={destinationWarehouseId}
              showDestination={form.is801}
              fromMatcher={fromMatcher}
              onWarehouseChange={setWarehouseId}
              onDestinationChange={setDestinationWarehouseId}
            />
          )}
          {form.activeTab === "header" && (
            <MovementDocumentDataTab
              typeCode={form.typeCode}
              selType={form.selType}
              isEdit={isEdit}
              movementTypes={movementTypes}
              allowsSender={form.allowsSender}
              allowsRecipient={form.allowsRecipient}
              showSender={form.showSender}
              showRecipient={form.showRecipient}
              senderCanUnlock={form.senderCanUnlock}
              recipientCanUnlock={form.recipientCanUnlock}
              senderEntityTypes={form.partyContract.senderEntityTypes}
              recipientEntityTypes={form.partyContract.recipientEntityTypes}
              senderName={form.senderName}
              recipientName={form.recipientName}
              supplierFields={form.supplierFields}
              supplierLocked={form.supplierLocked}
              recipientFields={form.recipientFields}
              recipientLocked={form.recipientLocked}
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
              onRecipientDetailsChange={form.setRecipientDetails}
              onSupplierFieldsChange={form.setSupplierFields}
              onSupplierLockedChange={form.setSupplierLocked}
              onRecipientFieldsChange={form.setRecipientFields}
              onRecipientLockedChange={form.setRecipientLocked}
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
              lockedDestinationId={lockedDestinationId}
              stockableLocations={stockableLocations}
              lines={form.lines}
              pickerDisabled={pickerDisabled}
              importedLinesLocked={form.importedLinesLocked}
              manualCorrectionMode={form.manualCorrectionMode}
              onEnableManualCorrections={form.enableManualCorrections}
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
          currentMovementTypeCode={form.typeCode}
          variants={variants}
          units={units}
          stockableLocations={stockableLocations}
          currentDestinationLocationId={form.dstLoc}
          canManageProducts={canManageProducts}
          fieldPolicies={fieldPolicies}
          onApply={form.applyImportedDocument}
          autoStart={autoImport}
        />
      )}
      <UnitTransferPrompt
        open={transferPrompt}
        isPending={isPending}
        onSend={() => confirmTransfer(true)}
        onHold={() => confirmTransfer(false)}
        onCancel={cancelTransferPrompt}
      />
    </div>
  );
}
