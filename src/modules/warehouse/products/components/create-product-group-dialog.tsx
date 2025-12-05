"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2, Info } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AttributeSelector } from "./attribute-selector";
import { VariantsBulkEditor } from "./variants-bulk-editor";
import { SKUGeneratorDialog } from "../../components/sku-generator-dialog";

import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { unitsService } from "../../api/units-service";

import type { OptionGroupWithValues } from "../../types/option-groups";
import type { UnitOfMeasure } from "../../types/units";
import type { SelectedAttribute, GeneratedVariant } from "../../types/product-groups";

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
  const tProducts = useTranslations("productsModule");
  const { activeOrgId } = useAppStore();
  const { user } = useUserStore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [optionGroups, setOptionGroups] = React.useState<OptionGroupWithValues[]>([]);
  const [units, setUnits] = React.useState<UnitOfMeasure[]>([]);
  const [selectedAttributes, setSelectedAttributes] = React.useState<SelectedAttribute[]>([]);
  const [generatedVariants, setGeneratedVariants] = React.useState<GeneratedVariant[]>([]);
  const [showSKUGenerator, setShowSKUGenerator] = React.useState(false);
  const [currentTab, setCurrentTab] = React.useState("basic");

  // Form schema
  const formSchema = z.object({
    name: z.string().min(1, tProducts("messages.nameRequired")),
    description: z.string().optional(),
    unit: z.string().min(1, tProducts("messages.unitRequired")),
    brand: z.string().optional(),
    manufacturer: z.string().optional(),
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
    inventoryAccount: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "",
      returnableItem: true,
      sellingPrice: 0,
      costPrice: 0,
      reorderPoint: 10,
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
  }, [open, activeOrgId, t]);

  // Watch form values for variant regeneration
  const productName = form.watch("name");
  const sellingPrice = form.watch("sellingPrice");
  const costPrice = form.watch("costPrice");
  const reorderPoint = form.watch("reorderPoint");

  // Regenerate variants whenever attributes or default prices change
  React.useEffect(() => {
    if (selectedAttributes.length === 0) {
      setGeneratedVariants([]);
      return;
    }

    // Check if all selected attributes have at least one value
    const allHaveValues = selectedAttributes.every((attr) => attr.selectedValueIds.length > 0);

    if (!allHaveValues) {
      setGeneratedVariants([]);
      return;
    }

    const baseName = productName || "Product";
    const defaultPrices = {
      selling: sellingPrice || 0,
      cost: costPrice || 0,
      reorder: reorderPoint || 10,
    };

    const variants = variantGenerationService.generateVariantCombinations(
      baseName,
      selectedAttributes,
      defaultPrices
    );

    setGeneratedVariants(variants);
  }, [selectedAttributes, productName, sellingPrice, costPrice, reorderPoint]);

  // Calculate combinations count
  const combinationsCount = React.useMemo(() => {
    return variantGenerationService.calculateCombinationsCount(selectedAttributes);
  }, [selectedAttributes]);

  const handleGenerateSKUs = () => {
    if (selectedAttributes.length === 0) {
      toast.error("Please select attributes first");
      return;
    }
    setShowSKUGenerator(true);
  };

  const handleApplySKUs = (updatedVariants: GeneratedVariant[]) => {
    setGeneratedVariants(updatedVariants);
    toast.success("SKU pattern applied successfully");
  };

  const handleSubmit = async (values: FormValues) => {
    if (!activeOrgId || !user) {
      toast.error("Organization or user not found");
      return;
    }

    if (selectedAttributes.length === 0) {
      toast.error(t("messages.attributesRequired"));
      return;
    }

    if (generatedVariants.length === 0) {
      toast.error(t("messages.variantsRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const productGroupData: any = {
        ...values,
        selectedAttributes,
        generatedVariants,
      };

      await productGroupsService.createProductGroup(productGroupData, activeOrgId, user.id);

      toast.success(t("messages.productGroupCreated"));
      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Reset form
      form.reset();
      setSelectedAttributes([]);
      setGeneratedVariants([]);
      setCurrentTab("basic");
    } catch (error) {
      console.error("Failed to create product group:", error);
      toast.error(t("messages.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      setSelectedAttributes([]);
      setGeneratedVariants([]);
      setCurrentTab("basic");
      onOpenChange(false);
    }
  };

  // Get sample attributes for SKU generator
  const sampleAttributes = React.useMemo(() => {
    if (selectedAttributes.length === 0 || generatedVariants.length === 0) return [];

    return selectedAttributes.map((attr) => ({
      name: attr.optionGroup.name,
      sampleValue:
        attr.optionGroup.values.find((v) => attr.selectedValueIds.includes(v.id))?.value || "",
    }));
  }, [selectedAttributes, generatedVariants]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createProductGroup")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <Tabs value={currentTab} onValueChange={setCurrentTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">{tProducts("tabs.basic")}</TabsTrigger>
                  <TabsTrigger value="attributes">
                    {t("attributes.title")}{" "}
                    {selectedAttributes.length > 0 && `(${selectedAttributes.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="variants">
                    {t("variantsTable.title")}{" "}
                    {generatedVariants.length > 0 && `(${generatedVariants.length})`}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="mt-4 space-y-4">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{tProducts("basicInfo.name")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={tProducts("basicInfo.namePlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{tProducts("basicInfo.description")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={tProducts("basicInfo.descriptionPlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tProducts("basicInfo.unit")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={tProducts("basicInfo.selectUnit")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {units.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.id}>
                                    {unit.name} ({unit.symbol})
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
                        name="brand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tProducts("basicInfo.brand")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={tProducts("basicInfo.brandPlaceholder")}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Default Pricing for All Variants */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Default Pricing for All Variants</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="sellingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{tProducts("salesInfo.sellingPrice")}</FormLabel>
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
                              <FormLabel>{tProducts("purchaseInfo.costPrice")}</FormLabel>
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
                              <FormLabel>{tProducts("inventorySettings.reorderPoint")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Item Type Checkboxes */}
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
                              <FormLabel>Sellable Item</FormLabel>
                              <FormDescription>This item can be sold to customers</FormDescription>
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
                              <FormLabel>Purchasable Item</FormLabel>
                              <FormDescription>
                                This item can be purchased from suppliers
                              </FormDescription>
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
                              <FormLabel>{tProducts("inventorySettings.trackInventory")}</FormLabel>
                              <FormDescription>Track stock levels for all variants</FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="returnableItem"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{tProducts("basicInfo.returnableItem")}</FormLabel>
                              <FormDescription>
                                {tProducts("basicInfo.returnableItemDescription")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="attributes" className="mt-4">
                  <AttributeSelector
                    availableAttributes={optionGroups}
                    selectedAttributes={selectedAttributes}
                    onAttributesChange={setSelectedAttributes}
                    maxAttributes={3}
                  />

                  {combinationsCount > 0 && (
                    <Alert className="mt-4">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {t("variantGeneration.variantsWillBeGenerated", {
                          count: combinationsCount,
                        })}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="variants" className="mt-4">
                  <VariantsBulkEditor
                    variants={generatedVariants}
                    onVariantsChange={setGeneratedVariants}
                    onOpenSKUGenerator={handleGenerateSKUs}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  {tProducts("actions.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting || generatedVariants.length === 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tProducts("actions.save")}
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
        baseName={form.watch("name") || "Product"}
        attributes={sampleAttributes}
        variants={generatedVariants}
        onApply={handleApplySKUs}
      />
    </>
  );
}
