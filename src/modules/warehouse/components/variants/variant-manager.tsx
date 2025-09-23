"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";
import { VariantDataTable } from "./variant-data-table";
import { VariantFormDialog } from "./variant-form-dialog";
import { createVariantColumns } from "./variant-columns";
import { useProductVariants, useDeleteVariant } from "../../hooks/use-product-variants";
import type { Variant } from "../../types/variant-types";

interface VariantManagerProps {
  productId: string;
}

export function VariantManager({ productId }: VariantManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingVariant, setEditingVariant] = React.useState<Variant | undefined>();

  const { data: variantsData, isLoading, error } = useProductVariants(productId);
  const deleteVariant = useDeleteVariant();

  const handleEdit = (variant: Variant) => {
    setEditingVariant(variant);
  };

  const handleDelete = (variantId: string) => {
    if (confirm("Are you sure you want to delete this variant? This action cannot be undone.")) {
      deleteVariant.mutate(variantId);
    }
  };

  const handleDuplicate = (variant: Variant) => {
    // Create a copy of the variant for editing
    const duplicateVariant: Variant = {
      ...variant,
      id: "", // Clear ID so it creates a new one
      name: `${variant.name} (Copy)`,
      sku: variant.sku ? `${variant.sku}-copy` : undefined,
      is_default: false,
    };
    setEditingVariant(duplicateVariant);
  };

  const columns = createVariantColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
  });

  const variants = variantsData?.variants || [];
  const totalVariants = variantsData?.total || 0;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">Failed to load variants. Please try again.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>Product Variants</CardTitle>
              <Badge variant="secondary">{totalVariants}</Badge>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variants.length === 0 && !isLoading ? (
            <div className="py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No variants yet</h3>
              <p className="mb-4 text-muted-foreground">
                This product doesn't have any variants. Create your first variant to get started.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Variant
              </Button>
            </div>
          ) : (
            <VariantDataTable data={variants} columns={columns} isLoading={isLoading} />
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <VariantFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        productId={productId}
      />

      {/* Edit/Duplicate Dialog */}
      <VariantFormDialog
        open={!!editingVariant}
        onOpenChange={(open) => !open && setEditingVariant(undefined)}
        productId={productId}
        variant={editingVariant}
      />
    </>
  );
}
