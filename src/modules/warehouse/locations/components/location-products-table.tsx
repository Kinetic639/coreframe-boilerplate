"use client";

import { useState, useEffect } from "react";
import {
  getLocationProducts,
  type LocationProduct,
} from "@/app/actions/warehouse/get-location-products";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface LocationProductsTableProps {
  locationId: string;
  organizationId: string;
}

export function LocationProductsTable({ locationId, organizationId }: LocationProductsTableProps) {
  const [products, setProducts] = useState<LocationProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<LocationProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        const result = await getLocationProducts(locationId, organizationId);

        if (result.error) {
          setError(result.error);
        } else {
          setProducts(result.data);
          setFilteredProducts(result.data);
        }
      } catch (err) {
        setError("Failed to load products");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [locationId, organizationId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(
      (p) =>
        p.product.name.toLowerCase().includes(query) ||
        p.product.sku.toLowerCase().includes(query) ||
        p.variant?.name.toLowerCase().includes(query) ||
        p.variant?.sku.toLowerCase().includes(query)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-1 text-sm font-medium">No products in this location</h3>
        <p className="text-xs text-muted-foreground">
          Products will appear here once stock is moved to this location
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Available Qty</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead className="text-right">Avg Cost</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No products match your search
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((item) => (
                <TableRow key={`${item.product_id}-${item.variant_id || "null"}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.product.name}</div>
                      {item.variant && (
                        <div className="text-xs text-muted-foreground">{item.variant.name}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {item.variant ? item.variant.sku : item.product.sku}
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">{item.available_quantity}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {item.product.unit || "pcs"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.reserved_quantity > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {item.reserved_quantity}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.total_value ? (
                      <span className="font-medium">{item.total_value.toFixed(2)} PLN</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.average_cost ? (
                      <span className="text-sm text-muted-foreground">
                        {item.average_cost.toFixed(2)} PLN
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.last_movement_at ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.last_movement_at)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
        <div className="text-sm text-muted-foreground">
          Total products: <span className="font-semibold text-foreground">{products.length}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Total quantity:{" "}
          <span className="font-semibold text-foreground">
            {products.reduce((sum, p) => sum + p.available_quantity, 0)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          Total value:{" "}
          <span className="font-semibold text-foreground">
            {products.reduce((sum, p) => sum + (p.total_value || 0), 0).toFixed(2)} PLN
          </span>
        </div>
      </div>
    </div>
  );
}
