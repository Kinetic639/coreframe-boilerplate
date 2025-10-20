"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  CheckCircle,
  XCircle,
  BarChart3,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import type { ProductGroupDetail } from "@/modules/warehouse/types/product-groups";

interface ProductGroupDetailClientProps {
  productGroupId: string;
}

export function ProductGroupDetailClient({ productGroupId }: ProductGroupDetailClientProps) {
  const t = useTranslations("productGroups.detail");
  const tTable = useTranslations("productGroups.variantsTable");
  const router = useRouter();

  const [productGroup, setProductGroup] = React.useState<ProductGroupDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const loadProductGroup = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await productGroupsService.getProductGroupById(productGroupId);
      if (!data) {
        toast.error("Product group not found");
        router.push("/dashboard/warehouse/products");
        return;
      }
      setProductGroup(data);
    } catch (error) {
      console.error("Failed to load product group:", error);
      toast.error("Failed to load product group");
    } finally {
      setIsLoading(false);
    }
  }, [productGroupId, router]);

  React.useEffect(() => {
    loadProductGroup();
  }, [loadProductGroup]);

  const handleDeleteProductGroup = async () => {
    setIsDeleting(true);
    try {
      // This would need to be implemented in the service
      await productGroupsService.deleteVariant(productGroupId);
      toast.success("Product group deleted successfully");
      router.push("/dashboard/warehouse/products");
    } catch (error) {
      console.error("Failed to delete product group:", error);
      toast.error("Failed to delete product group");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await productGroupsService.deleteVariant(variantId);
      toast.success(tTable("variantDeleted"));
      loadProductGroup(); // Reload to get updated data
    } catch (error) {
      console.error("Failed to delete variant:", error);
      toast.error("Failed to delete variant");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading product group...</p>
        </div>
      </div>
    );
  }

  if (!productGroup) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Product group not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{productGroup.product.name}</h1>
            <p className="mt-1 text-muted-foreground">{productGroup.product.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalVariants")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.totalVariants}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("activeVariants")}: {productGroup.activeVariants}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalStock")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.totalStock || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Across all variants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attributes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.attributes.length}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {productGroup.attributes.map((attr) => (
                <Badge key={attr.optionGroup.id} variant="secondary" className="text-xs">
                  {attr.optionGroup.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="variants" className="w-full">
        <TabsList>
          <TabsTrigger value="variants">{t("variants")}</TabsTrigger>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="settings">{t("settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("manageVariants")}</CardTitle>
                  <CardDescription>
                    View and manage all variants in this product group
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tTable("variantName")}</TableHead>
                      <TableHead>{tTable("sku")}</TableHead>
                      <TableHead>{tTable("attributes")}</TableHead>
                      <TableHead className="text-right">{tTable("sellingPrice")}</TableHead>
                      <TableHead className="text-right">{tTable("costPrice")}</TableHead>
                      <TableHead className="text-center">{tTable("active")}</TableHead>
                      <TableHead className="text-right">{tTable("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productGroup.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">{variant.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">{variant.sku}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {variant.attribute_values?.map(
                              (attrVal: { id: string; value: string }) => (
                                <Badge key={attrVal.id} variant="outline" className="text-xs">
                                  {attrVal.value}
                                </Badge>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          ${variant.selling_price?.toFixed(2) || "0.00"}
                        </TableCell>
                        <TableCell className="text-right">
                          ${variant.cost_price?.toFixed(2) || "0.00"}
                        </TableCell>
                        <TableCell className="text-center">
                          {variant.is_active ? (
                            <CheckCircle className="inline h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="inline h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this variant?")) {
                                  handleDeleteVariant(variant.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Product Type</p>
                  <p className="mt-1 text-sm">
                    <Badge>{productGroup.product.product_type}</Badge>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unit</p>
                  <p className="mt-1 text-sm">{productGroup.product.unit || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Brand</p>
                  <p className="mt-1 text-sm">{productGroup.product.brand || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                  <p className="mt-1 text-sm">{productGroup.product.manufacturer || "N/A"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-medium">Attributes Used</h3>
                <div className="space-y-2">
                  {productGroup.attributes.map((attr) => (
                    <div key={attr.optionGroup.id} className="flex items-start gap-2">
                      <Badge variant="outline">{attr.optionGroup.name}</Badge>
                      <div className="flex flex-wrap gap-1">
                        {attr.usedValues.map((value) => (
                          <Badge key={value.id} variant="secondary" className="text-xs">
                            {value.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Group Settings</CardTitle>
              <CardDescription>Configure settings for this product group</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Settings panel coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product group and all its variants. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProductGroup} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
