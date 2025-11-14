"use client";

import { format } from "date-fns";
import { ArrowUpRight, ExternalLink, Package, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { PreviewProduct } from "@/modules/development/samples/previewable-table-data";

interface ProductPreviewCardProps {
  product: PreviewProduct;
  onClose: () => void;
}

const statusVariant: Record<PreviewProduct["status"], string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  archived: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
};

export function ProductPreviewCard({ product, onClose }: ProductPreviewCardProps) {
  return (
    <Card className="m-4 flex h-[calc(100%-2rem)] flex-col overflow-hidden border-0 shadow-none">
      <CardHeader className="flex items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-3 text-lg">
              {product.name}
              <Badge className={cn("rounded-full px-2.5", statusVariant[product.status])}>
                {product.status.toUpperCase()}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">SKU {product.sku}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 space-y-6 overflow-y-auto py-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Overview</h3>
          <p className="text-sm leading-relaxed text-foreground/90">{product.description}</p>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/40 p-4 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <p className="font-medium">{product.category}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Price</p>
            <p className="font-medium">${product.price.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">In stock</p>
            <p className="font-medium">{product.stock}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Last update</p>
            <p className="font-medium">{format(new Date(product.updatedAt), "PPP p")}</p>
          </div>
        </section>
      </CardContent>
      <Separator />
      <CardFooter className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Preview layout demo</span>
          <span>&bull;</span>
          <span>Optimised for in-place product inspection</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/warehouse/products/${product.id}`} scroll={false}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open product page
            </Link>
          </Button>
          <Button onClick={onClose}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Close preview
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
