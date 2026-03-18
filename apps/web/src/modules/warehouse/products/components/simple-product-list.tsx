"use client";

import * as React from "react";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { DollarSign, Package, Edit, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SimpleProductListProps {
  product: ProductWithDetails;
}

export function SimpleProductList({ product }: SimpleProductListProps) {
  const primaryBarcode = product.barcodes?.find((b) => b.is_primary) || product.barcodes?.[0];

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex-grow space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{product.name}</h3>
          <Badge variant="outline">
            {product.product_type === "goods"
              ? "Towar"
              : product.product_type === "service"
                ? "Usługa"
                : "Grupa"}
          </Badge>
          {product.product_type === "item_group" && product.variants && (
            <Badge variant="secondary">{product.variants.length} wariantów</Badge>
          )}
          {product.status === "inactive" && <Badge variant="secondary">Nieaktywny</Badge>}
          {product.status === "archived" && <Badge variant="destructive">Zarchiwizowany</Badge>}
        </div>

        <p className="line-clamp-1 text-sm text-muted-foreground">
          {product.description || "Brak opisu"}
        </p>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {product.sku && (
            <span>
              <span className="font-medium">SKU:</span> {product.sku}
            </span>
          )}
          {primaryBarcode && (
            <span>
              <span className="font-medium">Barcode:</span> {primaryBarcode.barcode}
            </span>
          )}
          {product.brand && (
            <span>
              <span className="font-medium">Marka:</span> {product.brand}
            </span>
          )}
        </div>

        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sprzedaż:</span>
            <span className="font-medium">{product.selling_price?.toFixed(2) || "0.00"} PLN</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Zakup:</span>
            <span className="font-medium">{product.cost_price?.toFixed(2) || "0.00"} PLN</span>
          </div>
          {product.product_type === "goods" && product.track_inventory && (
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Stan:</span>
              <span className="font-medium">
                {product.opening_stock || 0} {product.unit}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="ml-4 flex gap-2">
        <Link
          href={{
            pathname: "/dashboard-old/warehouse/products/[id]",
            params: { id: product.id },
          }}
        >
          <Button>Szczegóły</Button>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edytuj
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
