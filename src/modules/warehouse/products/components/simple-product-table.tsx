"use client";

import * as React from "react";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
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
import { Link } from "@/i18n/navigation";
import { Edit, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SimpleProductTableProps {
  products: ProductWithDetails[];
}

export function SimpleProductTable({ products }: SimpleProductTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nazwa</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Marka</TableHead>
            <TableHead className="text-right">Cena sprzedaży</TableHead>
            <TableHead className="text-right">Cena zakupu</TableHead>
            <TableHead className="text-right">Stan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Brak produktów do wyświetlenia
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => {
              const primaryBarcode =
                product.barcodes?.find((b) => b.is_primary) || product.barcodes?.[0];

              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{product.name}</div>
                      {primaryBarcode && (
                        <div className="text-xs text-muted-foreground">
                          Barcode: {primaryBarcode.barcode}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{product.sku || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline">
                        {product.product_type === "goods"
                          ? "Towar"
                          : product.product_type === "service"
                            ? "Usługa"
                            : "Grupa"}
                      </Badge>
                      {product.product_type === "item_group" && product.variants && (
                        <Badge variant="secondary" className="text-xs">
                          {product.variants.length} wariantów
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{product.brand || "-"}</TableCell>
                  <TableCell className="text-right">
                    {product.selling_price?.toFixed(2) || "0.00"} PLN
                  </TableCell>
                  <TableCell className="text-right">
                    {product.cost_price?.toFixed(2) || "0.00"} PLN
                  </TableCell>
                  <TableCell className="text-right">
                    {product.product_type === "goods" && product.track_inventory
                      ? `${product.opening_stock || 0} ${product.unit}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {product.status === "active" && (
                      <Badge variant="default" className="bg-green-500">
                        Aktywny
                      </Badge>
                    )}
                    {product.status === "inactive" && <Badge variant="secondary">Nieaktywny</Badge>}
                    {product.status === "archived" && (
                      <Badge variant="destructive">Zarchiwizowany</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={{
                          pathname: "/dashboard/warehouse/products/[id]",
                          params: { id: product.id },
                        }}
                      >
                        <Button variant="outline" size="sm">
                          Szczegóły
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
