"use client";

import * as React from "react";
import { ProductWithDetails } from "@/lib/mock/products-extended";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Warehouse, DollarSign, Tag, Eye } from "lucide-react";

interface ProductListProps {
  product: ProductWithDetails;
}

export function ProductList({ product }: ProductListProps) {
  const totalStock = product.variants.reduce((sum, variant) => {
    return sum + variant.stock_locations.reduce((s, sl) => s + sl.quantity, 0);
  }, 0);

  const firstVariant = product.variants[0];
  const displayPrice = firstVariant?.inventory_data?.purchase_price || 0;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <div className="flex-grow space-y-1">
        <h3 className="line-clamp-1 text-lg font-semibold">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {product.description || "Brak opisu"}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            SKU: {product.sku}
          </Badge>
          {product.barcode && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              EAN: {product.barcode}
            </Badge>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span className="font-medium text-foreground">{displayPrice.toFixed(2)} PLN</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" />
            <span className="font-medium text-foreground">{product.variants.length} wariantów</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Warehouse className="h-3 w-3" />
            <span className="font-medium text-foreground">
              {totalStock} {product.default_unit}
            </span>
          </span>
        </div>
      </div>
      <div className="ml-4 flex-shrink-0">
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          Szczegóły
        </Button>
      </div>
    </div>
  );
}
