# Product Groups Implementation Plan - Part 2

**Continuation of**: PRODUCT_GROUPS_IMPLEMENTATION_PLAN.md

---

## Phase 3: Product Group Creation Form (continued)

### Step 3.3: Create Product Group Dialog Component

**File**: `src/modules/warehouse/products/components/create-product-group-dialog.tsx`

**Purpose**: Main dialog for creating product groups with all sections

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { AttributeSelector } from "./attribute-selector";
import { VariantsBulkEditor } from "./variants-bulk-editor";
import { SKUGeneratorDialog } from "../sku-generator-dialog";

import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { optionGroupsService } from "@/modules/warehouse/api/option-groups-service";
import { unitsService } from "@/modules/warehouse/api/units-service";
import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import { variantGenerationService } from "@/modules/warehouse/api/variant-generation-service";

import type { OptionGroupWithValues } from "@/modules/warehouse/types/option-groups";
import type { UnitOfMeasure } from "@/modules/warehouse/types/units";
import type { SelectedAttribute, GeneratedVariant } from "@/modules/warehouse/types/product-groups";

interface CreateProductGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProductGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProductGroupDialogProps) {
  const t = useTranslations("productGroups");
  const { activeOrgId } = useAppStore();
  const { user } = useUserStore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [optionGroups, setOptionGroups] = React.useState<OptionGroupWithValues[]>([]);
  const [units, setUnits] = React.useState<UnitOfMeasure[]>([]);
  const [selectedAttributes, setSelectedAttributes] = React.useState<SelectedAttribute[]>([]);
  const [generatedVariants, setGeneratedVariants] = React.useState<GeneratedVariant[]>([]);
  const [createAttributes, setCreateAttributes] = React.useState(true);
  const [showSKUGenerator, setShowSKUGenerator] = React.useState(false);

