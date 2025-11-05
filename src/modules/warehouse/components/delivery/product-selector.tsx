"use client";

import { useState, useMemo } from "react";
import { Search, ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductRow } from "./product-row";

interface Product {
  id: string;
  name: string;
  sku: string;
  product_images?: Array<{
    image_url: string;
    is_primary: boolean;
  }>;
}

interface ProductSelectorProps {
  products: Product[];
  onAddProduct: (productId: string) => void;
}

export function ProductSelector({ products, onAddProduct }: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  return (
    <div className="border rounded-lg bg-card">
      {/* Search Bar */}
      <div className="p-3 border-b flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search product by name, description and category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" className="gap-2 whitespace-nowrap">
          <ScanBarcode className="h-4 w-4" />
          Scan to add
        </Button>
      </div>

      {/* Product List */}
      <div className="max-h-80 overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No products found
          </div>
        ) : (
          filteredProducts.map((product) => (
            <ProductRow key={product.id} product={product} onAdd={onAddProduct} />
          ))
        )}
      </div>
    </div>
  );
}
