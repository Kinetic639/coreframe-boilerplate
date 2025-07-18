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
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

import { Link } from "@/i18n/navigation";

export function ProductTable({ products }: { products: ProductWithDetails[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nazwa produktu</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Warianty</TableHead>
          <TableHead>Całkowity stan magazynowy</TableHead>
          <TableHead className="text-right">Akcje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const totalStock = product.variants.reduce(
            (acc, v) => acc + v.stock_locations.reduce((accSL, sl) => accSL + sl.quantity, 0),
            0
          );
          return (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.sku}</TableCell>
              <TableCell>{product.variants.length}</TableCell>
              <TableCell>{totalStock}</TableCell>
              <TableCell className="text-right">
                <Link href={`/dashboard/warehouse/products/${product.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    Zobacz
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
