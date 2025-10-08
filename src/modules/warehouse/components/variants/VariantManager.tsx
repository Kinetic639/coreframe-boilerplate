"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Star,
  Package,
  ShoppingCart,
  Users,
  Monitor,
  CheckCircle,
  AlertCircle,
  XCircle,
  Grid3X3,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { variantService, type VariantWithAttributes } from "../../api/variant-service";
import { VariantBuilder } from "./VariantBuilder";
import { VariantMatrixDialog } from "./VariantMatrixDialog";

// Context configuration
const CONTEXTS = [
  { id: "warehouse", label: "Warehouse", icon: Package, color: "#10b981" },
  { id: "ecommerce", label: "E-commerce", icon: ShoppingCart, color: "#3b82f6" },
  { id: "b2b", label: "B2B", icon: Users, color: "#8b5cf6" },
  { id: "pos", label: "POS", icon: Monitor, color: "#f59e0b" },
] as const;

interface VariantManagerProps {
  productId: string;
  productName: string;
}

export function VariantManager({ productId, productName }: VariantManagerProps) {
  const [variants, setVariants] = React.useState<VariantWithAttributes[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedVariant, setSelectedVariant] = React.useState<VariantWithAttributes | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [matrixDialogOpen, setMatrixDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");

  // Load variants
  const loadVariants = React.useCallback(async () => {
    try {
      setLoading(true);
      const variantData = await variantService.getVariantsByProduct(productId);
      setVariants(variantData);
    } catch (error) {
      console.error("Error loading variants:", error);
      toast.error("Failed to load variants");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  // Filter variants based on search term
  const filteredVariants = React.useMemo(() => {
    if (!searchTerm) return variants;

    return variants.filter(
      (variant) =>
        variant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variant.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variant.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [variants, searchTerm]);

  const handleCreateVariant = () => {
    setDialogMode("create");
    setSelectedVariant(null);
    setDialogOpen(true);
  };

  const handleEditVariant = (variant: VariantWithAttributes) => {
    setDialogMode("edit");
    setSelectedVariant(variant);
    setDialogOpen(true);
  };

  const handleSaveVariant = async () => {
    await loadVariants();
    setDialogOpen(false);
    setSelectedVariant(null);
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await variantService.deleteVariant(variantId);
      toast.success("Variant deleted successfully");
      await loadVariants();
    } catch (error) {
      console.error("Error deleting variant:", error);
      toast.error("Failed to delete variant");
    }
  };

  const handleSetDefault = async (variantId: string) => {
    try {
      await variantService.setDefaultVariant(productId, variantId);
      toast.success("Default variant updated");
      await loadVariants();
    } catch (error) {
      console.error("Error setting default variant:", error);
      toast.error("Failed to set default variant");
    }
  };

  const handleCloneVariant = async (variant: VariantWithAttributes) => {
    try {
      const variantName = `${variant.name} (Copy)`;
      await variantService.createVariant(productId, {
        product_id: productId,
        name: variantName,
        slug: variantName.toLowerCase().replace(/\s+/g, "-"),
        sku: variant.sku ? `${variant.sku}-copy` : undefined,
        barcode: undefined, // Don't copy barcode
        is_default: false,
        status: variant.status as "active" | "inactive" | "discontinued",
        attributes: variant.attributes.reduce(
          (acc, attr) => {
            const value = getAttributeValue(attr);
            if (value !== null && value !== undefined) {
              acc[attr.attribute_key] = convertToAttributeValue(
                value,
                getDataTypeFromAttribute(attr)
              );
            }
            return acc;
          },
          {} as Record<string, any>
        ),
      });

      toast.success("Variant cloned successfully");
      await loadVariants();
    } catch (error) {
      console.error("Error cloning variant:", error);
      toast.error("Failed to clone variant");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "inactive":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "discontinued":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-yellow-100 text-yellow-800";
      case "discontinued":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get contexts that have attributes for a variant
  const getVariantContexts = (variant: VariantWithAttributes): string[] => {
    if (!variant.attributes?.length) return [];

    const contexts = [...new Set(variant.attributes.map((attr) => attr.context_scope))];
    return contexts.filter(Boolean);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading variants...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Product Variants</h3>
          <p className="text-muted-foreground">Manage variants for {productName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={matrixDialogOpen} onOpenChange={setMatrixDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Grid3X3 className="mr-2 h-4 w-4" />
                Matrix Creation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create Variants Matrix</DialogTitle>
                <DialogDescription>
                  Generate multiple variants automatically from attribute combinations.
                </DialogDescription>
              </DialogHeader>
              <VariantMatrixDialog
                productId={productId}
                onSuccess={async () => {
                  await loadVariants();
                  setMatrixDialogOpen(false);
                }}
                onCancel={() => setMatrixDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Variant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {dialogMode === "create" ? "Create New Variant" : "Edit Variant"}
                </DialogTitle>
                <DialogDescription>
                  {dialogMode === "create"
                    ? "Create a new variant for this product with context-specific attributes."
                    : "Modify the variant details and attributes."}
                </DialogDescription>
              </DialogHeader>
              <VariantBuilder
                mode={dialogMode}
                productId={productId}
                baseVariant={selectedVariant || undefined}
                onSave={handleSaveVariant}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search variants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredVariants.length} variant{filteredVariants.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Variants List */}
      {filteredVariants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 text-lg font-medium">No variants found</h4>
            <p className="mb-4 text-center text-muted-foreground">
              {variants.length === 0
                ? "This product doesn't have any variants yet."
                : "No variants match your search criteria."}
            </p>
            {variants.length === 0 && (
              <Button onClick={handleCreateVariant}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Variant
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVariants.map((variant) => {
            const contexts = getVariantContexts(variant);

            return (
              <Card key={variant.id} className="relative">
                {variant.is_default && (
                  <div className="absolute right-2 top-2">
                    <Badge variant="default" className="bg-blue-100 text-blue-800">
                      <Star className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  </div>
                )}

                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h4 className="text-lg font-medium">{variant.name}</h4>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(variant.status)}
                          <Badge className={getStatusColor(variant.status)}>{variant.status}</Badge>
                        </div>
                      </div>

                      <div className="mb-3 flex items-center gap-6 text-sm text-muted-foreground">
                        {variant.sku && (
                          <div>
                            <span className="font-medium">SKU:</span> {variant.sku}
                          </div>
                        )}
                        {variant.barcode && (
                          <div>
                            <span className="font-medium">Barcode:</span> {variant.barcode}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Attributes:</span>{" "}
                          {variant.attributes?.length || 0}
                        </div>
                      </div>

                      {/* Context badges */}
                      {contexts.length > 0 && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Contexts:</span>
                          {contexts.map((contextId) => {
                            const context = CONTEXTS.find((c) => c.id === contextId);
                            if (!context) return null;

                            const Icon = context.icon;
                            return (
                              <Badge
                                key={contextId}
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                <Icon className="h-3 w-3" style={{ color: context.color }} />
                                {context.label}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {/* Attributes preview */}
                      {variant.attributes && variant.attributes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {variant.attributes.slice(0, 3).map((attr) => {
                            const value = getAttributeValue(attr);
                            if (!value) return null;

                            return (
                              <Badge key={attr.id} variant="secondary" className="text-xs">
                                {attr.attribute_key}: {String(value)}
                              </Badge>
                            );
                          })}
                          {variant.attributes.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{variant.attributes.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => handleEditVariant(variant)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCloneVariant(variant)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Clone
                          </DropdownMenuItem>
                          {!variant.is_default && (
                            <DropdownMenuItem onClick={() => handleSetDefault(variant.id)}>
                              <Star className="mr-2 h-4 w-4" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Variant</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the variant "{variant.name}"? This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper functions (same as in VariantBuilder)
function getAttributeValue(attr: any): any {
  if (attr.value_text !== null) return attr.value_text;
  if (attr.value_number !== null) return attr.value_number;
  if (attr.value_boolean !== null) return attr.value_boolean;
  if (attr.value_date !== null) return attr.value_date;
  if (attr.value_json !== null) return attr.value_json;
  return null;
}

function getDataTypeFromAttribute(attr: any): "text" | "number" | "boolean" | "date" | "json" {
  if (attr.value_number !== null) return "number";
  if (attr.value_boolean !== null) return "boolean";
  if (attr.value_date !== null) return "date";
  if (attr.value_json !== null) return "json";
  return "text";
}

function convertToAttributeValue(value: any, dataType: string): any {
  switch (dataType) {
    case "number":
      return { type: "number", value: Number(value) };
    case "boolean":
      return { type: "boolean", value: Boolean(value) };
    case "date":
      return { type: "date", value: value };
    case "json":
      try {
        return { type: "json", value: JSON.parse(value) };
      } catch {
        return { type: "json", value: value };
      }
    default:
      return { type: "text", value: String(value) };
  }
}
