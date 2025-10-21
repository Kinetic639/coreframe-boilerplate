"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2, Plus } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Card, CardContent } from "@/components/ui/card";

import { productsService } from "@/modules/warehouse/api/products-service";
import { unitsService } from "@/modules/warehouse/api/units-service";
import { categoriesService } from "@/modules/warehouse/api/categories-service";
import { customFieldsService } from "@/modules/warehouse/api/custom-fields-service";
import type {
  CreateProductFormData,
  UpdateProductFormData,
  ProductWithDetails,
} from "@/modules/warehouse/types/products";
import type { UnitOfMeasure } from "@/modules/warehouse/types/units";
import type { CategoryTreeItem } from "@/modules/warehouse/types/categories";
import type { CustomFieldDefinitionWithValues } from "@/modules/warehouse/types/custom-fields";
import { CustomFieldsRenderer } from "@/modules/warehouse/products/components/custom-fields-renderer";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  product?: ProductWithDetails | null;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  onSuccess,
  product,
}: CreateProductDialogProps) {
  const t = useTranslations("productsModule");
  const { activeOrgId } = useAppStore();
  const { user } = useUserStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [barcodes, setBarcodes] = React.useState<Array<{ barcode: string; is_primary: boolean }>>(
    []
  );
  const [units, setUnits] = React.useState<UnitOfMeasure[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryTreeItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(false);

  // All available custom field definitions for the organization
  const [allCustomFieldDefinitions, setAllCustomFieldDefinitions] = React.useState<
    CustomFieldDefinitionWithValues[]
  >([]);
  // Custom fields currently selected/rendered for this product
  const [selectedCustomFieldDefinitions, setSelectedCustomFieldDefinitions] = React.useState<
    CustomFieldDefinitionWithValues[]
  >([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, any>>({});

  // Load ALL custom field definitions when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      customFieldsService
        .getFieldDefinitions(activeOrgId)
        .then(setAllCustomFieldDefinitions)
        .catch((error) => {
          console.error("Failed to load all custom field definitions:", error);
        });
    }
  }, [open, activeOrgId]);

  // Load custom field values and set selected definitions when editing
  React.useEffect(() => {
    if (open && product?.id && allCustomFieldDefinitions.length > 0) {
      customFieldsService
        .getProductFieldValues(product.id)
        .then((values) => {
          const valueMap: Record<string, any> = {};
          const definitionsToSelect: CustomFieldDefinitionWithValues[] = [];

          values.forEach((v) => {
            const value = v.value_text ?? v.value_boolean ?? v.value_date ?? v.value_number ?? null;
            valueMap[v.field_definition_id] = value;

            const def = allCustomFieldDefinitions.find((d) => d.id === v.field_definition_id);
            if (def) {
              definitionsToSelect.push(def);
            }
          });
          setCustomFieldValues(valueMap);
          setSelectedCustomFieldDefinitions(definitionsToSelect);
        })
        .catch((error) => {
          console.error("Failed to load custom field values:", error);
          setCustomFieldValues({});
          setSelectedCustomFieldDefinitions([]);
        });
    } else if (!product && open) {
      // For new products, start with no custom fields selected
      setCustomFieldValues({});
      setSelectedCustomFieldDefinitions([]);
    }
  }, [open, product, allCustomFieldDefinitions]); // Depend on allCustomFieldDefinitions to ensure it's loaded

  // Form schema
  const formSchema = z.object({
    product_type: z.enum(["goods", "service"] as const),
    name: z.string().min(1, t("messages.nameRequired")),
    sku: z.string().optional(),
    description: z.string().optional(),
    category_id: z.string().optional(),
    brand: z.string().optional(),
    manufacturer: z.string().optional(),
    unit: z.string().min(1, t("messages.unitRequired")),
    returnable_item: z.boolean().default(true),

    // Measurements - all optional
    dimensions_length: z.number().optional(),
    dimensions_width: z.number().optional(),
    dimensions_height: z.number().optional(),
    dimensions_unit: z.string().optional(),
    weight: z.number().optional(),
    weight_unit: z.string().optional(),

    // Identifiers - all optional
    upc: z.string().optional(),
    ean: z.string().optional(),
    isbn: z.string().optional(),
    mpn: z.string().optional(),

    // Sales Information
    selling_price: z.number().min(0).default(0),
    sales_account: z.string().optional(),
    sales_description: z.string().optional(),

    // Purchase Information
    cost_price: z.number().min(0).default(0),
    purchase_account: z.string().optional(),
    purchase_description: z.string().optional(),
    preferred_vendor_id: z.string().optional(),

    // Inventory Settings
    track_inventory: z.boolean().default(true),
    inventory_account: z.string().optional(),
    reorder_point: z.number().min(0).default(0),
    opening_stock: z.number().min(0).default(0),
    opening_stock_rate: z.number().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_type: "goods",
      name: "",
      sku: "",
      description: "",
      unit: "pcs",
      returnable_item: true,
      selling_price: 0,
      cost_price: 0,
      track_inventory: true,
      reorder_point: 0,
      opening_stock: 0,
    },
  });

  const isEditMode = !!product;

  // Load units when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      setIsLoadingUnits(true);
      unitsService
        .getUnits(activeOrgId)
        .then(setUnits)
        .catch((error) => {
          console.error("Failed to load units:", error);
          toast.error("Failed to load units of measure");
        })
        .finally(() => setIsLoadingUnits(false));
    }
  }, [open, activeOrgId]);

  // Load categories when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      setIsLoadingCategories(true);
      categoriesService
        .getCategories(activeOrgId)
        .then(setCategories)
        .catch((error) => {
          console.error("Failed to load categories:", error);
          toast.error("Failed to load categories");
        })
        .finally(() => setIsLoadingCategories(false));
    }
  }, [open, activeOrgId]);

  // Load custom fields when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      customFieldsService
        .getFieldDefinitions(activeOrgId)
        .then(setCustomFields)
        .catch((error) => {
          console.error("Failed to load custom fields:", error);
        });
    }
  }, [open, activeOrgId]);

  // Load custom field values when editing
  React.useEffect(() => {
    if (open && product?.id) {
      customFieldsService
        .getProductFieldValues(product.id)
        .then((values) => {
          const valueMap: Record<string, any> = {};
          values.forEach((v) => {
            const value = v.value_text ?? v.value_boolean ?? v.value_date ?? v.value_number ?? null;
            valueMap[v.field_definition_id] = value;
          });
          setCustomFieldValues(valueMap);
        })
        .catch((error) => {
          console.error("Failed to load custom field values:", error);
        });
    } else {
      setCustomFieldValues({});
    }
  }, [open, product?.id]);

  // Populate form when editing
  React.useEffect(() => {
    if (product && open) {
      // Only allow editing goods and service products (not item_group)
      const product_type =
        product.product_type === "goods" || product.product_type === "service"
          ? product.product_type
          : "goods";

      form.reset({
        product_type,
        name: product.name,
        sku: product.sku || "",
        description: product.description || "",
        category_id: product.category_id || "",
        brand: product.brand || "",
        manufacturer: product.manufacturer || "",
        unit: product.unit,
        returnable_item: product.returnable_item,
        dimensions_length: product.dimensions_length || undefined,
        dimensions_width: product.dimensions_width || undefined,
        dimensions_height: product.dimensions_height || undefined,
        dimensions_unit: product.dimensions_unit || "",
        weight: product.weight || undefined,
        weight_unit: product.weight_unit || "",
        upc: product.upc || "",
        ean: product.ean || "",
        isbn: product.isbn || "",
        mpn: product.mpn || "",
        selling_price: product.selling_price || 0,
        sales_account: product.sales_account || "",
        sales_description: product.sales_description || "",
        cost_price: product.cost_price || 0,
        purchase_account: product.purchase_account || "",
        purchase_description: product.purchase_description || "",
        preferred_vendor_id: product.preferred_vendor_id || "",
        track_inventory: product.track_inventory,
        inventory_account: product.inventory_account || "",
        reorder_point: product.reorder_point || 0,
        opening_stock: product.opening_stock || 0,
        opening_stock_rate: product.opening_stock_rate || undefined,
      });
      setBarcodes(product.barcodes || []);
    } else if (!product && open) {
      form.reset();
      setBarcodes([]);
    }
  }, [product, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (!activeOrgId) {
      toast.error(t("messages.organizationRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure product_type is set (it's always set in the form, but TypeScript needs this)
      const productData: CreateProductFormData = {
        product_type: values.product_type,
        name: values.name,
        unit: values.unit,
        returnable_item: values.returnable_item,
        selling_price: values.selling_price,
        cost_price: values.cost_price,
        track_inventory: values.track_inventory,
        reorder_point: values.reorder_point,
        opening_stock: values.opening_stock,
        ...(values.sku && { sku: values.sku }),
        ...(values.description && { description: values.description }),
        ...(values.category_id && { category_id: values.category_id }),
        ...(values.brand && { brand: values.brand }),
        ...(values.manufacturer && { manufacturer: values.manufacturer }),
        ...(values.dimensions_length && { dimensions_length: values.dimensions_length }),
        ...(values.dimensions_width && { dimensions_width: values.dimensions_width }),
        ...(values.dimensions_height && { dimensions_height: values.dimensions_height }),
        ...(values.dimensions_unit && { dimensions_unit: values.dimensions_unit }),
        ...(values.weight && { weight: values.weight }),
        ...(values.weight_unit && { weight_unit: values.weight_unit }),
        ...(values.upc && { upc: values.upc }),
        ...(values.ean && { ean: values.ean }),
        ...(values.isbn && { isbn: values.isbn }),
        ...(values.mpn && { mpn: values.mpn }),
        ...(values.sales_account && { sales_account: values.sales_account }),
        ...(values.sales_description && { sales_description: values.sales_description }),
        ...(values.purchase_account && { purchase_account: values.purchase_account }),
        ...(values.purchase_description && { purchase_description: values.purchase_description }),
        ...(values.preferred_vendor_id && { preferred_vendor_id: values.preferred_vendor_id }),
        ...(values.inventory_account && { inventory_account: values.inventory_account }),
        ...(values.opening_stock_rate && { opening_stock_rate: values.opening_stock_rate }),
        ...(barcodes.length > 0 && { barcodes }),
      };

      let productId: string;

      if (isEditMode && product) {
        // Update existing product
        const updateData: UpdateProductFormData = {
          id: product.id,
          ...productData,
        };
        await productsService.updateProduct(product.id, updateData);
        productId = product.id;
        toast.success(t("messages.updateSuccess"));
      } else {
        // Create new product
        const createdProduct = await productsService.createProduct(
          productData,
          activeOrgId,
          user?.id || ""
        );
        productId = createdProduct.id;
        toast.success(t("messages.productCreated"));
      }

      // Save custom field values
      if (Object.keys(customFieldValues).length > 0) {
        try {
          const savePromises = Object.entries(customFieldValues).map(([fieldId, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              return customFieldsService.setFieldValue({
                product_id: productId,
                field_definition_id: fieldId,
                value,
              });
            }
            return Promise.resolve();
          });
          await Promise.all(savePromises);
        } catch (error) {
          console.error("Failed to save custom field values:", error);
          // Don't show error to user as main product was saved successfully
        }
      }

      form.reset();
      setBarcodes([]);
      setCustomFieldValues({});
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} product:`, error);
      toast.error(isEditMode ? t("messages.updateError") : t("messages.productCreationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBarcode = () => {
    setBarcodes([...barcodes, { barcode: "", is_primary: barcodes.length === 0 }]);
  };

  const handleRemoveBarcode = (index: number) => {
    const newBarcodes = barcodes.filter((_, i) => i !== index);
    // If we removed the primary barcode and there are others, make the first one primary
    if (barcodes[index].is_primary && newBarcodes.length > 0) {
      newBarcodes[0].is_primary = true;
    }
    setBarcodes(newBarcodes);
  };

  const handleBarcodeChange = (index: number, value: string) => {
    const newBarcodes = [...barcodes];
    newBarcodes[index].barcode = value;
    setBarcodes(newBarcodes);
  };

  const handleSetPrimaryBarcode = (index: number) => {
    const newBarcodes = barcodes.map((b, i) => ({
      ...b,
      is_primary: i === index,
    }));
    setBarcodes(newBarcodes);
  };

  const handleRemoveCustomField = async (fieldId: string) => {
    if (!isEditMode || !product?.id) {
      toast.error(t("messages.cannotRemoveCustomField"));
      return;
    }

    try {
      // Find the custom field value ID to delete
      const fieldValueToDelete = product.custom_field_values?.find(
        (fv) => fv.field_definition_id === fieldId
      );

      if (fieldValueToDelete) {
        await customFieldsService.deleteFieldValue(fieldValueToDelete.id);
        toast.success(t("messages.customFieldRemoved"));
        // Update local state
        setCustomFieldValues((prev) => {
          const newState = { ...prev };
          delete newState[fieldId];
          return newState;
        });
        setSelectedCustomFieldDefinitions((prev) => prev.filter((def) => def.id !== fieldId));
        // Also update the product object to reflect the change immediately
        if (product.custom_field_values) {
          product.custom_field_values = product.custom_field_values.filter(
            (fv) => fv.field_definition_id !== fieldId
          );
        }
      } else {
        // If it's a new field that hasn't been saved yet, just remove from state
        setCustomFieldValues((prev) => {
          const newState = { ...prev };
          delete newState[fieldId];
          return newState;
        });
        setSelectedCustomFieldDefinitions((prev) => prev.filter((def) => def.id !== fieldId));
      }
    } catch (error) {
      console.error("Failed to remove custom field value:", error);
      toast.error(t("messages.customFieldRemoveFailed"));
    }
  };

  const renderCategoryOptions = (categories: CategoryTreeItem[], level = 0): React.ReactNode[] => {
    let options: React.ReactNode[] = [];
    for (const category of categories) {
      options.push(
        <SelectItem key={category.id} value={category.id}>
          <span style={{ paddingLeft: `${level * 1.5}rem` }}>{category.name}</span>
        </SelectItem>
      );
      if (category.children && category.children.length > 0) {
        options = options.concat(renderCategoryOptions(category.children, level + 1));
      }
    }
    return options;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t("editProduct") : t("createProduct")}</DialogTitle>
          <DialogDescription>{t("basicInfo.productTypeDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Product Type Selection */}
            <FormField
              control={form.control}
              name="product_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("basicInfo.productType")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <Card className={field.value === "goods" ? "border-primary" : ""}>
                        <CardContent className="p-4">
                          <RadioGroupItem value="goods" id="goods" className="sr-only" />
                          <label htmlFor="goods" className="flex cursor-pointer flex-col gap-2">
                            <span className="font-semibold">{t("productType.goods")}</span>
                            <span className="text-sm text-muted-foreground">
                              {t("productType.goodsDescription")}
                            </span>
                          </label>
                        </CardContent>
                      </Card>
                      <Card className={field.value === "service" ? "border-primary" : ""}>
                        <CardContent className="p-4">
                          <RadioGroupItem value="service" id="service" className="sr-only" />
                          <label htmlFor="service" className="flex cursor-pointer flex-col gap-2">
                            <span className="font-semibold">{t("productType.service")}</span>
                            <span className="text-sm text-muted-foreground">
                              {t("productType.serviceDescription")}
                            </span>
                          </label>
                        </CardContent>
                      </Card>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tabs for different sections */}
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="basic">{t("tabs.basic")}</TabsTrigger>
                <TabsTrigger value="sales">{t("tabs.sales")}</TabsTrigger>
                <TabsTrigger value="purchase">{t("tabs.purchase")}</TabsTrigger>
                <TabsTrigger value="inventory">{t("tabs.inventory")}</TabsTrigger>
                <TabsTrigger value="additional">{t("tabs.additional")}</TabsTrigger>
                <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("basicInfo.name")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("basicInfo.namePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("basicInfo.sku")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("basicInfo.skuPlaceholder")} {...field} />
                        </FormControl>
                        <FormDescription>{t("basicInfo.skuDescription")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("basicInfo.unit")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoadingUnits}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("basicInfo.selectUnit")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">
                                {t("basicInfo.noUnits")}
                              </div>
                            ) : (
                              units.map((unit) => (
                                <SelectItem key={unit.id} value={unit.name}>
                                  {unit.name}
                                  {unit.symbol && ` (${unit.symbol})`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("basicInfo.category")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoadingCategories}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("basicInfo.selectCategory")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">
                                {t("basicInfo.noCategories")}
                              </div>
                            ) : (
                              renderCategoryOptions(categories)
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("basicInfo.description")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("basicInfo.descriptionPlaceholder")}
                            rows={3}
                            {...field}
                          />
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
                        <FormLabel>{t("basicInfo.brand")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("basicInfo.manufacturer")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="returnable_item"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("basicInfo.returnableItem")}</FormLabel>
                          <FormDescription>
                            {t("basicInfo.returnableItemDescription")}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Barcodes Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("barcodes.title")}</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddBarcode}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("barcodes.addBarcode")}
                    </Button>
                  </div>
                  <div className="max-h-[300px] space-y-2 overflow-y-auto">
                    {barcodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("barcodes.noBarcodes")}</p>
                    ) : (
                      barcodes.map((barcode, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder={t("barcodes.barcodePlaceholder")}
                            value={barcode.barcode}
                            onChange={(e) => handleBarcodeChange(index, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant={barcode.is_primary ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetPrimaryBarcode(index)}
                          >
                            {barcode.is_primary ? t("barcodes.primary") : t("barcodes.setPrimary")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveBarcode(index)}
                          >
                            {t("barcodes.remove")}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Sales Information Tab */}
              <TabsContent value="sales" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="selling_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("salesInfo.sellingPrice")}</FormLabel>
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
                    name="sales_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("salesInfo.salesAccount")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sales_description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("salesInfo.salesDescription")}</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Purchase Information Tab */}
              <TabsContent value="purchase" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cost_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("purchaseInfo.costPrice")}</FormLabel>
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
                    name="purchase_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("purchaseInfo.purchaseAccount")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchase_description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("purchaseInfo.purchaseDescription")}</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Inventory Settings Tab */}
              <TabsContent value="inventory" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="track_inventory"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t("inventorySettings.trackInventory")}</FormLabel>
                          <FormDescription>
                            {t("inventorySettings.trackInventoryDescription")}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="opening_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventorySettings.openingStock")}</FormLabel>
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
                    name="opening_stock_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventorySettings.openingStockRate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reorder_point"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventorySettings.reorderPoint")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("inventorySettings.reorderPointDescription")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inventory_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventorySettings.inventoryAccount")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Additional Information Tab */}
              <TabsContent value="additional" className="space-y-4">
                <div className="space-y-4">
                  {/* Identifiers */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">{t("identifiers.title")}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="upc"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("identifiers.upc")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                            <FormLabel>{t("identifiers.ean")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                            <FormLabel>{t("identifiers.isbn")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mpn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("identifiers.mpn")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Measurements */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">{t("measurements.title")}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dimensions_length"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.length")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value) || undefined)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dimensions_width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.width")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value) || undefined)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dimensions_height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.height")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value) || undefined)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dimensions_unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.dimensionsUnit")}</FormLabel>
                            <FormControl>
                              <Input placeholder="cm, m, in" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.weight")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value) || undefined)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="weight_unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("measurements.weightUnit")}</FormLabel>
                            <FormControl>
                              <Input placeholder="kg, g, lb" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              <TabsContent value="custom-fields" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{t("customFields.title")}</h3>
                  <Select
                    onValueChange={(fieldId) => {
                      const fieldToAdd = allCustomFieldDefinitions.find(
                        (def) => def.id === fieldId
                      );
                      if (fieldToAdd) {
                        setSelectedCustomFieldDefinitions((prev) => [...prev, fieldToAdd]);
                      }
                    }}
                    value=""
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t("customFields.addField")} />
                    </SelectTrigger>
                    <SelectContent>
                      {allCustomFieldDefinitions
                        .filter(
                          (def) =>
                            !selectedCustomFieldDefinitions.some((sDef) => sDef.id === def.id)
                        )
                        .map((def) => (
                          <SelectItem key={def.id} value={def.id}>
                            {def.field_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCustomFieldDefinitions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {allCustomFieldDefinitions.length === 0
                        ? t("customFields.noFieldsDefined")
                        : t("customFields.noCustomFieldsSelected")}
                    </p>
                  </div>
                ) : (
                  <CustomFieldsRenderer
                    fields={selectedCustomFieldDefinitions as any}
                    values={customFieldValues}
                    onChange={(fieldId, value) => {
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [fieldId]: value,
                      }));
                    }}
                    onRemove={handleRemoveCustomField}
                  />
                )}
              </TabsContent>
            </Tabs>

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
                {isEditMode ? t("actions.save") : t("actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
