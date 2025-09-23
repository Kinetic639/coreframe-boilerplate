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
import {
  Package,
  Warehouse,
  DollarSign,
  EllipsisVertical,
  ImageIcon,
  Layers,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductAmountCorrectionDialog } from "./product-amount-correction-dialog";
import { ProductContextViews } from "./product-context-views";
import { VariantCreationInterface } from "./variant-creation-interface";
import { ContextIndicator } from "@/modules/warehouse/components/context/context-switcher";

interface ProductCardProps {
  product: ProductWithVariants;
}

import { Link } from "@/i18n/navigation";

export function ProductCard({ product }: ProductCardProps) {
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = React.useState(false);
  const [showContextViews, setShowContextViews] = React.useState(false);
  const [showVariantCreation, setShowVariantCreation] = React.useState(false);

  const totalStock =
    product.variants?.reduce((sum, variant) => {
      return (
        sum +
        (variant.stock_snapshots?.reduce(
          (s, snapshot) => s + (snapshot.quantity_available || 0),
          0
        ) || 0)
      );
    }, 0) || 0;

  // For flexible products, try to get price from attributes or default to 0
  const displayPrice = 0; // TODO: Implement price extraction from product attributes

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
        {product.images && product.images.length > 0 ? (
          <Image
            src={product.images[0].storage_path}
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
          {product.variants?.[0]?.sku && <span>SKU: {product.variants[0].sku}</span>}
          {product.variants?.[0]?.sku && product.variants?.[0]?.barcode && (
            <span className="mx-1">|</span>
          )}
          {product.variants?.[0]?.barcode && <span>EAN: {product.variants[0].barcode}</span>}
        </div>
        <CardTitle className="line-clamp-1 text-lg">{product.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {product.description || "Brak opisu"}
        </CardDescription>
        <div className="mt-2 flex items-center gap-2">
          <ContextIndicator showIcon={true} showName={false} />
          <Badge variant="outline" className="text-xs">
            Phase 3 Ready
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div
            className={`text-2xl font-bold ${totalStock > 0 && totalStock < 10 ? "text-red-500" : totalStock === 0 ? "text-red-500" : "text-foreground"}`}
          >
            {totalStock} szt.
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
                  (v) => v.stock_snapshots?.map((s) => s.location_id) || []
                ) || []
              ).size
            }
          </span>
        </div>

        {/* Quick Actions */}
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowContextViews(true)}
            className="flex-1"
          >
            <Layers className="mr-1 h-3 w-3" />
            Contexts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVariantCreation(true)}
            className="flex-1"
          >
            <Settings className="mr-1 h-3 w-3" />
            Variants
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-2">
        <Link
          href={{
            pathname: "/dashboard/warehouse/products/[id]",
            params: { id: product.id },
          }}
          className="flex-grow"
        >
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

      {/* Context and Variant Management Dialogs */}
      {showContextViews && <ProductContextViews productId={product.id} onDataChange={() => {}} />}

      {showVariantCreation && (
        <VariantCreationInterface
          open={showVariantCreation}
          onOpenChange={setShowVariantCreation}
          productId={product.id}
          existingVariants={product.variants || []}
          onVariantsCreated={() => {
            setShowVariantCreation(false);
          }}
          defaultMode="single"
        />
      )}
    </Card>
  );
}
