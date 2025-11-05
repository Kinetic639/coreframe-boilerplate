"use client";

// =============================================
// Delivery Line Items Component
// Manages product lines in a delivery (inline row-based editing)
// =============================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Product {
  id: string;
  name: string;
  sku: string;
  unit?: string;
  cost_price?: number;
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
}

// Extended DeliveryItem for internal state with temporary row tracking
interface DeliveryItemRow extends DeliveryItem {
  _isNew?: boolean;
  _rowId?: string;
}

interface DeliveryLineItemsProps {
  items: DeliveryItem[];
  onChange: (items: DeliveryItem[]) => void;
  organizationId: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export function DeliveryLineItems({
  items,
  onChange,
  organizationId,
  disabled,
  readOnly = false,
}: DeliveryLineItemsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({});
  const [internalItems, setInternalItems] = useState<DeliveryItemRow[]>([]);
  const [openProductSelectors, setOpenProductSelectors] = useState<Record<string, boolean>>({});

  const loadProducts = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, unit, cost_price")
      .eq("organization_id", organizationId)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  }, [organizationId]);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Sync external items to internal state
  useEffect(() => {
    setInternalItems(
      items.map((item, index) => ({
        ...item,
        _rowId: item.id || `row-${index}`,
        _isNew: false,
      }))
    );
  }, [items]);

  const loadVariants = async (productId: string) => {
    if (variants[productId]) return; // Already loaded

    const supabase = createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, product_id, name, sku")
      .eq("product_id", productId)
      .order("name");

    if (!error && data) {
      setVariants((prev) => ({
        ...prev,
        [productId]: data,
      }));
    }
  };

  const handleAddRow = () => {
    const newRowId = `new-${Date.now()}`;
    const newRow: DeliveryItemRow = {
      product_id: "",
      variant_id: null,
      expected_quantity: 1,
      unit_cost: 0,
      total_cost: 0,
      _isNew: true,
      _rowId: newRowId,
    };

    const updatedItems = [...internalItems, newRow];
    setInternalItems(updatedItems);
  };

  const handleProductSelect = (rowId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Load variants for this product
    loadVariants(productId);

    // Use product's cost_price as the default unit_cost
    const defaultUnitCost = product.cost_price || 0;
    const defaultQuantity = 1;

    const updatedItems = internalItems.map((item) => {
      if (item._rowId === rowId) {
        return {
          ...item,
          product_id: productId,
          variant_id: null,
          expected_quantity: defaultQuantity,
          unit_cost: defaultUnitCost,
          total_cost: defaultUnitCost * defaultQuantity,
          _isNew: false,
        };
      }
      return item;
    });

    setInternalItems(updatedItems);
    syncToParent(updatedItems);

    // Close the popover
    setOpenProductSelectors((prev) => ({ ...prev, [rowId]: false }));
  };

  const handleRemoveRow = (rowId: string) => {
    const updatedItems = internalItems.filter((item) => item._rowId !== rowId);
    setInternalItems(updatedItems);
    syncToParent(updatedItems);
  };

  const handleUpdateQuantity = (rowId: string, newQuantity: number) => {
    const updatedItems = internalItems.map((item) => {
      if (item._rowId === rowId) {
        const total = (item.unit_cost || 0) * newQuantity;
        return {
          ...item,
          expected_quantity: newQuantity,
          total_cost: total,
        };
      }
      return item;
    });

    setInternalItems(updatedItems);
    syncToParent(updatedItems);
  };

  const handleUpdateUnitCost = (rowId: string, newCost: number) => {
    const updatedItems = internalItems.map((item) => {
      if (item._rowId === rowId) {
        const total = newCost * item.expected_quantity;
        return {
          ...item,
          unit_cost: newCost,
          total_cost: total,
        };
      }
      return item;
    });

    setInternalItems(updatedItems);
    syncToParent(updatedItems);
  };

  const syncToParent = (updatedItems: DeliveryItemRow[]) => {
    // Filter out empty rows and remove temporary fields
    const cleanedItems: DeliveryItem[] = updatedItems
      .filter((item) => item.product_id !== "")
      .map(({ _isNew, _rowId, ...item }) => item);

    onChange(cleanedItems);
  };

  const getProductName = (productId: string, variantId?: string | null) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return "Unknown Product";

    if (variantId && variants[productId]) {
      const variant = variants[productId].find((v) => v.id === variantId);
      if (variant) {
        return `${product.name} - ${variant.name}`;
      }
    }

    return product.name;
  };

  const getProductSku = (productId: string, variantId?: string | null) => {
    if (variantId && variants[productId]) {
      const variant = variants[productId].find((v) => v.id === variantId);
      if (variant) return variant.sku;
    }

    const product = products.find((p) => p.id === productId);
    return product?.sku || "";
  };

  const getProductUnit = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.unit || "pcs";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Products</h3>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left text-sm font-medium px-4 py-2">Product</th>
              <th className="text-center text-sm font-medium px-4 py-2 w-32">Quantity</th>
              <th className="text-center text-sm font-medium px-4 py-2 w-24">Unit</th>
              <th className="text-center text-sm font-medium px-4 py-2 w-32">Purchase Price</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {internalItems.map((item) => {
              const rowId = item._rowId!;
              const isEmptyRow = !item.product_id;

              return (
                <tr
                  key={rowId}
                  className={`border-b last:border-b-0 ${isEmptyRow ? "bg-blue-50/30" : "hover:bg-muted/30"}`}
                >
                  {/* Product Selector */}
                  <td className="px-4 py-3">
                    {isEmptyRow ? (
                      <Popover
                        open={openProductSelectors[rowId] || false}
                        onOpenChange={(open) =>
                          setOpenProductSelectors((prev) => ({ ...prev, [rowId]: open }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            disabled={disabled || readOnly}
                          >
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <span className="text-muted-foreground">Select a product...</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.sku}`}
                                    onSelect={() => handleProductSelect(rowId, product.id)}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{product.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {product.sku}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {getProductName(item.product_id, item.variant_id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getProductSku(item.product_id, item.variant_id)}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.expected_quantity}
                      onChange={(e) => handleUpdateQuantity(rowId, parseFloat(e.target.value) || 0)}
                      disabled={disabled || readOnly || isEmptyRow}
                      className="w-full text-center"
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-muted-foreground">
                      {isEmptyRow ? "-" : getProductUnit(item.product_id)}
                    </span>
                  </td>

                  {/* Purchase Price */}
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost || 0}
                      onChange={(e) => handleUpdateUnitCost(rowId, parseFloat(e.target.value) || 0)}
                      disabled={disabled || readOnly || isEmptyRow}
                      className="w-full text-center"
                    />
                  </td>

                  {/* Delete Button */}
                  <td className="px-4 py-3">
                    {!disabled && !readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRow(rowId)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      {!disabled && !readOnly && (
        <Button variant="outline" size="sm" onClick={handleAddRow} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
      )}
    </div>
  );
}
