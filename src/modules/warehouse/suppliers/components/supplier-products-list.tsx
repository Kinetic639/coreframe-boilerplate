/**
 * Supplier Products List
 * Phase 0: Purchase Orders Implementation
 * Displays all products from a specific supplier
 */

"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star, Clock, Package } from "lucide-react";
import { toast } from "react-toastify";
import type { ProductSupplierWithRelations } from "../../types/product-suppliers";
import { getSupplierProductsAction } from "../../products/actions/product-suppliers-actions";

interface SupplierProductsListProps {
  supplierId: string;
}

export function SupplierProductsList({ supplierId }: SupplierProductsListProps) {
  const [products, setProducts] = React.useState<ProductSupplierWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const result = await getSupplierProductsAction(supplierId, false); // Include inactive
        if (result.success && result.data) {
          setProducts(result.data);
        } else {
          throw new Error(result.error || "Failed to load products");
        }
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [supplierId]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading products...</div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-medium">No products configured</h3>
        <p className="text-sm text-muted-foreground">
          This supplier doesn't have any products configured yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Products</h3>
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} from this supplier
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Supplier SKU</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-center">Lead Time</TableHead>
              <TableHead className="text-right">MOQ</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {product.is_preferred && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                    <div>
                      <div className="font-medium">{product.product.name}</div>
                      {product.supplier_product_name && (
                        <div className="text-xs text-muted-foreground">
                          {product.supplier_product_name}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {product.product.sku}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {product.supplier_sku || "-"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium">
                    {formatCurrency(product.unit_price, product.currency_code)}
                  </span>
                  <div className="text-xs text-muted-foreground">per {product.product.unit}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {product.lead_time_days} days
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {product.min_order_qty} {product.product.unit}
                    {product.order_multiple > 1 && (
                      <div className="text-xs">×{product.order_multiple}</div>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {products.filter((p) => p.is_active).length} active product(s) •{" "}
          {products.filter((p) => p.is_preferred).length} as preferred supplier
        </div>
        {products.length > 0 && products[0].last_order_date && (
          <div>Last order: {new Date(products[0].last_order_date).toLocaleDateString()}</div>
        )}
      </div>
    </div>
  );
}
