"use client";

import * as React from "react";
import { ProductWithVariants } from "@/modules/warehouse/api/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Eye } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function ProductList({ product }: { product: ProductWithVariants }) {
  const totalStock =
    product.variants?.reduce(
      (acc, v) =>
        acc + (v.stock_locations?.reduce((accSL, sl) => accSL + (sl.quantity || 0), 0) || 0),
      0
    ) || 0;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex-grow">
          <h3 className="font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          <p className="text-sm text-muted-foreground">
            Liczba wariantów: {product.variants.length}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Badge variant={totalStock > 0 ? "secondary" : "destructive"}>
            {totalStock > 0 ? `${totalStock} w magazynie` : "Brak w magazynie"}
          </Badge>
          <Link
            href={{
              pathname: "/dashboard/warehouse/products/[id]",
              params: { id: product.id },
            }}
          >
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Zobacz
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
