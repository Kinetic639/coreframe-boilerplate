"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InventoryPickerItem } from "@/lib/warehouse/inventory-types";
import { searchPickerItemsAction } from "@/app/actions/warehouse/inventory";

export type InventoryItemPickerMode = "allItems" | "stockInLocation";
export type PickedMovementItem = {
  variant_id: string;
  sku: string;
  product_name: string;
  brand_name: string | null;
  barcode: string | null;
  unit_id: string;
  unit_code: string;
  quantity: number;
  available_quantity: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InventoryItemPickerMode;
  sourceLocationId?: string | null;
  onAddItems: (items: PickedMovementItem[]) => void;
};

const hCls = "h-7 px-2 text-[10px] font-semibold uppercase tracking-wide bg-muted/60";
const cCls = "px-2 py-1.5 text-xs";

function SectionBar({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-muted border-b">
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        {children}
      </span>
    </div>
  );
}

export function InventoryItemPickerDialog({
  open,
  onOpenChange,
  mode,
  sourceLocationId,
  onAddItems,
}: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<InventoryPickerItem[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, PickedMovementItem>>(new Map());
  const [rowQty, setRowQty] = useState<Map<string, string>>(new Map());
  const isStockMode = mode === "stockInLocation";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const fetchItems = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const r = (await searchPickerItemsAction({
        query: debouncedQuery || undefined,
        source_location_id: isStockMode ? sourceLocationId : null,
        limit: 50,
      })) as any;
      if (r.success) setItems(r.data ?? []);
      else {
        setError(r.error ?? "Failed");
        setItems([]);
      }
    });
  }, [debouncedQuery, isStockMode, sourceLocationId]);
  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setItems([]);
      setError(null);
      setSelected(new Map());
      setRowQty(new Map());
    }
  }, [open]);

  function getRowQty(vid: string) {
    const v = rowQty.get(vid);
    return v ? Math.max(0, Number(v)) : 1;
  }
  function remaining(item: InventoryPickerItem): number | null {
    if (!isStockMode || item.source_location_on_hand === null) return null;
    return item.source_location_on_hand - (selected.get(item.variant_id)?.quantity ?? 0);
  }
  function addToSelected(item: InventoryPickerItem) {
    const qty = getRowQty(item.variant_id);
    if (qty <= 0) return;
    const avail = item.source_location_on_hand;
    if (
      isStockMode &&
      avail !== null &&
      (selected.get(item.variant_id)?.quantity ?? 0) + qty > avail
    )
      return;
    setSelected((prev) => {
      const next = new Map(prev);
      const ex = next.get(item.variant_id);
      if (ex) next.set(item.variant_id, { ...ex, quantity: ex.quantity + qty });
      else
        next.set(item.variant_id, {
          variant_id: item.variant_id,
          sku: item.sku,
          product_name: item.product_name,
          brand_name: item.brand_name,
          barcode: item.barcode,
          unit_id: item.unit_id,
          unit_code: item.unit_code,
          quantity: qty,
          available_quantity: avail,
        });
      return next;
    });
    setRowQty((p) => {
      const n = new Map(p);
      n.delete(item.variant_id);
      return n;
    });
  }
  function updateSelectedQty(vid: string, qty: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(vid);
      if (!item) return prev;
      if (qty <= 0) {
        next.delete(vid);
        return next;
      }
      const max = isStockMode && item.available_quantity !== null ? item.available_quantity : null;
      next.set(vid, { ...item, quantity: max !== null && qty > max ? max : qty });
      return next;
    });
  }
  function removeSelected(vid: string) {
    setSelected((p) => {
      const n = new Map(p);
      n.delete(vid);
      return n;
    });
  }

  const selectedCount = selected.size;
  const selectedTotalQty = [...selected.values()].reduce((s, i) => s + i.quantity, 0);
  const visibleItems = items.filter((i) => !selected.has(i.variant_id));

  const stockColLabel = isStockMode ? "Avail." : "Stock";
  const selStockColLabel = isStockMode ? "Max" : "Stock";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl [&>button[class*='absolute']]:top-2 [&>button[class*='absolute']]:right-2 [&>button[class*='absolute']]:h-6 [&>button[class*='absolute']]:w-6">
        {/* Header */}
        <div className="shrink-0 border-b px-3 py-2 flex flex-row items-center gap-3">
          <DialogTitle className="text-sm shrink-0">
            {isStockMode ? "Source Stock" : "Select Items"}
          </DialogTitle>
          <div className="flex-1" />
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search SKU, product, barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
          <div className="flex-1" />
        </div>

        {/* Sections */}
        <div
          className="flex-1 min-h-0 grid"
          style={{ gridTemplateRows: selectedCount > 0 ? "1fr 1fr" : "1fr" }}
        >
          {/* ── Available ── */}
          <div className="min-h-0 border-t-2 border-primary flex flex-col">
            <SectionBar icon={<Search className="h-3.5 w-3.5 text-primary" />}>
              Available Items ({isLoading ? "..." : visibleItems.length})
            </SectionBar>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-xs text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchItems}
                  className="mt-2 h-7 text-xs"
                >
                  Retry
                </Button>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Package className="mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  {items.length > 0
                    ? "All items already selected."
                    : debouncedQuery
                      ? "No items match."
                      : isStockMode
                        ? "No stock in source location."
                        : "No items found."}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table noWrapper>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className={`${hCls} text-center w-9`}>No.</TableHead>
                      <TableHead className={`${hCls} text-left w-[130px]`}>SKU</TableHead>
                      <TableHead className={`${hCls} text-left`}>Product</TableHead>
                      <TableHead className={`${hCls} text-center w-20`}>Brand</TableHead>
                      <TableHead className={`${hCls} text-center w-12`}>Unit</TableHead>
                      <TableHead className={`${hCls} text-center w-12`}>{stockColLabel}</TableHead>
                      <TableHead className={`${hCls} text-center w-16`}>Qty</TableHead>
                      <TableHead className={`${hCls} text-center w-10`}>Add</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item, idx) => {
                      const rem = remaining(item);
                      const rq = getRowQty(item.variant_id);
                      const canAdd = rem === null || (rem > 0 && rq <= rem);
                      return (
                        <TableRow key={item.variant_id}>
                          <TableCell className={`${cCls} text-center text-muted-foreground w-9`}>
                            {idx + 1}
                          </TableCell>
                          <TableCell className={`${cCls} w-[130px]`}>
                            <span className="font-mono font-medium">{item.sku}</span>
                            {item.barcode && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {item.barcode}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={cCls}>{item.product_name}</TableCell>
                          <TableCell className={`${cCls} text-center text-muted-foreground w-20`}>
                            {item.brand_name ?? item.manufacturer_name ?? "—"}
                          </TableCell>
                          <TableCell className={`${cCls} text-center w-12`}>
                            <Badge variant="outline" className="text-[9px]">
                              {item.unit_code}
                            </Badge>
                          </TableCell>
                          <TableCell className={`${cCls} text-center font-mono w-12`}>
                            {isStockMode && item.source_location_on_hand !== null ? (
                              <span className="text-emerald-600">
                                {rem ?? item.source_location_on_hand}
                              </span>
                            ) : item.total_on_hand != null && item.total_on_hand > 0 ? (
                              <span className="text-muted-foreground">{item.total_on_hand}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`${cCls} text-center w-16`}>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              max={rem !== null ? Math.max(0, rem) : undefined}
                              value={rowQty.get(item.variant_id) ?? "1"}
                              onChange={(e) =>
                                setRowQty((p) => new Map(p).set(item.variant_id, e.target.value))
                              }
                              className="h-6 w-14 text-center text-xs mx-auto"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className={`${cCls} text-center w-10`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={!canAdd || rq <= 0}
                              onClick={() => addToSelected(item)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Selected ── */}
          {selectedCount > 0 && (
            <div className="min-h-0 border-t-2 border-primary flex flex-col">
              <SectionBar icon={<Package className="h-3.5 w-3.5 text-primary" />}>
                Selected Items ({selectedCount} items, {selectedTotalQty} qty)
              </SectionBar>
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table noWrapper>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className={`${hCls} text-center w-9`}>No.</TableHead>
                      <TableHead className={`${hCls} text-left w-[130px]`}>SKU</TableHead>
                      <TableHead className={`${hCls} text-left`}>Product</TableHead>
                      <TableHead className={`${hCls} text-center w-20`}>Brand</TableHead>
                      <TableHead className={`${hCls} text-center w-12`}>Unit</TableHead>
                      <TableHead className={`${hCls} text-center w-12`}>
                        {selStockColLabel}
                      </TableHead>
                      <TableHead className={`${hCls} text-center w-16`}>Qty</TableHead>
                      <TableHead className={`${hCls} text-center w-10`}>Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...selected.values()].map((item, idx) => (
                      <TableRow key={item.variant_id}>
                        <TableCell className={`${cCls} text-center text-muted-foreground w-9`}>
                          {idx + 1}
                        </TableCell>
                        <TableCell className={`${cCls} w-[130px]`}>
                          <span className="font-mono font-medium">{item.sku}</span>
                        </TableCell>
                        <TableCell className={cCls}>{item.product_name}</TableCell>
                        <TableCell className={`${cCls} text-center text-muted-foreground w-20`}>
                          {item.brand_name ?? "—"}
                        </TableCell>
                        <TableCell className={`${cCls} text-center w-12`}>
                          <Badge variant="outline" className="text-[9px]">
                            {item.unit_code}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`${cCls} text-center font-mono text-muted-foreground w-12`}
                        >
                          {item.available_quantity ?? "—"}
                        </TableCell>
                        <TableCell className={`${cCls} text-center w-16`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => updateSelectedQty(item.variant_id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              max={
                                isStockMode && item.available_quantity !== null
                                  ? item.available_quantity
                                  : undefined
                              }
                              value={item.quantity}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v > 0) updateSelectedQty(item.variant_id, v);
                              }}
                              className="h-5 w-12 text-center text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              disabled={
                                isStockMode &&
                                item.available_quantity !== null &&
                                item.quantity >= item.available_quantity
                              }
                              onClick={() => updateSelectedQty(item.variant_id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className={`${cCls} text-center w-10`}>
                          <button
                            type="button"
                            onClick={() => removeSelected(item.variant_id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {items.length > 0 && `${items.length} results`}
            {items.length >= 50 && " — refine search for more"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={selectedCount === 0}
              onClick={() => {
                onAddItems([...selected.values()]);
                onOpenChange(false);
              }}
            >
              Add Items ({selectedCount})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
