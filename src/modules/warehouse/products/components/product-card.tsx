"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductWithDetails } from "@/lib/mock/products-extended";
import { Badge } from "@/components/ui/badge";
import { Package, Warehouse, DollarSign, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
  product: ProductWithDetails;
}

export function ProductCard({ product }: ProductCardProps) {
  const totalStock = product.variants.reduce((sum, variant) => {
    return sum + variant.stock_locations.reduce((s, sl) => s + sl.quantity, 0);
  }, 0);

  const firstVariant = product.variants[0];
  const displayPrice = firstVariant?.inventory_data?.purchase_price || 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1 text-lg">{product.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {product.description || "Brak opisu"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-2 flex items-center gap-2">
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
        </div>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          Cena zakupu:{" "}
          <span className="font-medium text-foreground">{displayPrice.toFixed(2)} PLN</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          Warianty: <span className="font-medium text-foreground">{product.variants.length}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Warehouse className="h-4 w-4" />
          Łączny stan:{" "}
          <span className="font-medium text-foreground">
            {totalStock} {product.default_unit}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" className="w-full">
          Zobacz szczegóły
        </Button>
      </CardFooter>
    </Card>
  );
}
