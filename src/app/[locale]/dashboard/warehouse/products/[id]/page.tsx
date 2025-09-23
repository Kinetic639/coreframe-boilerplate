// src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Table imports removed - not used in simplified version
import { ArrowLeft, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useProduct } from "@/modules/warehouse/hooks/use-product-variants";
import { VariantManager } from "@/modules/warehouse/components/variants/variant-manager";
import { EnhancedProductForm } from "@/modules/warehouse/products/components/enhanced-product-form";
// ProductWithVariants type removed - not used in this simplified version

export default function ProductDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);

  // Use the new simplified hooks
  const { data: product, isLoading, error } = useProduct(id);

  // Handle error states
  if (error) {
    notFound();
  }

  const getAttributeValue = (_key: string, _context = "warehouse", _locale = "en") => {
    // Since we simplified the system, we'll mock this for now
    // In the new system, simple attributes are stored directly on variants
    return null;
  };

  const formatAttributeValue = (value: unknown) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Tak" : "Nie";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  if (isLoading) {
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
        <Button onClick={() => setEditDialogOpen(true)}>
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

      {/* Modern Variant Management */}
      <VariantManager productId={id} />

      {/* Edit Product Dialog */}
      <EnhancedProductForm
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        product={product as never}
        onSuccess={() => {
          setEditDialogOpen(false);
          // No manual refresh needed - TanStack Query handles cache invalidation
        }}
      />
    </motion.div>
  );
}
