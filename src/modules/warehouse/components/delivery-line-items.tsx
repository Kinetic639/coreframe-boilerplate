"use client";

// =============================================
// Delivery Line Items Component
// Manages product lines in a delivery (Odoo-style)
// =============================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);

  const loadProducts = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("organization_id", organizationId)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  }, [organizationId]);

  // Load products
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load variants for selected product
  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct);
    }
  }, [selectedProduct]);

  const loadVariants = async (productId: string) => {
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

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const newItem: DeliveryItem = {
      product_id: selectedProduct,
      variant_id: selectedVariant || null,
      expected_quantity: quantity,
      unit_cost: unitCost > 0 ? unitCost : undefined,
      total_cost: unitCost > 0 ? unitCost * quantity : undefined,
    };

    onChange([...items, newItem]);

    // Reset form
    setSelectedProduct("");
    setSelectedVariant("");
    setQuantity(1);
    setUnitCost(0);
    setIsAddDialogOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    const newItems = [...items];
    newItems[index].expected_quantity = newQuantity;

    // Recalculate total cost
    if (newItems[index].unit_cost) {
      newItems[index].total_cost = newItems[index].unit_cost! * newQuantity;
    }

    onChange(newItems);
  };

  const handleUpdateUnitCost = (index: number, newCost: number) => {
    const newItems = [...items];
    newItems[index].unit_cost = newCost;
    newItems[index].total_cost = newCost * newItems[index].expected_quantity;
    onChange(newItems);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Products</h3>
      </div>

      {/* Items Table */}
      {items.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left text-sm font-medium px-4 py-2">Product</th>
                <th className="text-right text-sm font-medium px-4 py-2 w-32">Demand</th>
                <th className="text-right text-sm font-medium px-4 py-2 w-32">Unit Cost</th>
                <th className="text-right text-sm font-medium px-4 py-2 w-32">Total</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {getProductName(item.product_id, item.variant_id)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getProductSku(item.product_id, item.variant_id)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.expected_quantity}
                      onChange={(e) => handleUpdateQuantity(index, parseFloat(e.target.value) || 0)}
                      disabled={disabled || readOnly}
                      className="w-24 text-right ml-auto"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost || 0}
                      onChange={(e) => handleUpdateUnitCost(index, parseFloat(e.target.value) || 0)}
                      disabled={disabled || readOnly}
                      className="w-24 text-right ml-auto"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      {item.total_cost ? item.total_cost.toFixed(2) : "0.00"} PLN
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!disabled && !readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-sm">No products added yet</p>
        </div>
      )}

      {/* Add Product Button */}
      {!disabled && !readOnly && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="link" size="sm" className="px-0 text-primary">
              <Plus className="h-4 w-4 mr-1" />
              Add a Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <DialogDescription>
                Select a product and specify the quantity to add to this delivery.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Product</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variant Selection */}
              {selectedProduct &&
                variants[selectedProduct] &&
                variants[selectedProduct].length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Variant</label>
                    <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a variant (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {variants[selectedProduct].map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.name} ({variant.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Demand Quantity</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  placeholder="Enter quantity"
                />
              </div>

              {/* Unit Cost */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit Cost (PLN)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  placeholder="Enter unit cost"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={!selectedProduct || quantity <= 0}>
                Add Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
