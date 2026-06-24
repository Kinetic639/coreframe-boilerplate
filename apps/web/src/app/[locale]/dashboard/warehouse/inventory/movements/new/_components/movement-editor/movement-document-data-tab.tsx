"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryMovementType } from "@/lib/warehouse/inventory-types";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { MovementTypePicker } from "@/components/warehouse/movement-type-picker";
import { MovementSupplierSection } from "./movement-supplier-section";
import type { LocationOption } from "./types";

type Props = {
  typeCode: string;
  selType: InventoryMovementType | null;
  isPZ: boolean;
  is801: boolean;
  isEdit: boolean;
  movementTypes: InventoryMovementType[];
  stockableLocations: LocationOption[];
  counterpartyName: string;
  externalReference: string;
  noteRichText: RichTextValue | null;
  srcLoc: string;
  dstLoc: string;
  operationDate: string;
  documentDate: string;
  branchName: string;
  createdByName: string;
  onTypeChange: (code: string) => void;
  onCounterpartyChange: (val: string) => void;
  onExternalRefChange: (val: string) => void;
  onNoteRichTextChange: (val: RichTextValue) => void;
  onSrcLocChange: (val: string) => void;
  onDstLocChange: (val: string) => void;
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
  isPZ,
  is801,
  isEdit,
  movementTypes,
  stockableLocations,
  counterpartyName,
  externalReference,
  noteRichText,
  srcLoc,
  dstLoc,
  operationDate,
  documentDate,
  branchName,
  createdByName,
  onTypeChange,
  onCounterpartyChange,
  onExternalRefChange,
  onNoteRichTextChange,
  onSrcLocChange,
  onDstLocChange,
}: Props) {
  const locLabel = (loc: LocationOption) => (loc.code ? `${loc.code} — ${loc.name}` : loc.name);

  return (
    <div className="space-y-4">
      {/* Movement Type */}
      <section className="rounded-sm border bg-card p-4">
        <div className="flex items-center justify-between border-b pb-2 mb-3">
          <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
            <FileText className="h-4 w-4" />
            Movement Type
          </div>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            Type Selection
          </span>
        </div>
        <MovementTypePicker
          value={typeCode || null}
          onChange={onTypeChange}
          movementTypes={movementTypes}
          readonly={isEdit}
        />
        {selType && (
          <div
            className={cn(
              "mt-3 p-2.5 rounded-sm border text-xs font-mono",
              isPZ
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-0.5 font-semibold">
              WMS Effect
            </span>
            {selType.document_type_code} · {isPZ && "+ on_hand at destination"}
            {is801 && "- on_hand source, + on_hand destination"} · document number assigned after
            posting
          </div>
        )}
      </section>

      {/* Document Details */}
      {selType && (
        <section className="rounded-sm border bg-card p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground border-b pb-2 mb-3">
            Document Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <LBL label="Branch / Warehouse">
              <Input value={branchName} readOnly className="h-9 text-sm bg-muted/30" />
            </LBL>
            <LBL label="Created By">
              <Input value={createdByName || "—"} readOnly className="h-9 text-sm bg-muted/30" />
            </LBL>
            <LBL label="Operation Date">
              <Input
                type="date"
                value={operationDate}
                readOnly
                className="h-9 text-sm bg-muted/30 font-mono"
              />
            </LBL>
            <LBL label="Document Date">
              <Input
                value={documentDate}
                readOnly
                className="h-9 text-sm bg-muted/30 text-muted-foreground text-center font-mono"
              />
            </LBL>
            <LBL label="External Reference">
              <Input
                placeholder="PO-2026-0428..."
                value={externalReference}
                onChange={(e) => onExternalRefChange(e.target.value)}
                className="h-9 text-sm font-mono"
              />
            </LBL>
          </div>
        </section>
      )}

      {/* Supplier Section (PZ only) */}
      {selType && isPZ && (
        <MovementSupplierSection
          counterpartyName={counterpartyName}
          onCounterpartyChange={onCounterpartyChange}
        />
      )}

      {/* Warehouse Routing */}
      {selType && (
        <section className="rounded-sm border border-dashed bg-muted/30 p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
            Warehouse Routing
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {is801 ? (
              <LBL label="Source Location (From)" required>
                <select
                  value={srcLoc}
                  onChange={(e) => onSrcLocChange(e.target.value)}
                  className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select source bin...</option>
                  {stockableLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locLabel(l)}
                    </option>
                  ))}
                </select>
              </LBL>
            ) : (
              <div className="rounded-sm border border-dashed bg-muted/50 p-3 flex flex-col justify-center opacity-60">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  Source Location
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Not applicable for PZ receipt
                </span>
              </div>
            )}
            <LBL label="Destination Location (To)" required>
              <select
                value={dstLoc}
                onChange={(e) => onDstLocChange(e.target.value)}
                className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              >
                <option value="">Select destination bin...</option>
                {stockableLocations
                  .filter((l) => l.id !== srcLoc)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {locLabel(l)}
                    </option>
                  ))}
              </select>
            </LBL>
          </div>
        </section>
      )}

      {/* Note */}
      {selType && (
        <section className="rounded-sm border bg-card p-4">
          <RichTextEditorField
            value={noteRichText}
            onChange={onNoteRichTextChange}
            placeholder="Additional details, delivery notes, references..."
            mode="simple"
            maxLength={2000}
            contentClassName="min-h-[80px] [&_.ProseMirror]:min-h-[60px]"
            label="Movement Notes"
          />
        </section>
      )}
    </div>
  );
});
