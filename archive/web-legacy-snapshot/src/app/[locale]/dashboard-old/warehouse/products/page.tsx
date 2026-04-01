"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { ProductsAdvancedTable } from "@/modules/warehouse/products/components/products-advanced-table";
import { CreateProductDialog } from "@/modules/warehouse/products/components/create-product-dialog";
import { productsService } from "@/modules/warehouse/api/products-service";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";

export default function ProductsPage() {
  const router = useRouter();
  const { activeOrgId } = useAppStore();
  const [products, setProducts] = React.useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<ProductWithDetails | null>(null);

  // Load products
  const loadProducts = React.useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await productsService.getProducts(activeOrgId, {});
      setProducts(result.products);
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAdd = () => {
    setEditingProduct(null);
    setIsCreateDialogOpen(true);
  };

  const handleAddProductGroup = () => {
    router.push("/dashboard-old/warehouse/products/groups/new");
  };

  const handleEdit = (product: ProductWithDetails) => {
    setEditingProduct(product);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (product: ProductWithDetails) => {
    if (!confirm(`Are you sure you want to delete ${product.name}?`)) return;

    try {
      await productsService.deleteProduct(product.id);
      toast.success("Product deleted successfully");
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="space-y-6">
      <CreateProductDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={loadProducts}
        product={editingProduct}
      />

      <ProductsAdvancedTable
        products={products}
        loading={loading}
        error={error}
        onAdd={handleAdd}
        onAddProductGroup={handleAddProductGroup}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
