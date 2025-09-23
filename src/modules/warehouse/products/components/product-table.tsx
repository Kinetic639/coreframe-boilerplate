"use client";

import * as React from "react";
import { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";
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
          const totalStock =
            product.variants?.reduce(
              (acc, v) =>
                acc +
                (v.stock_snapshots?.reduce(
                  (accSL, snapshot) => accSL + (snapshot.quantity_available || 0),
                  0
                ) || 0),
              0
            ) || 0;
          return (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.variants?.[0]?.sku || "N/A"}</TableCell>
              <TableCell>{product.variants?.length || 1}</TableCell>
              <TableCell>{totalStock}</TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
