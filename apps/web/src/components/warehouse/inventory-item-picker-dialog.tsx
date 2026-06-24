"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { Database, Loader2, Package, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    return v ? Math.max(0, Number(v)) : 0;
  }

  function addToSelected(item: InventoryPickerItem) {
    const qty = getRowQty(item.variant_id) || 1;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl [&>button[class*='absolute']]:top-3 [&>button[class*='absolute']]:right-3 [&>button[class*='absolute']]:h-7 [&>button[class*='absolute']]:w-7">
        {/* Header */}
        <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between">
          <div>
            <DialogTitle className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <Database className="h-4 w-4" />
              WMS Item Picker
            </DialogTitle>
            {isStockMode && sourceLocationId && (
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">
                Filtered by source location stock
              </span>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="shrink-0 p-3 border-b bg-muted/30 space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Search by SKU, product name, brand, barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-10 text-sm font-mono"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout: items left, cart right */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 bg-muted/20">
          {/* Left: Search Results as Cards */}
          <div className="md:col-span-7 overflow-y-auto p-3 border-r max-h-[380px] md:max-h-full bg-card">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 select-none">
              Search Results ({isLoading ? "..." : visibleItems.length} items)
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
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
              <div className="py-12 text-center text-muted-foreground text-xs italic">
                {items.length > 0
                  ? "All available items already selected."
                  : debouncedQuery
                    ? "No items match your search."
                    : isStockMode
                      ? "No stock in this source location."
                      : "No items found."}
                {isStockMode && items.length === 0 && (
                  <span className="block mt-1.5 text-amber-600 dark:text-amber-400 text-[10px]">
                    Bin-to-bin movements only show items with stock at the source location.
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleItems.map((item) => {
                  const avail = isStockMode ? item.source_location_on_hand : item.total_on_hand;
                  const qtyInCart = getRowQty(item.variant_id);
                  const isInCart = qtyInCart > 0;

                  return (
                    <div
                      key={item.variant_id}
                      className={cn(
                        "p-2.5 rounded-sm border transition flex items-center justify-between gap-3",
                        isInCart
                          ? "bg-primary/5 border-primary border-l-4 border-l-emerald-500"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-foreground select-all">
                            {item.sku}
                          </span>
                          {item.brand_name && (
                            <Badge className="text-[10px] font-bold uppercase bg-primary text-primary-foreground rounded-sm px-1.5 py-0">
                              {item.brand_name}
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-xs text-foreground font-semibold mt-1 truncate">
                          {item.product_name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1 block font-semibold">
                          Available:{" "}
                          <strong className="text-foreground bg-muted border px-1 rounded-sm">
                            {avail ?? 0} {item.unit_code}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          min="1"
                          max={
                            isStockMode && item.source_location_on_hand !== null
                              ? item.source_location_on_hand
                              : undefined
                          }
                          placeholder="Qty"
                          className={cn(
                            "h-8 w-14 text-center text-sm font-mono font-bold rounded-sm",
                            isInCart ? "border-primary" : "border-input"
                          )}
                          value={rowQty.get(item.variant_id) ?? ""}
                          onChange={(e) =>
                            setRowQty((p) => new Map(p).set(item.variant_id, e.target.value))
                          }
                        />
                        <Button
                          size="sm"
                          className={cn(
                            "h-8 text-xs uppercase font-bold rounded-sm px-3",
                            isInCart ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                          )}
                          onClick={() => addToSelected(item)}
                        >
                          {isInCart ? "OK" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected Cart */}
          <div className="md:col-span-5 bg-card overflow-y-auto p-3 flex flex-col justify-between max-h-[300px] md:max-h-full">
            <div>
              <div className="flex justify-between items-center pb-2 border-b mb-2.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Selected ({selectedCount})
                </span>
                {selectedCount > 0 && (
                  <button
                    onClick={() => setSelected(new Map())}
                    className="text-[10px] text-destructive font-bold uppercase hover:underline font-mono"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {selectedCount === 0 ? (
                <div className="py-14 text-center text-muted-foreground text-xs italic px-2">
                  Select items from the list on the left by entering quantity and clicking Add.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[290px] overflow-y-auto">
                  {[...selected.values()].map((item) => (
                    <div
                      key={item.variant_id}
                      className="flex items-center justify-between gap-2 p-2 rounded-sm border bg-muted/30 text-xs"
                    >
                      <div className="truncate flex-1">
                        <span className="font-mono font-bold text-foreground block leading-tight">
                          {item.sku}
                        </span>
                        <span className="text-muted-foreground text-[10px] block truncate">
                          {item.product_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="font-mono font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 rounded-sm">
                          {item.quantity} {item.unit_code}
                        </Badge>
                        <button
                          onClick={() => removeSelected(item.variant_id)}
                          className="text-muted-foreground hover:text-destructive p-0.5 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart footer */}
            <div className="border-t pt-3 mt-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Total items:</span>
                <strong className="text-foreground text-sm font-mono font-bold">
                  {selectedTotalQty} qty
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs uppercase font-bold"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs uppercase font-bold"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    onAddItems([...selected.values()]);
                    onOpenChange(false);
                  }}
                >
                  Confirm ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
