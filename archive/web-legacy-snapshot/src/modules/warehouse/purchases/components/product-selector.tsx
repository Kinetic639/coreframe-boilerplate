"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { toast } from "react-toastify";
// import { useAppStore } from "@/lib/stores/app-store";
import { getSupplierProductsAction } from "../../products/actions/product-suppliers-actions";
import type { ProductSupplierWithRelations } from "../../types/product-suppliers";

interface ProductSelectorProps {
  supplierId: string;
  onSelect: (productData: {
    product_id: string;
    product_variant_id?: string;
    product_supplier_id: string;
    unit_price: number;
    quantity: number;
    tax_rate: number;
  }) => void;
  disabled?: boolean;
}

export function ProductSelector({ supplierId, onSelect, disabled }: ProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [products, setProducts] = React.useState<ProductSupplierWithRelations[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);

  // Load products when dialog opens
  React.useEffect(() => {
    if (!open || !supplierId) return;

    const loadProducts = async () => {
      setLoading(true);
      try {
        const result = await getSupplierProductsAction(supplierId, true);
        if (result.success && result.data) {
          setProducts(result.data);
        }
      } catch (error) {
        console.error("Failed to load products:", error);
        toast.error("Failed to load products from supplier");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [open, supplierId]);

  const filteredProducts = products.filter(
    (p) =>
      p.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier_sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleAdd = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }

    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    onSelect({
      product_id: selectedProduct.product_id,
      product_variant_id: undefined, // TODO: Add variant support later
      product_supplier_id: selectedProduct.id,
      unit_price: selectedProduct.unit_price,
      quantity: Math.max(quantity, selectedProduct.min_order_qty),
      tax_rate: 23, // Default Polish VAT
    });

    // Reset and close
    setSelectedProductId("");
    setQuantity(1);
    setSearchTerm("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Product to Order</DialogTitle>
          <DialogDescription>
            Select a product from this supplier to add to the purchase order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Product</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchTerm
                    ? "No products match your search"
                    : "No products available from this supplier"}
                </p>
              </div>
            ) : (
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{product.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {product.product.sku}
                            {product.supplier_sku && ` | Supplier SKU: ${product.supplier_sku}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {new Intl.NumberFormat("pl-PL", {
                              style: "currency",
                              currency: product.currency_code,
                            }).format(product.unit_price)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            MOQ: {product.min_order_qty}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Product Details */}
          {selectedProduct && (
            <div className="rounded-lg border p-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Price:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("pl-PL", {
                      style: "currency",
                      currency: selectedProduct.currency_code,
                    }).format(selectedProduct.unit_price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum Order Quantity:</span>
                  <span>{selectedProduct.min_order_qty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lead Time:</span>
                  <span>{selectedProduct.lead_time_days} days</span>
                </div>
                {selectedProduct.order_multiple > 1 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Multiple:</span>
                    <span>{selectedProduct.order_multiple}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.001"
              min={selectedProduct?.min_order_qty || 1}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
              disabled={!selectedProduct}
            />
            {selectedProduct && quantity < selectedProduct.min_order_qty && (
              <p className="text-sm text-yellow-600">
                Quantity will be adjusted to minimum order quantity ({selectedProduct.min_order_qty}
                )
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd} disabled={!selectedProduct}>
              Add to Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
