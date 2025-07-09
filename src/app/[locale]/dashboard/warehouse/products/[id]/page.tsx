// src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { getMockProductById, ProductWithDetails } from "@/lib/mock/products-extended";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";

export default function ProductDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [product, setProduct] = React.useState<ProductWithDetails | null>(null);

  React.useEffect(() => {
    if (id) {
      const fetchedProduct = getMockProductById(id);
      if (fetchedProduct) {
        setProduct(fetchedProduct);
      } else {
        notFound();
      }
    }
  }, [id]);

  if (!product) {
    return <div>Loading...</div>; // Or a skeleton loader
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/warehouse/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">Szczegóły produktu i zarządzanie wariantami</p>
          </div>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Edytuj produkt
        </Button>
      </div>

      {/* Product Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informacje podstawowe</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">SKU</p>
            <p>{product.sku || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Kod kreskowy (EAN)</p>
            <p>{product.barcode || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Jednostka domyślna</p>
            <p>{product.default_unit || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dostawcy</p>
            <div className="flex flex-wrap gap-2">
              {product.suppliers.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Opis</p>
            <p>{product.description || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Variants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Warianty produktu</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa wariantu</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Atrybuty</TableHead>
                <TableHead>Cena zakupu</TableHead>
                <TableHead>Ilość w magazynie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.map((variant) => {
                const totalStock = variant.stock_locations.reduce(
                  (acc, sl) => acc + sl.quantity,
                  0
                );
                return (
                  <TableRow key={variant.id}>
                    <TableCell>{variant.name}</TableCell>
                    <TableCell>{variant.sku || "-"}</TableCell>
                    <TableCell>
                      {variant.attributes
                        ? Object.entries(variant.attributes).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              <span className="font-semibold">{key}:</span>{" "}
                              {Array.isArray(value) ? value.join(", ") : value}
                            </span>
                          ))
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {variant.inventory_data?.purchase_price?.toFixed(2) || "-"} PLN
                    </TableCell>
                    <TableCell>{totalStock}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
