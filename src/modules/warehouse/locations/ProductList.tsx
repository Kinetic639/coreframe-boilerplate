"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { Product } from "@/lib/mockData";

interface ProductListProps {
  products: Product[];
}

export function ProductList({ products }: ProductListProps) {
  const getQuantityBadgeColor = (quantity: number) => {
    if (quantity === 0) return "bg-red-100 text-red-800";
    if (quantity < 5) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <Card key={product.id} className="transition-all duration-200 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 rounded bg-blue-50 p-1.5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-gray-900">{product.name}</h4>
                  <p className="font-mono text-sm text-gray-500">{product.sku}</p>
                </div>
              </div>

              <div className="text-right">
                <Badge className={getQuantityBadgeColor(product.quantity)}>
                  {product.quantity} {product.unit}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
