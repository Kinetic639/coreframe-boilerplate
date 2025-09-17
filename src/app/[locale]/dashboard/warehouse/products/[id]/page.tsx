// src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/stores/app-store";
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
import { flexibleProductService } from "@/modules/warehouse/api/flexible-products";
import type { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";

export default function ProductDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { activeBranchId } = useAppStore();
  const [product, setProduct] = React.useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (id && activeBranchId) {
      fetchProduct(id);
    }
  }, [id, activeBranchId]);

  const fetchProduct = async (productId: string) => {
    try {
      const productData = await flexibleProductService.getProductById(productId);

      // Filter stock snapshots by current branch
      if (productData.variants) {
        productData.variants = productData.variants.map((variant) => ({
          ...variant,
          stock_snapshots:
            variant.stock_snapshots?.filter((snapshot) => snapshot.branch_id === activeBranchId) ||
            [],
        }));
      }

      setProduct(productData);
    } catch (error) {
      console.error("Error fetching product:", error);
      notFound();
    } finally {
      setLoading(false);
    }
  };

  const getAttributeValue = (key: string, context = "warehouse", locale = "en") => {
    const attr = product?.attributes.find(
      (a) => a.attribute_key === key && a.context_scope === context && a.locale === locale
    );
    if (!attr) return null;

    if (attr.value_text) return attr.value_text;
    if (attr.value_number !== undefined) return attr.value_number;
    if (attr.value_boolean !== undefined) return attr.value_boolean;
    if (attr.value_date) return attr.value_date;
    if (attr.value_json) return attr.value_json;

    return null;
  };

  const formatAttributeValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Tak" : "Nie";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  if (!product) {
    return <div>Product not found</div>;
  }

  const sku = getAttributeValue("sku");
  const barcode = getAttributeValue("barcode");
  const manufacturer = getAttributeValue("manufacturer");
  const brand = getAttributeValue("brand");
  const category = getAttributeValue("category");
  const purchasePrice = getAttributeValue("purchase_price");
  const sellPrice = getAttributeValue("sell_price");
  const weight = getAttributeValue("weight");
  const currency = getAttributeValue("currency") || "PLN";

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
            {product.template && (
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: product.template.color,
                    color: product.template.color,
                  }}
                >
                  {product.template.name}
                </Badge>
                <Badge variant="secondary">{product.status}</Badge>
              </div>
            )}
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
            <p>{formatAttributeValue(sku)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Kod kreskowy (EAN)</p>
            <p>{formatAttributeValue(barcode)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Producent</p>
            <p>{formatAttributeValue(manufacturer)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Marka</p>
            <p>{formatAttributeValue(brand)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Kategoria</p>
            <p>{formatAttributeValue(category)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Waga</p>
            <p>{weight ? `${weight} g` : "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Opis</p>
            <p>{product.description || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Information */}
      {(purchasePrice || sellPrice) && (
        <Card>
          <CardHeader>
            <CardTitle>Informacje cenowe</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {purchasePrice && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cena zakupu</p>
                <p className="text-lg font-semibold">
                  {formatAttributeValue(purchasePrice)} {formatAttributeValue(currency)}
                </p>
              </div>
            )}
            {sellPrice && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cena sprzedaży</p>
                <p className="text-lg font-semibold">
                  {formatAttributeValue(sellPrice)} {formatAttributeValue(currency)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variants Table */}
      {product.variants && product.variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Warianty produktu ({product.variants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa wariantu</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Kod kreskowy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Domyślny</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium">{variant.name}</TableCell>
                    <TableCell>{variant.sku || "-"}</TableCell>
                    <TableCell>{variant.barcode || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={variant.status === "active" ? "default" : "secondary"}>
                        {variant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {variant.is_default && <Badge variant="outline">Domyślny</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stock Information */}
      {product.variants && product.variants.some((v) => v.stock_snapshots?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Stan magazynowy</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wariant</TableHead>
                  <TableHead>Lokalizacja</TableHead>
                  <TableHead>Na stanie</TableHead>
                  <TableHead>Zarezerwowane</TableHead>
                  <TableHead>Dostępne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) =>
                  variant.stock_snapshots?.map((stock, index) => (
                    <TableRow key={`${variant.id}-${index}`}>
                      <TableCell className="font-medium">{variant.name}</TableCell>
                      <TableCell>{`Lokalizacja ${stock.location_id}`}</TableCell>
                      <TableCell className="font-medium">{stock.quantity_on_hand}</TableCell>
                      <TableCell className="text-yellow-600">{stock.quantity_reserved}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {stock.quantity_available}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Attributes */}
      {product.attributes && product.attributes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wszystkie atrybuty</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atrybut</TableHead>
                  <TableHead>Wartość</TableHead>
                  <TableHead>Kontekst</TableHead>
                  <TableHead>Język</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.attributes.map((attr) => (
                  <TableRow key={attr.id}>
                    <TableCell className="font-medium">{attr.attribute_key}</TableCell>
                    <TableCell>
                      {formatAttributeValue(
                        attr.value_text ||
                          attr.value_number ||
                          attr.value_boolean ||
                          attr.value_date ||
                          attr.value_json
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{attr.context_scope}</Badge>
                    </TableCell>
                    <TableCell>{attr.locale}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
