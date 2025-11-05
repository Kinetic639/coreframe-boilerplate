"use client";

// =============================================
// Delivery Line Items Component
// Manages product lines in a delivery (Inflow-style)
// =============================================

import { useState, useEffect, useCallback, useRef } from "react";
import { ScanBarcode, Search, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";
import { toast } from "react-toastify";
import Image from "next/image";

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

interface ExtendedDeliveryItem extends DeliveryItem {
  _product?: Product;
  _variant?: ProductVariant;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [extendedItems, setExtendedItems] = useState<ExtendedDeliveryItem[]>([]);

  // Load products with images
  const loadProducts = useCallback(async () => {
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

    if (!error && data) {
      setProducts(data);
    }
  }, [organizationId]);

  // Load products
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load variants for a product
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

  // Extend items with product data
  useEffect(() => {
    const extended = items.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      const variant =
        item.variant_id && variants[item.product_id]
          ? variants[item.product_id].find((v) => v.id === item.variant_id)
          : undefined;

      return {
        ...item,
        _product: product,
        _variant: variant,
      };
    });

    setExtendedItems(extended);
  }, [items, products, variants]);

  // Filter products based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts([]);
      setIsSearchOpen(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
    );

    setFilteredProducts(filtered.slice(0, 10)); // Limit to 10 results

    // Open dropdown if we have results
    if (filtered.length > 0) {
      setIsSearchOpen(true);
    }
  }, [searchQuery, products]);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleAddProduct = async (product: Product) => {
    // Load variants if needed
    await loadVariants(product.id);

    const newItem: DeliveryItem = {
      product_id: product.id,
      variant_id: null,
      expected_quantity: 1,
      unit_cost: 0,
      total_cost: 0,
    };

    onChange([...items, newItem]);
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleUpdateQuantity = (index: number, value: string) => {
    const quantity = parseFloat(value) || 0;
    const newItems = [...items];
    newItems[index].expected_quantity = quantity;

    // Recalculate total
    if (newItems[index].unit_cost) {
      newItems[index].total_cost = newItems[index].unit_cost! * quantity;
    }

    onChange(newItems);
  };

  const handleUpdateUnitCost = (index: number, value: string) => {
    const cost = parseFloat(value) || 0;
    const newItems = [...items];
    newItems[index].unit_cost = cost;
    newItems[index].total_cost = cost * newItems[index].expected_quantity;
    onChange(newItems);
  };

  const handleScanBarcode = () => {
    toast.info("Barcode scanning feature coming soon!");
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  };

  const getProductImage = (product?: Product) => {
    if (!product?.product_images || product.product_images.length === 0) {
      return null;
    }
    const primaryImage = product.product_images.find((img) => img.is_primary);
    return primaryImage?.image_url || product.product_images[0]?.image_url;
  };

  return (
    <div className="space-y-4">
      {/* Product Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Product
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-32">
                Vendor code
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-32">
                Quantity
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-32">
                Vendor price
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-32">
                Subtotal
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {extendedItems.map((item, index) => {
              const imageUrl = getProductImage(item._product);

              return (
                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Product Image */}
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item._product?.name || "Product"}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      {/* Product Info */}
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item._product?.name || "Unknown Product"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item._product?.sku || "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {item._variant?.sku || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.expected_quantity || ""}
                      onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                      disabled={disabled || readOnly}
                      className="w-24 text-right ml-auto h-8 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_cost || ""}
                        onChange={(e) => handleUpdateUnitCost(index, e.target.value)}
                        disabled={disabled || readOnly}
                        className="w-24 text-right h-8 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      ${(item.total_cost || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!disabled && !readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Empty State */}
            {extendedItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No products added yet</p>
                  <p className="text-xs mt-1">
                    Search for products below or scan a barcode to add items
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Subtotal Section */}
        {extendedItems.length > 0 && (
          <div className="border-t bg-muted/10 px-4 py-3">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Section */}
      {!disabled && !readOnly && (
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search product by name, description and category"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => {
                  if (searchQuery.trim() && filteredProducts.length > 0) {
                    setIsSearchOpen(true);
                  }
                }}
                className="pl-9 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearchOpen && searchQuery && filteredProducts.length > 0 && (
              <div className="absolute z-[100] w-full mt-1 bg-background border rounded-lg shadow-lg max-h-80 overflow-auto">
                {filteredProducts.map((product) => {
                  const imageUrl = getProductImage(product);
                  const stockCount = items.filter((item) => item.product_id === product.id).length;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddProduct(product);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
                    >
                      {/* Product Image */}
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.sku}</div>
                      </div>
                      {/* Stock Indicator */}
                      {stockCount > 0 && (
                        <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                          <span className="w-5 h-5 flex items-center justify-center bg-primary text-primary-foreground rounded-full text-[10px]">
                            {stockCount}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scan Button */}
          <Button variant="outline" onClick={handleScanBarcode} className="gap-2 whitespace-nowrap">
            <ScanBarcode className="h-4 w-4" />
            Scan to add
          </Button>
        </div>
      )}

      {/* Click outside to close search */}
      {isSearchOpen && searchQuery && filteredProducts.length > 0 && (
        <div
          className="fixed inset-0 z-[90]"
          onClick={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
          }}
        />
      )}
    </div>
  );
}
