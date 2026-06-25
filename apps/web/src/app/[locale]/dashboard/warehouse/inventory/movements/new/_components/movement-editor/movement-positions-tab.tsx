"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Inbox, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryMovementType } from "@/lib/warehouse/inventory-types";
import type { LineDraft, LocationOption } from "./types";

type Props = {
  selType: InventoryMovementType | null;
  isPZ: boolean;
  is801: boolean;
  srcLoc: string;
  dstLoc: string;
  stockableLocations: LocationOption[];
  lines: LineDraft[];
  pickerDisabled: boolean;
  onOpenPicker: () => void;
  onRemoveLine: (key: string) => void;
  onUpdateLineQty: (key: string, val: string) => void;
  onSrcLocChange: (val: string) => void;
  onDstLocChange: (val: string) => void;
};

const MovementLineRow = React.memo(function MovementLineRow({
  line,
  idx,
  is801,
  onUpdateQty,
  onRemove,
}: {
  line: LineDraft;
  idx: number;
  is801: boolean;
  onUpdateQty: (key: string, val: string) => void;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const q = Number(line.quantity) || 0;
  const overLimit = is801 && line.on_hand_at_source !== null && q > line.on_hand_at_source;
  const hasError = q <= 0 || overLimit;
  return (
    <tr className={cn("group hover:bg-muted/30 transition-colors", hasError && "bg-destructive/5")}>
      <td className="py-2 px-3 text-center text-muted-foreground font-mono text-xs">{idx + 1}</td>
      <td className="py-2 px-3 font-mono font-bold text-foreground">{line.sku}</td>
      <td className="py-2 px-3">
        <div className="font-medium text-foreground truncate max-w-[220px]">
          {line.product_name}
        </div>
        {line.brand_name && (
          <span className="text-xs text-muted-foreground">{line.brand_name}</span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        <Badge variant="outline" className="text-[10px] rounded-sm font-mono">
          {line.unit_code}
        </Badge>
      </td>
      {is801 && (
        <td className="py-2 px-3 text-center font-mono text-muted-foreground">
          {line.on_hand_at_source ?? "—"}
        </td>
      )}
      <td className="py-2 px-3">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateQty(line.key, String(q - 1))}
            className="h-6 w-6 rounded-sm border bg-card hover:bg-muted flex items-center justify-center text-xs font-bold transition"
          >
            −
          </button>
          <Input
            type="number"
            min="1"
            max={line.on_hand_at_source ?? undefined}
            value={line.quantity}
            onChange={(e) => onUpdateQty(line.key, e.target.value)}
            className={cn(
              "h-7 w-16 text-center text-sm font-mono font-bold rounded-sm",
              hasError && "border-destructive"
            )}
          />
          <button
            type="button"
            onClick={() => onUpdateQty(line.key, String(q + 1))}
            className="h-6 w-6 rounded-sm border bg-card hover:bg-muted flex items-center justify-center text-xs font-bold transition"
          >
            +
          </button>
        </div>
        {overLimit && (
          <span className="text-xs text-destructive font-semibold block text-center mt-0.5">
            {t("exceedsAvailable")}
          </span>
        )}
        {q <= 0 && (
          <span className="text-xs text-destructive font-semibold block text-center mt-0.5">
            {t("qtyMustBePositive")}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        <button
          onClick={() => onRemove(line.key)}
          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});

export const MovementPositionsTab = React.memo(function MovementPositionsTab({
  selType,
  isPZ,
  is801,
  srcLoc,
  dstLoc,
  stockableLocations,
  lines,
  pickerDisabled,
  onOpenPicker,
  onRemoveLine,
  onUpdateLineQty,
  onSrcLocChange,
  onDstLocChange,
}: Props) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const locLabel = (loc: LocationOption) => (loc.code ? `${loc.code} — ${loc.name}` : loc.name);

  return (
    <div className="space-y-4">
      {/* Warehouse Routing */}
      <section className="rounded-sm border border-dashed bg-muted/30 p-4">
        <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
          {t("warehouseRouting")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {is801 ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t("sourceLocation")} <span className="text-destructive ml-0.5">*</span>
              </label>
              <select
                value={srcLoc}
                onChange={(e) => onSrcLocChange(e.target.value)}
                className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("selectSourceBin")}</option>
                {stockableLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locLabel(l)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-sm border border-dashed bg-muted/50 p-3 flex flex-col justify-center opacity-60">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                {t("sourceNotApplicable")}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {t("sourceNotApplicableDesc")}
              </span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {t("destinationLocation")} <span className="text-destructive ml-0.5">*</span>
            </label>
            <select
              value={dstLoc}
              onChange={(e) => onDstLocChange(e.target.value)}
              className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("selectDestBin")}</option>
              {stockableLocations
                .filter((l) => l.id !== srcLoc)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {locLabel(l)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </section>

      {/* Positions Table */}
      <section className="rounded-sm border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs uppercase tracking-wider font-bold text-foreground">
              B. {t("positionsTab")}
            </h2>
            <Badge variant="secondary" className="text-[10px] rounded-sm">
              {lines.length}
            </Badge>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={pickerDisabled || !selType}
            onClick={onOpenPicker}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addItems")}
          </Button>
        </div>

        {is801 && !srcLoc && (
          <div className="mx-4 mt-3 p-2.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-[10px] uppercase">
                {t("itemPickerDisabled")}
              </span>
              {t("itemPickerDisabledDesc")}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="w-10 h-10 rounded-sm border bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("noPositionsAdded")}
              </h3>
              <p className="text-muted-foreground text-xs max-w-xs mt-1 mb-4">
                {t("noPositionsAddedDesc")}
              </p>
              {!pickerDisabled && selType && (
                <Button variant="default" size="sm" className="gap-1.5" onClick={onOpenPicker}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("addFirstItem")}
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b text-[10px] uppercase font-semibold text-muted-foreground select-none bg-muted/30">
                  <th className="py-2.5 px-3 text-center w-10">{t("colNumber")}</th>
                  <th className="py-2.5 px-3 w-32 font-mono">{t("colSku")}</th>
                  <th className="py-2.5 px-3">{t("colProductBrand")}</th>
                  <th className="py-2.5 px-3 text-center w-16">{t("colUnit")}</th>
                  {is801 && <th className="py-2.5 px-3 text-center w-20">{t("colAvail")}</th>}
                  <th className="py-2.5 px-3 text-center w-28">{t("colQuantity")}</th>
                  <th className="py-2.5 px-3 text-center w-12" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line, idx) => (
                  <MovementLineRow
                    key={line.key}
                    line={line}
                    idx={idx}
                    is801={is801}
                    onUpdateQty={onUpdateLineQty}
                    onRemove={onRemoveLine}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {lines.length > 0 && !pickerDisabled && selType && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-sm text-muted-foreground gap-1.5"
              onClick={onOpenPicker}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addMoreItems")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
});
