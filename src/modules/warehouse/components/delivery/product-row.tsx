"use client";

import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface ProductRowProps {
  product: {
    id: string;
    name: string;
    sku: string;
    product_images?: Array<{
      image_url: string;
      is_primary: boolean;
    }>;
  };
  onAdd: (productId: string) => void;
}

export function ProductRow({ product, onAdd }: ProductRowProps) {
  const primaryImage = product.product_images?.find((img) => img.is_primary);
  const imageUrl = primaryImage?.image_url || product.product_images?.[0]?.image_url;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 border-b last:border-0">
      {/* Image */}
      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        {imageUrl ? (
          <Image src={imageUrl} alt={product.name} fill className="object-cover" sizes="40px" />
        ) : (
          <Package className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.sku}</div>
      </div>

      {/* Add Button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => onAdd(product.id)}
        className="h-8 w-8 flex-shrink-0 text-primary hover:bg-primary/10"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
