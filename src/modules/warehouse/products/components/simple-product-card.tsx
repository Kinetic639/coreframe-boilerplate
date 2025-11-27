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
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { Package, DollarSign, ImageIcon, Edit, MoreVertical } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/stores/app-store";
import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";

interface SimpleProductCardProps {
  product: ProductWithDetails;
}

export function SimpleProductCard({ product }: SimpleProductCardProps) {
  const { activeOrg, activeBranch } = useAppStore();
  const [branchStock, setBranchStock] = React.useState<number | null>(null);
  const [loadingStock, setLoadingStock] = React.useState(true);

  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0];
  const primaryBarcode = product.barcodes?.find((b) => b.is_primary) || product.barcodes?.[0];

  React.useEffect(() => {
    if (
      product.product_type === "goods" &&
      product.track_inventory &&
      activeOrg?.organization_id &&
      activeBranch?.id
    ) {
      const fetchBranchStock = async () => {
        try {
          setLoadingStock(true);
          const level = await stockMovementsService.getStockLevel(
            product.id,
            undefined,
            undefined,
            activeOrg.organization_id,
            activeBranch.id
          );
          setBranchStock(level);
        } catch (error) {
          console.error("Error fetching branch stock:", error);
          setBranchStock(0);
        } finally {
          setLoadingStock(false);
        }
      };
      fetchBranchStock();
    } else {
      setLoadingStock(false);
    }
  }, [product.id, product.product_type, product.track_inventory, activeOrg, activeBranch]);

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg">
      {/* Status Badge */}
      {product.status === "inactive" && (
        <div className="absolute right-2 top-2 z-10">
          <Badge variant="secondary">Nieaktywny</Badge>
        </div>
      )}
      {product.status === "archived" && (
        <div className="absolute right-2 top-2 z-10">
          <Badge variant="destructive">Zarchiwizowany</Badge>
        </div>
      )}

      {/* Product Image */}
      <div className="relative h-48 w-full">
        {primaryImage ? (
          <Image
            src={primaryImage.storage_path}
            alt={primaryImage.alt_text || product.name}
            fill
            className="rounded-t-lg object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-t-lg bg-muted">
            <ImageIcon className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {product.sku && <span>SKU: {product.sku}</span>}
            {product.sku && primaryBarcode && <span className="mx-1">|</span>}
            {primaryBarcode && <span>Barcode: {primaryBarcode.barcode}</span>}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="ml-2">
              {product.product_type === "goods"
                ? "Towar"
                : product.product_type === "service"
                  ? "Usługa"
                  : "Grupa"}
            </Badge>
            {product.product_type === "item_group" && product.variants && (
              <Badge variant="secondary" className="ml-1">
                {product.variants.length} wariantów
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="line-clamp-1 text-lg">{product.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {product.description || "Brak opisu"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span>Cena sprzedaży:</span>
          <span className="font-medium text-foreground">
            {product.selling_price?.toFixed(2) || "0.00"} PLN
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span>Cena zakupu:</span>
          <span className="font-medium text-foreground">
            {product.cost_price?.toFixed(2) || "0.00"} PLN
          </span>
        </div>
        {product.product_type === "goods" && product.track_inventory && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Stan magazynowy:</span>
            {loadingStock ? (
              <span className="font-medium text-muted-foreground">Ładowanie...</span>
            ) : (
              <span className="font-medium text-foreground">
                {branchStock ?? 0} {product.unit}
              </span>
            )}
          </div>
        )}
        {product.brand && (
          <div className="text-sm text-muted-foreground">
            <span>Marka:</span> <span className="font-medium text-foreground">{product.brand}</span>
          </div>
        )}
        {product.variants && product.variants.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span>Warianty:</span>{" "}
            <span className="font-medium text-foreground">{product.variants.length}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-2 pt-2">
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
      </CardFooter>
    </Card>
  );
}
