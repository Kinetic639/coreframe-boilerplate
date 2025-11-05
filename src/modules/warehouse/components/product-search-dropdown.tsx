"use client";

// =============================================
// Product Search Dropdown Component
// Simple dropdown for searching and adding products
// =============================================

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
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

interface ProductSearchDropdownProps {
  organizationId: string;
  searchQuery: string;
  onAddProduct: (productId: string) => void;
  isOpen: boolean;
}

export function ProductSearchDropdown({
  organizationId,
  searchQuery,
  onAddProduct,
  isOpen,
}: ProductSearchDropdownProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all products once
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
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
        setFilteredProducts(data.slice(0, 20)); // Show first 20 initially
      }
      setLoading(false);
    };

    loadProducts();
  }, [organizationId]);

  // Filter products based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // No search query - show first 20 products
      setFilteredProducts(products.slice(0, 20));
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
    );

    setFilteredProducts(filtered.slice(0, 20)); // Limit to 20 results
  }, [searchQuery, products]);

  const getProductImage = (product: Product) => {
    if (!product?.product_images || product.product_images.length === 0) {
      return null;
    }
    const primaryImage = product.product_images.find((img) => img.is_primary);
    return primaryImage?.image_url || product.product_images[0]?.image_url;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute z-[100] w-full mt-1 bg-background border rounded-lg shadow-lg max-h-80 overflow-auto">
      {loading ? (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          Loading products...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">No products found</div>
      ) : (
        filteredProducts.map((product) => {
          const imageUrl = getProductImage(product);

          return (
            <div
              key={product.id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
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

              {/* Add Button */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddProduct(product.id);
                }}
                className="h-8 w-8 text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}
