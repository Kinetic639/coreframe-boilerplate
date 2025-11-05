"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";
import { ProductSelector } from "./delivery/product-selector";
import { DeliveryItemRow } from "./delivery/delivery-item-row";
import { useQuery } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  sku: string;
  product_images?: Array<{
    image_url: string;
    is_primary: boolean;
  }>;
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
  const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({});

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products", organizationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          sku,
          product_images(image_url, is_primary)
        `
        )
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });

  const loadVariants = async (productId: string) => {
    if (variants[productId]) return;

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

  const handleAddProduct = async (productId: string) => {
    await loadVariants(productId);

    const newItem: DeliveryItem = {
      product_id: productId,
      variant_id: null,
      expected_quantity: 1,
      unit_cost: 0,
      total_cost: 0,
    };

    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].expected_quantity = quantity;
    if (newItems[index].unit_cost) {
      newItems[index].total_cost = newItems[index].unit_cost! * quantity;
    }
    onChange(newItems);
  };

  const handleUpdateCost = (index: number, cost: number) => {
    const newItems = [...items];
    newItems[index].unit_cost = cost;
    newItems[index].total_cost = cost * newItems[index].expected_quantity;
    onChange(newItems);
  };

  const getProductName = (productId: string, variantId?: string | null) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return "Unknown Product";

    if (variantId && variants[productId]) {
      const variant = variants[productId].find((v) => v.id === variantId);
      if (variant) return `${product.name} - ${variant.name}`;
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

      {/* Delivery Items Table */}
      {items.length > 0 && (
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
                <DeliveryItemRow
                  key={index}
                  item={item}
                  productName={getProductName(item.product_id, item.variant_id)}
                  productSku={getProductSku(item.product_id, item.variant_id)}
                  onUpdateQuantity={(q) => handleUpdateQuantity(index, q)}
                  onUpdateCost={(c) => handleUpdateCost(index, c)}
                  onRemove={() => handleRemoveItem(index)}
                  disabled={disabled || readOnly}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Selector - Always at bottom */}
      {!disabled && !readOnly && (
        <ProductSelector products={products} onAddProduct={handleAddProduct} />
      )}
    </div>
  );
}
