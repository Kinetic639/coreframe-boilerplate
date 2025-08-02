"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductWithVariants } from "@/modules/warehouse/api/products";
import { Package, Warehouse, DollarSign, EllipsisVertical, ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ProductAmountCorrectionDialog } from "./product-amount-correction-dialog";

interface ProductCardProps {
  product: ProductWithVariants;
}

import { Link } from "@/i18n/navigation";

export function ProductCard({ product }: ProductCardProps) {
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = React.useState(false);

  const totalStock =
    product.variants?.reduce((sum, variant) => {
      return sum + (variant.stock_locations?.reduce((s, sl) => s + (sl.quantity || 0), 0) || 0);
    }, 0) || 0;

  const displayPrice = product.inventory_data?.purchase_price || 0;

  const getLocalizedUnit = (unit: string) => {
    switch (unit) {
      case "szt.":
        return "szt.";
      case "kg":
        return "kg";
      case "m":
        return "m";
      case "litr":
        return "litr";
      default:
        return unit;
    }
  };

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg">
      {totalStock > 0 && totalStock < 10 && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
          NISKI STAN
        </div>
      )}
      {totalStock === 0 && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
          BRAK W MAGAZYNIE
        </div>
      )}
      <div className="relative h-48 w-full">
        {product.main_image_id ? (
          <Image
            src={product.main_image_id}
            alt={product.name}
            layout="fill"
            objectFit="cover"
            className="rounded-t-lg"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-t-lg bg-muted">
            <ImageIcon className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="text-xs text-muted-foreground">
          {product.sku && <span>SKU: {product.sku}</span>}
          {product.sku && product.barcode && <span className="mx-1">|</span>}
          {product.barcode && <span>EAN: {product.barcode}</span>}
        </div>
        <CardTitle className="line-clamp-1 text-lg">{product.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {product.description || "Brak opisu"}
        </CardDescription>
        <div className="mt-2 flex items-center justify-between">
          <div
            className={`text-2xl font-bold ${totalStock > 0 && totalStock < 10 ? "text-red-500" : totalStock === 0 ? "text-red-500" : "text-foreground"}`}
          >
            {totalStock} {getLocalizedUnit(product.default_unit)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          Cena zakupu:{" "}
          <span className="font-medium text-foreground">{displayPrice.toFixed(2)} PLN</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          Warianty:{" "}
          <span className="font-medium text-foreground">{product.variants?.length || 1}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Warehouse className="h-4 w-4" />
          Lokalizacje:{" "}
          <span className="font-medium text-foreground">
            {
              new Set(
                product.variants?.flatMap(
                  (v) => v.stock_locations?.map((sl) => sl.location_id) || []
                ) || []
              ).size
            }
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-2">
        <Link href={`/dashboard/warehouse/products/${product.id}`} className="flex-grow">
          <Button className="w-full" variant="themed">
            Szczegóły
          </Button>
        </Link>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsCorrectionDialogOpen(true)}
          className="ml-2 flex-shrink-0"
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
        <ProductAmountCorrectionDialog
          open={isCorrectionDialogOpen}
          onOpenChange={setIsCorrectionDialogOpen}
          product={product}
        />
      </CardFooter>
    </Card>
  );
}