  // Form schema
  const formSchema = z.object({
    name: z.string().min(1, t("validation.nameRequired")),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    brand: z.string().optional(),
    manufacturer: z.string().optional(),
    unit: z.string().min(1, t("validation.unitRequired")),
    returnableItem: z.boolean().default(true),

    // Default prices for all variants
    sellingPrice: z.number().min(0).default(0),
    costPrice: z.number().min(0).default(0),
    reorderPoint: z.number().min(0).default(0),

    // Item type checkboxes
    sellable: z.boolean().default(true),
    purchasable: z.boolean().default(true),
    trackInventory: z.boolean().default(true),

    // Optional fields
    salesAccount: z.string().optional(),
    salesDescription: z.string().optional(),
    purchaseAccount: z.string().optional(),
    purchaseDescription: z.string().optional(),
    preferredVendorId: z.string().optional(),
    inventoryAccount: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "pcs",
      returnableItem: true,
      sellingPrice: 0,
      costPrice: 0,
      reorderPoint: 0,
      sellable: true,
      purchasable: true,
      trackInventory: true,
    },
  });

  // Load option groups and units when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      Promise.all([
        optionGroupsService.getOptionGroups(activeOrgId),
        unitsService.getUnits(activeOrgId),
      ])
        .then(([groups, unitsData]) => {
          setOptionGroups(groups);
          setUnits(unitsData);
        })
        .catch((error) => {
          console.error("Failed to load data:", error);
          toast.error(t("messages.loadError"));
        });
    }
  }, [open, activeOrgId]);

  // Regenerate variants whenever attributes change
  React.useEffect(() => {
    if (!createAttributes || selectedAttributes.length === 0) {
      setGeneratedVariants([]);
      return;
    }

    // Check if all selected attributes have at least one value
    const allHaveValues = selectedAttributes.every(
      attr => attr.selectedValueIds.length > 0
    );

    if (!allHaveValues) {
      setGeneratedVariants([]);
      return;
    }

    const baseName = form.getValues('name') || 'Product';
    const defaultPrices = {
      selling: form.getValues('sellingPrice') || 0,
      cost: form.getValues('costPrice') || 0,
      reorder: form.getValues('reorderPoint') || 0,
    };

    const variants = variantGenerationService.generateVariantCombinations(
      baseName,
      selectedAttributes,
      defaultPrices
    );

    setGeneratedVariants(variants);
  }, [selectedAttributes, createAttributes, form.watch('name')]);

  // Calculate combinations count
  const combinationsCount = React.useMemo(() => {
    return variantGenerationService.calculateCombinationsCount(selectedAttributes);
  }, [selectedAttributes]);

  const handleGenerateSKUs = () => {
    if (selectedAttributes.length === 0) {
      toast.error(t("messages.noAttributesForSKU"));
      return;
    }

    setShowSKUGenerator(true);
  };

  const handleSKUsGenerated = (config: any) => {
    const baseName = form.getValues('name');
    const updatedVariants = variantGenerationService.generateSKUsForAllVariants(
      baseName,
      generatedVariants,
      config
    );
    setGeneratedVariants(updatedVariants);
    setShowSKUGenerator(false);
    toast.success(t("messages.skusGenerated"));
  };

  const onSubmit = async (values: FormValues) => {
    if (!activeOrgId || !user) {
      toast.error(t("messages.missingContext"));
      return;
    }

    // Validation: Must have attributes if createAttributes is checked
    if (createAttributes && selectedAttributes.length === 0) {
      toast.error(t("validation.noAttributes"));
      return;
    }

    // Validation: All attributes must have selected values
    if (createAttributes && selectedAttributes.some(a => a.selectedValueIds.length === 0)) {
      toast.error(t("validation.attributeMissingValues"));
      return;
    }

    // Validation: Must have generated variants
    if (createAttributes && generatedVariants.length === 0) {
      toast.error(t("validation.noVariants"));
      return;
    }

    // Validation: All variants must have SKUs
    if (createAttributes && generatedVariants.some(v => !v.sku || v.sku.trim() === "")) {
      toast.error(t("validation.missingSKUs"));
      return;
    }

    setIsSubmitting(true);

    try {
      const formData: any = {
        name: values.name,
        description: values.description,
        categoryId: values.categoryId,
        brand: values.brand,
        manufacturer: values.manufacturer,
        unit: values.unit,
        returnableItem: values.returnableItem,
        sellingPrice: values.sellingPrice,
        costPrice: values.costPrice,
        reorderPoint: values.reorderPoint,
        salesAccount: values.salesAccount,
        salesDescription: values.salesDescription,
        purchaseAccount: values.purchaseAccount,
        purchaseDescription: values.purchaseDescription,
        preferredVendorId: values.preferredVendorId,
        trackInventory: values.trackInventory,
        inventoryAccount: values.inventoryAccount,
        sellable: values.sellable,
        purchasable: values.purchasable,
        selectedAttributes,
        generatedVariants,
      };

      await productGroupsService.createProductGroup(formData, activeOrgId, user.id);

      toast.success(t("messages.createSuccess"));
      form.reset();
      setSelectedAttributes([]);
      setGeneratedVariants([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating product group:", error);
      toast.error(error.message || t("messages.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createDialog.title")}</DialogTitle>
            <DialogDescription>{t("createDialog.description")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("sections.basicInfo")}</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("fields.name")} *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("placeholders.name")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("fields.description")}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} placeholder={t("placeholders.description")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.unit")} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("placeholders.unit")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit.id} value={unit.name}>
                                {unit.name} {unit.symbol && `(${unit.symbol})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.manufacturer")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.brand")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="returnableItem"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("fields.returnableItem")}</FormLabel>
                          <FormDescription>{t("descriptions.returnableItem")}</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section 2: Default Prices */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("sections.defaultPrices")}</h3>
                <p className="text-sm text-muted-foreground">{t("descriptions.defaultPrices")}</p>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.sellingPrice")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.costPrice")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reorderPoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.reorderPoint")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section 3: Attributes & Variants */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={createAttributes}
                    onCheckedChange={(checked) => setCreateAttributes(checked as boolean)}
                    id="createAttributes"
                  />
                  <Label htmlFor="createAttributes" className="text-sm font-semibold">
                    {t("fields.createAttributes")} *
                  </Label>
                </div>

                {createAttributes && (
                  <>
                    <AttributeSelector
                      availableOptionGroups={optionGroups}
                      selectedAttributes={selectedAttributes}
                      onChange={setSelectedAttributes}
                      maxAttributes={3}
                    />

                    {/* Combinations Preview */}
                    {selectedAttributes.length > 0 && combinationsCount > 0 && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        {t("messages.willCreateVariants", { count: combinationsCount })}
                      </div>
                    )}

                    {/* Variants Table */}
                    {generatedVariants.length > 0 && (
                      <>
                        <Separator />
                        <VariantsBulkEditor
                          variants={generatedVariants}
                          onChange={setGeneratedVariants}
                          onGenerateSKUs={handleGenerateSKUs}
                        />
                      </>
                    )}
                  </>
                )}
              </div>

              <Separator />

              {/* Section 4: Item Type */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("sections.itemType")}</h3>

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="sellable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("fields.sellable")}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchasable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("fields.purchasable")}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trackInventory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("fields.trackInventory")}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {t("actions.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("actions.create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* SKU Generator Dialog */}
      <SKUGeneratorDialog
        open={showSKUGenerator}
        onOpenChange={setShowSKUGenerator}
        baseName={form.getValues('name')}
        attributes={selectedAttributes.map(attr => ({
          name: attr.optionGroup.name,
          sampleValue: attr.optionGroup.values.find(v =>
            attr.selectedValueIds.includes(v.id)
          )?.value || '',
        }))}
        onGenerate={handleSKUsGenerated}
      />
    </>
  );
}
```

**Acceptance Criteria**:

- [ ] Dialog matches Zoho screenshots exactly
- [ ] All sections are properly organized
- [ ] Attributes can be added/removed
- [ ] Variants regenerate when attributes change
- [ ] SKU generator opens and applies patterns
- [ ] Form validation works correctly
- [ ] Submit creates product group with all variants
- [ ] Error handling shows clear messages
- [ ] Loading states during submission

---

## Phase 4: Product Group Detail Page (2 days)

### Step 4.1: Create Product Group Detail Page

**File**: `src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx`

```typescript
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ProductOverviewTab } from "@/modules/warehouse/products/components/product-overview-tab";
import { ProductVariantsTab } from "@/modules/warehouse/products/components/product-variants-tab";
import { ProductStockTab } from "@/modules/warehouse/products/components/product-stock-tab";
import { ProductImagesTab } from "@/modules/warehouse/products/components/product-images-tab";
import { ProductHistoryTab } from "@/modules/warehouse/products/components/product-history-tab";

import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import type { ProductGroupDetail } from "@/modules/warehouse/types/product-groups";

export default function ProductGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("productGroups.detail");

  const productId = params.id as string;

  const [productGroup, setProductGroup] = React.useState<ProductGroupDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadProductGroup = React.useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await productGroupsService.getProductGroupById(productId);
      if (!data) {
        setError(t("errors.notFound"));
        return;
      }
      setProductGroup(data);
    } catch (err: any) {
      console.error("Error loading product group:", err);
      setError(err.message || t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [productId, t]);

  React.useEffect(() => {
    loadProductGroup();
  }, [loadProductGroup]);

  const handleDelete = async () => {
    if (!productGroup) return;

    if (!confirm(t("confirmDelete", { name: productGroup.product.name }))) {
      return;
    }

    try {
      await productGroupsService.deleteProductGroup(productId);
      toast.success(t("messages.deleteSuccess"));
      router.push("/dashboard/warehouse/products");
    } catch (error: any) {
      console.error("Error deleting product group:", error);
      toast.error(error.message || t("messages.deleteError"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !productGroup) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <p className="text-sm text-muted-foreground">{error || t("errors.notFound")}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/warehouse/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("actions.backToList")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/warehouse/products")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold">{productGroup.product.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("variantsSummary", {
              active: productGroup.activeVariants,
              total: productGroup.totalVariants,
            })}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("stats.totalVariants")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.totalVariants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("stats.activeVariants")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.activeVariants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("stats.totalStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productGroup.totalStock}</div>
            <p className="text-xs text-muted-foreground">{productGroup.product.unit}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="variants" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="variants">{t("tabs.variants")}</TabsTrigger>
          <TabsTrigger value="stock">{t("tabs.stock")}</TabsTrigger>
          <TabsTrigger value="images">{t("tabs.images")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ProductOverviewTab product={productGroup.product} />
        </TabsContent>

        <TabsContent value="variants" className="mt-6">
          <ProductVariantsTab
            productId={productId}
            variants={productGroup.variants}
            attributes={productGroup.attributes}
            onUpdate={loadProductGroup}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-6">
          <ProductStockTab productId={productId} variants={productGroup.variants} />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ProductImagesTab productId={productId} variants={productGroup.variants} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ProductHistoryTab productId={productId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Page loads product group with all variants
- [ ] Header shows product name and variant count
- [ ] Quick stats display correct numbers
- [ ] Tabs switch between different views
- [ ] Edit button opens edit dialog (future)
- [ ] Delete button removes product group
- [ ] Back button returns to products list
- [ ] Loading state shows spinner
- [ ] Error state shows message and back button

---

### Step 4.2: Create Product Variants Tab Component

**File**: `src/modules/warehouse/products/components/product-variants-tab.tsx`

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, MoreHorizontal, Package } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { EditVariantDialog } from "./edit-variant-dialog";
import { QuickStockAdjustmentDialog } from "./quick-stock-adjustment-dialog";

import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import type { ProductVariantWithDetails } from "@/modules/warehouse/types/products";

interface ProductVariantsTabProps {
  productId: string;
  variants: ProductVariantWithDetails[];
  attributes: Array<{
    optionGroup: any;
    usedValues: any[];
  }>;
  onUpdate: () => void;
}

export function ProductVariantsTab({
  productId,
  variants,
  attributes,
  onUpdate,
}: ProductVariantsTabProps) {
  const t = useTranslations("productGroups.variantsTab");

  const [selectedVariants, setSelectedVariants] = React.useState<Set<string>>(new Set());
  const [editingVariant, setEditingVariant] = React.useState<ProductVariantWithDetails | null>(null);
  const [adjustingStockVariant, setAdjustingStockVariant] = React.useState<ProductVariantWithDetails | null>(null);
  const [filters, setFilters] = React.useState<Record<string, string>>({});

  // Filter variants based on selected attribute values
  const filteredVariants = React.useMemo(() => {
    return variants.filter(variant => {
      for (const [attrName, valueId] of Object.entries(filters)) {
        if (!valueId || valueId === "all") continue;

        const variantHasValue = (variant as any).attribute_values?.some(
          (av: any) => av.option_value_id === valueId
        );

        if (!variantHasValue) return false;
      }
      return true;
    });
  }, [variants, filters]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVariants(new Set(filteredVariants.map(v => v.id)));
    } else {
      setSelectedVariants(new Set());
    }
  };

  const handleSelectVariant = (variantId: string, checked: boolean) => {
    const newSelected = new Set(selectedVariants);
    if (checked) {
      newSelected.add(variantId);
    } else {
      newSelected.delete(variantId);
    }
    setSelectedVariants(newSelected);
  };

  const handleBulkActivate = async () => {
    if (selectedVariants.size === 0) {
      toast.error(t("messages.noVariantsSelected"));
      return;
    }

    try {
      await productGroupsService.bulkUpdateVariants(
        Array.from(selectedVariants),
        { isActive: true }
      );
      toast.success(t("messages.bulkActivateSuccess"));
      setSelectedVariants(new Set());
      onUpdate();
    } catch (error: any) {
      console.error("Error activating variants:", error);
      toast.error(error.message || t("messages.bulkActivateError"));
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedVariants.size === 0) {
      toast.error(t("messages.noVariantsSelected"));
      return;
    }

    try {
      await productGroupsService.bulkUpdateVariants(
        Array.from(selectedVariants),
        { isActive: false }
      );
      toast.success(t("messages.bulkDeactivateSuccess"));
      setSelectedVariants(new Set());
      onUpdate();
    } catch (error: any) {
      console.error("Error deactivating variants:", error);
      toast.error(error.message || t("messages.bulkDeactivateError"));
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm(t("confirmDelete"))) return;

    try {
      await productGroupsService.deleteVariant(variantId);
      toast.success(t("messages.deleteSuccess"));
      onUpdate();
    } catch (error: any) {
      console.error("Error deleting variant:", error);
      toast.error(error.message || t("messages.deleteError"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {attributes.map(attr => (
          <div key={attr.optionGroup.id} className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">{attr.optionGroup.name}:</span>
            <Select
              value={filters[attr.optionGroup.name] || "all"}
              onValueChange={(value) =>
                setFilters(prev => ({ ...prev, [attr.optionGroup.name]: value }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                {attr.usedValues.map(value => (
                  <SelectItem key={value.id} value={value.id}>
                    {value.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedVariants.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted p-3">
          <span className="text-sm">
            {t("bulkActions.selected", { count: selectedVariants.size })}
          </span>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={handleBulkActivate}>
              {t("bulkActions.activate")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
              {t("bulkActions.deactivate")}
            </Button>
          </div>
        </div>
      )}

      {/* Variants Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredVariants.length > 0 &&
                    filteredVariants.every(v => selectedVariants.has(v.id))
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.sku")}</TableHead>
              <TableHead>{t("columns.price")}</TableHead>
              <TableHead>{t("columns.cost")}</TableHead>
              <TableHead>{t("columns.stock")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVariants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t("noVariants")}
                </TableCell>
              </TableRow>
            ) : (
              filteredVariants.map(variant => (
                <TableRow key={variant.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVariants.has(variant.id)}
                      onCheckedChange={(checked) =>
                        handleSelectVariant(variant.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{variant.name}</TableCell>
                  <TableCell>{variant.sku}</TableCell>
                  <TableCell>${variant.selling_price?.toFixed(2) || "0.00"}</TableCell>
                  <TableCell>${variant.cost_price?.toFixed(2) || "0.00"}</TableCell>
                  <TableCell>
                    {/* TODO: Get actual stock from stock_snapshots */}
                    0
                  </TableCell>
                  <TableCell>
                    {variant.is_active ? (
                      <Badge variant="default">{t("status.active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("status.inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t("actions.title")}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingVariant(variant)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAdjustingStockVariant(variant)}>
                          <Package className="mr-2 h-4 w-4" />
                          {t("actions.adjustStock")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Variant Dialog */}
      <EditVariantDialog
        open={!!editingVariant}
        onOpenChange={(open) => !open && setEditingVariant(null)}
        variant={editingVariant}
        onSuccess={() => {
          setEditingVariant(null);
          onUpdate();
        }}
      />

      {/* Quick Stock Adjustment Dialog */}
      <QuickStockAdjustmentDialog
        open={!!adjustingStockVariant}
        onOpenChange={(open) => !open && setAdjustingStockVariant(null)}
        variant={adjustingStockVariant}
        onSuccess={() => {
          setAdjustingStockVariant(null);
          onUpdate();
        }}
      />
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Table shows all variants with key info
- [ ] Filters work for each attribute
- [ ] Can select/deselect variants (checkboxes)
- [ ] Bulk actions work (activate/deactivate)
- [ ] Individual actions menu opens
- [ ] Edit dialog opens with selected variant
- [ ] Stock adjustment dialog opens
- [ ] Delete confirmation works
- [ ] Changes trigger parent refresh

---

### Step 4.3: Create Edit Variant Dialog

**File**: `src/modules/warehouse/products/components/edit-variant-dialog.tsx`

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import type { ProductVariantWithDetails } from "@/modules/warehouse/types/products";

interface EditVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ProductVariantWithDetails | null;
  onSuccess: () => void;
}

export function EditVariantDialog({
  open,
  onOpenChange,
  variant,
  onSuccess,
}: EditVariantDialogProps) {
  const t = useTranslations("productGroups.editVariant");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const formSchema = z.object({
    sku: z.string().min(1, t("validation.skuRequired")),
    sellingPrice: z.number().min(0),
    costPrice: z.number().min(0),
    reorderPoint: z.number().min(0),
    upc: z.string().optional(),
    ean: z.string().optional(),
    isbn: z.string().optional(),
    isActive: z.boolean(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      sellingPrice: 0,
      costPrice: 0,
      reorderPoint: 0,
      upc: "",
      ean: "",
      isbn: "",
      isActive: true,
    },
  });

  // Populate form when variant changes
  React.useEffect(() => {
    if (variant && open) {
      form.reset({
        sku: variant.sku,
        sellingPrice: variant.selling_price || 0,
        costPrice: variant.cost_price || 0,
        reorderPoint: variant.reorder_point || 0,
        upc: variant.upc || "",
        ean: variant.ean || "",
        isbn: variant.isbn || "",
        isActive: variant.is_active,
      });
    }
  }, [variant, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (!variant) return;

    setIsSubmitting(true);

    try {
      await productGroupsService.updateVariant(variant.id, {
        sku: values.sku,
        sellingPrice: values.sellingPrice,
        costPrice: values.costPrice,
        reorderPoint: values.reorderPoint,
        upc: values.upc,
        ean: values.ean,
        isbn: values.isbn,
        isActive: values.isActive,
      });

      toast.success(t("messages.updateSuccess"));
      onSuccess();
    } catch (error: any) {
      console.error("Error updating variant:", error);
      toast.error(error.message || t("messages.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {variant?.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.sku")} *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.sellingPrice")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.costPrice")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reorderPoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.reorderPoint")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>{t("sections.identifiers")}</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="upc"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} placeholder="UPC" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ean"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} placeholder="EAN" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isbn"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} placeholder="ISBN" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t("fields.isActive")}</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria**:

- [ ] Dialog opens with variant data pre-filled
- [ ] Can edit SKU, prices, identifiers
- [ ] Can toggle active status
- [ ] Form validation works
- [ ] Save updates variant in database
- [ ] Success message shows and dialog closes
- [ ] Parent component refreshes data

---

### Step 4.4: Create Quick Stock Adjustment Dialog

**File**: `src/modules/warehouse/products/components/quick-stock-adjustment-dialog.tsx`

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2, Plus, Minus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import type { ProductVariantWithDetails } from "@/modules/warehouse/types/products";

interface QuickStockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ProductVariantWithDetails | null;
  onSuccess: () => void;
}

export function QuickStockAdjustmentDialog({
  open,
  onOpenChange,
  variant,
  onSuccess,
}: QuickStockAdjustmentDialogProps) {
  const t = useTranslations("productGroups.stockAdjustment");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const formSchema = z.object({
    adjustmentType: z.enum(["increase", "decrease"]),
    quantity: z.number().min(1, t("validation.quantityMin")),
    reason: z.string().min(1, t("validation.reasonRequired")),
    notes: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adjustmentType: "increase",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!variant) return;

    setIsSubmitting(true);

    try {
      await productGroupsService.adjustVariantStock({
        variantId: variant.id,
        quantity: values.quantity,
        adjustmentType: values.adjustmentType,
        reason: values.reason as any,
        notes: values.notes,
      });

      toast.success(t("messages.adjustSuccess"));
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Error adjusting stock:", error);
      toast.error(error.message || t("messages.adjustError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {variant?.name} • {t("currentStock")}: {/* TODO: Get actual stock */} 0
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="adjustmentType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t("fields.adjustmentType")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="increase" id="increase" />
                        <label htmlFor="increase" className="flex items-center cursor-pointer">
                          <Plus className="mr-1 h-4 w-4 text-green-600" />
                          {t("types.increase")}
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="decrease" id="decrease" />
                        <label htmlFor="decrease" className="flex items-center cursor-pointer">
                          <Minus className="mr-1 h-4 w-4 text-red-600" />
                          {t("types.decrease")}
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.quantity")} *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.reason")} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("placeholders.selectReason")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="purchase">{t("reasons.purchase")}</SelectItem>
                      <SelectItem value="sale">{t("reasons.sale")}</SelectItem>
                      <SelectItem value="adjustment_positive">
                        {t("reasons.adjustmentPositive")}
                      </SelectItem>
                      <SelectItem value="adjustment_negative">
                        {t("reasons.adjustmentNegative")}
                      </SelectItem>
                      <SelectItem value="damaged">{t("reasons.damaged")}</SelectItem>
                      <SelectItem value="found">{t("reasons.found")}</SelectItem>
                      <SelectItem value="transfer">{t("reasons.transfer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.notes")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder={t("placeholders.notes")} />
                  </FormControl>
                  <FormDescription>{t("descriptions.notes")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("actions.adjust")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria**:

- [ ] Dialog shows variant name and current stock
- [ ] Can select increase/decrease
- [ ] Can enter quantity
- [ ] Can select reason from dropdown
- [ ] Can add notes
- [ ] Form validates before submit
- [ ] Creates stock movement and updates snapshot
- [ ] Success message shows and dialog closes

---

## Phase 5: Products List Integration (0.5 day)

### Step 5.1: Add "Create Product Group" Button

**File**: `src/app/[locale]/dashboard/warehouse/products/page.tsx`

**Changes**:

```typescript
// Add state for product group dialog
const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = React.useState(false);

// Import the dialog
import { CreateProductGroupDialog } from "@/modules/warehouse/products/components/create-product-group-dialog";

// In the JSX, add button next to existing "Create Product" button:
<div className="flex items-center space-x-2">
  <Button onClick={handleAdd}>
    <Plus className="mr-2 h-4 w-4" />
    Create Product
  </Button>
  <Button onClick={() => setIsCreateGroupDialogOpen(true)} variant="outline">
    <Grid3x3 className="mr-2 h-4 w-4" />
    Create Product Group
  </Button>
</div>

// Add the dialog component:
<CreateProductGroupDialog
  open={isCreateGroupDialogOpen}
  onOpenChange={setIsCreateGroupDialogOpen}
  onSuccess={loadProducts}
/>
```

**Acceptance Criteria**:

- [ ] "Create Product Group" button appears next to "Create Product"
- [ ] Clicking button opens product group dialog
- [ ] Success creates group and refreshes list
- [ ] Product groups appear in list with variant count badge

---

### Step 5.2: Update Product List Components

**Files to Modify**:

- `simple-product-card.tsx`
- `simple-product-list.tsx`
- `simple-product-table.tsx`

**Changes for Product Groups**:

```typescript
// In each component, add logic to detect product_type = 'item_group'
// Show variant count badge:
{product.product_type === 'item_group' && (
  <Badge variant="secondary">
    {product.variants?.length || 0} variants
  </Badge>
)}

// Show aggregate stock for groups:
{product.product_type === 'item_group' ? (
  <span>
    {/* TODO: Calculate total stock across variants */}
    View variants
  </span>
) : (
  <span>{product.opening_stock} {product.unit}</span>
)}

// Link to detail page:
<Link href={`/dashboard/warehouse/products/${product.id}`}>
  {product.name}
</Link>
```

**Acceptance Criteria**:

- [ ] Product groups show "X variants" badge
- [ ] Clicking product group opens detail page
- [ ] Stock display differentiates between simple products and groups
- [ ] Card/list/table views all handle product groups correctly

---

## Phase 6: Testing & Validation (1 day)

### Test Scenarios

#### Scenario 1: Create Simple Product Group

1. Open "Create Product Group" dialog
2. Enter name: "Test T-Shirt"
3. Add Color attribute: Red, Blue, Green
4. Add Size attribute: S, M, L, XL
5. Check preview: "This will create 12 variants"
6. Click "Generate SKUs"
7. Configure: First 3 chars, Upper case, separator "-"
8. Preview shows: "TES-RED-S"
9. Generate SKUs for all variants
10. Set selling price: $19.99, Click "Copy to All"
11. Save product group
12. Verify: 1 product + 12 variants created in database
13. Verify: Product group appears in list with "12 variants" badge

**Expected Result**: ✅ Product group created with 12 variants, all with SKUs and prices

---

#### Scenario 2: Edit Individual Variant

1. Open product group "Test T-Shirt"
2. Go to Variants tab
3. Click on "Test T-Shirt-Red-Small"
4. Click "Edit" from actions menu
5. Change SKU to "TSHIRT-RED-SM-CUSTOM"
6. Change selling price to $17.99
7. Save
8. Verify: Variant updated in table
9. Verify: Database reflects changes

**Expected Result**: ✅ Variant updated correctly

---

#### Scenario 3: Bulk Activate/Deactivate

1. Open product group detail page
2. Go to Variants tab
3. Select 5 variants (checkboxes)
4. Click "Deactivate" in bulk actions toolbar
5. Verify: Selected variants now show "Inactive" badge
6. Select those same 5 variants again
7. Click "Activate"
8. Verify: Variants now show "Active" badge again

**Expected Result**: ✅ Bulk status changes work

---

#### Scenario 4: Filter Variants by Attribute

1. Open product group with Color and Size attributes
2. In Variants tab, select Color filter: "Red"
3. Verify: Only red variants show in table
4. Select Size filter: "Large"
5. Verify: Only "Red-Large" variant shows
6. Reset filters to "All"
7. Verify: All variants show again

**Expected Result**: ✅ Filtering works correctly

---

#### Scenario 5: Delete Variant

1. Open product group
2. Go to Variants tab
3. Click actions menu for a variant
4. Click "Delete"
5. Confirm deletion
6. Verify: Variant removed from table
7. Verify: Variant count decreases by 1
8. Verify: Database has deleted_at timestamp

**Expected Result**: ✅ Variant soft-deleted

---

#### Scenario 6: SKU Uniqueness Validation

1. Create product group
2. Generate SKUs
3. Manually change one SKU to match an existing SKU in database
4. Try to save
5. Verify: Error message shows "SKU already exists"
6. Change to unique SKU
7. Save
8. Verify: Success

**Expected Result**: ✅ Duplicate SKUs prevented

---

#### Scenario 7: Edge Case - Large Variant Set

1. Create product group with 3 attributes:
   - Color: 5 values
   - Size: 4 values
   - Material: 3 values
2. Check preview: "This will create 60 variants"
3. Generate SKUs and save
4. Verify: All 60 variants created
5. Open product group detail
6. Verify: Variants table loads with pagination (if > 50)
7. Verify: Performance is acceptable

**Expected Result**: ✅ Large variant sets handled correctly

---

#### Scenario 8: Empty Attributes Validation

1. Open "Create Product Group" dialog
2. Check "Create Attributes and Options"
3. Add Color attribute but don't select any values
4. Try to save
5. Verify: Error message "Please select at least one value for each attribute"
6. Select values
7. Save
8. Verify: Success

**Expected Result**: ✅ Validation prevents incomplete attributes

---

## Success Criteria Checklist

### ✅ Functionality

- [ ] Can create product group with 1-3 attributes
- [ ] Automatically generates all variant combinations (Cartesian product)
- [ ] SKU generator works with configurable patterns
- [ ] "Copy to All" applies values to all variants in bulk
- [ ] Inline editing in variants table works
- [ ] Product group detail page loads with all tabs
- [ ] Can edit individual variants
- [ ] Stock adjustment dialog works per variant
- [ ] Bulk operations work (activate/deactivate, delete)
- [ ] Products list shows variant count for groups
- [ ] Filters work in variants tab

### ✅ Data Integrity

- [ ] No duplicate SKUs allowed (validation on save)
- [ ] Transactions ensure atomicity (all or nothing on create)
- [ ] Soft deletes set deleted_at timestamp correctly
- [ ] Stock movements create corresponding snapshots
- [ ] Variant attribute values map correctly to option values
- [ ] Foreign key relationships maintained
- [ ] Rollback works if any part of transaction fails

### ✅ UX/UI

- [ ] UI matches Zoho screenshots exactly
- [ ] Inline editing is smooth and intuitive
- [ ] Loading states show during async operations
- [ ] Error messages are clear and actionable
- [ ] Mobile-responsive design works on small screens
- [ ] Tab navigation works in editable tables
- [ ] Keyboard shortcuts work (Enter to save, Esc to cancel)
- [ ] Toast notifications show for all operations
- [ ] Dialogs close after successful submission
- [ ] Forms reset after save

### ✅ Performance

- [ ] Can generate 100+ variants without UI lag
- [ ] Table pagination works for large variant sets
- [ ] Bulk operations complete in <2 seconds
- [ ] No UI freezing during generation
- [ ] Lazy loading for images and stock data
- [ ] Optimistic UI updates where appropriate

### ✅ Code Quality

- [ ] All TypeScript types are properly defined
- [ ] No `any` types except where necessary
- [ ] Services follow consistent patterns
- [ ] Components are properly decomposed
- [ ] Error handling is comprehensive
- [ ] Console has no errors or warnings
- [ ] Code is formatted with Prettier
- [ ] ESLint passes with no errors

---

## Implementation Timeline

| Phase       | Description                                                                    | Duration          | Days    |
| ----------- | ------------------------------------------------------------------------------ | ----------------- | ------- |
| **Phase 1** | Core Infrastructure (types, services, algorithms)                              | 1-2 days          | 2       |
| **Phase 2** | SKU Generator Tool (store, dialog, preview)                                    | 1 day             | 1       |
| **Phase 3** | Product Group Creation Form (main dialog, attributes selector, variants table) | 2-3 days          | 3       |
| **Phase 4** | Product Group Detail Page (tabs, variants management, edit/stock dialogs)      | 2 days            | 2       |
| **Phase 5** | Products List Integration (button, badges, linking)                            | 0.5 day           | 0.5     |
| **Phase 6** | Testing & Polish (comprehensive testing, bug fixes, UX improvements)           | 1 day             | 1       |
| **Total**   |                                                                                | **8.5-10.5 days** | **9.5** |

---

## Next Steps After Implementation

1. ✅ **Complete testing** with real data in development environment
2. ✅ **User acceptance testing** with actual warehouse staff
3. ✅ **Gather feedback** on workflow and UI
4. ✅ **Deploy to production** after all tests pass
5. 🔮 **Future enhancements**:
   - Variant-specific images
   - CSV import/export for bulk variant creation
   - Variant templates (save attribute combinations for reuse)
   - Advanced SKU generator with custom patterns
   - Stock transfer between variant locations
   - Analytics dashboard for best-selling variants

---

## Document Maintenance

- **Version**: 1.0
- **Last Updated**: 2025-10-20
- **Status**: Ready for Implementation
- **Related Documents**:
  - [PRODUCT_QUICK_START_PLAN.md](./PRODUCT_QUICK_START_PLAN.md)
  - [PRODUCT_SYSTEM_ENHANCEMENT_PLAN.md](./PRODUCT_SYSTEM_ENHANCEMENT_PLAN.md)

---

**End of Implementation Plan Part 2**

For the complete plan, refer to both:

1. PRODUCT_GROUPS_IMPLEMENTATION_PLAN.md (Part 1)
2. PRODUCT_GROUPS_IMPLEMENTATION_PLAN_PART2.md (Part 2)
