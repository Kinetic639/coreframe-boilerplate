"use client";

import * as React from "react";
import { ProductWithDetails } from "@/lib/mock/products-extended";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Warehouse, DollarSign } from "lucide-react";

interface ProductTableProps {
  products: ProductWithDetails[];
}

export function ProductTable({ products }: ProductTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nazwa produktu</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Kod kreskowy</TableHead>
            <TableHead>Cena zakupu</TableHead>
            <TableHead>Warianty</TableHead>
            <TableHead>Łączny stan</TableHead>
            <TableHead>Dostawcy</TableHead>
            <TableHead className="w-[100px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const totalStock = product.variants.reduce((sum, variant) => {
              return sum + variant.stock_locations.reduce((s, sl) => s + sl.quantity, 0);
            }, 0);
            const firstVariant = product.variants[0];
            const displayPrice = firstVariant?.inventory_data?.purchase_price || 0;

            return (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>{product.barcode || "-"}</TableCell>
                <TableCell className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {displayPrice.toFixed(2)} PLN
                </TableCell>
                <TableCell>{product.variants.length}</TableCell>
                <TableCell className="flex items-center gap-1">
                  <Warehouse className="h-3 w-3" />
                  {totalStock} {product.default_unit}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {product.suppliers.map((supplier) => (
                      <Badge key={supplier.id} variant="secondary">
                        {supplier.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    Szczegóły
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
