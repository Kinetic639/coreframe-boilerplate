import * as React from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  ImageIcon,
  Upload,
  X,
  Copy,
  Save,
  Package,
  AlertCircle,
  Loader2,
  Warehouse,
  ShoppingCart,
  Building2,
  CreditCard,
} from "lucide-react";
import { variantService } from "@/modules/warehouse/api/variant-service";
import { ContextSwitcher, useContextStore } from "../../components/context/context-switcher";
import type { VariantWithAttributes, VariantContextData } from "@/modules/warehouse/types/variants";
import type { Context } from "@/modules/warehouse/api/context-service";
import { toast } from "react-toastify";

// Context icon mapping
const CONTEXT_ICONS = {
  warehouse: Warehouse,
  ecommerce: ShoppingCart,
  b2b: Building2,
  pos: CreditCard,
} as const;

// Form schemas for different contexts
const baseVariantSchema = z.object({
  name: z.string().min(1, "Variant name is required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
});

const warehouseContextSchema = baseVariantSchema.extend({
  purchase_price: z.coerce.number().min(0).optional(),
  supplier_sku: z.string().optional(),
  storage_location: z.string().optional(),
  reorder_point: z.coerce.number().min(0).optional(),
  packaging_weight: z.coerce.number().min(0).optional(),
});

const ecommerceContextSchema = baseVariantSchema.extend({
  selling_price: z.coerce.number().min(0).optional(),
  sale_price: z.coerce.number().min(0).optional(),
  is_featured: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  seo_title: z.string().optional(),
  short_description: z.string().optional(),
  tags: z.string().optional(),
});

const b2bContextSchema = baseVariantSchema.extend({
  b2b_price: z.coerce.number().min(0).optional(),
  minimum_order_qty: z.coerce.number().min(1).optional(),
  bulk_discount: z.coerce.number().min(0).max(100).optional(),
  is_b2b_visible: z.boolean().default(true),
  lead_time_days: z.coerce.number().min(0).optional(),
});

const posContextSchema = baseVariantSchema.extend({
  pos_price: z.coerce.number().min(0).optional(),
  quick_sale_category: z.string().optional(),
  pos_display_name: z.string().optional(),
  is_pos_visible: z.boolean().default(true),
  loyalty_points: z.coerce.number().min(0).optional(),
});

interface VariantContextSupportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: VariantWithAttributes;
  onVariantUpdated?: (variant: VariantWithAttributes) => void;
}

export function VariantContextSupport({
  open,
  onOpenChange,
  variant,
  onVariantUpdated,
}: VariantContextSupportProps) {
  const { currentContext, availableContexts } = useContextStore();
  const [activeTab, setActiveTab] = React.useState(currentContext);
  const [variantContextData, setVariantContextData] = React.useState<Record<string, any>>({});
  const [variantImages, setVariantImages] = React.useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [unsavedChanges, setUnsavedChanges] = React.useState<Set<string>>(new Set());

  // Form instances for each context
  const warehouseForm = useForm<z.infer<typeof warehouseContextSchema>>({
    resolver: zodResolver(warehouseContextSchema),
    defaultValues: {
      name: variant.name,
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      description: "",
    },
  });
  const ecommerceForm = useForm<z.infer<typeof ecommerceContextSchema>>({
    resolver: zodResolver(ecommerceContextSchema),
    defaultValues: {
      name: variant.name,
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      description: "",
    },
  });
  const b2bForm = useForm<z.infer<typeof b2bContextSchema>>({
    resolver: zodResolver(b2bContextSchema),
    defaultValues: {
      name: variant.name,
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      description: "",
    },
  });
  const posForm = useForm<z.infer<typeof posContextSchema>>({
    resolver: zodResolver(posContextSchema),
    defaultValues: {
      name: variant.name,
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      description: "",
    },
  });

  const forms = React.useMemo(
    () => ({
      warehouse: warehouseForm,
      ecommerce: ecommerceForm,
      b2b: b2bForm,
      pos: posForm,
    }),
    [warehouseForm, ecommerceForm, b2bForm, posForm]
  );

  // Load variant context data
  const loadVariantContextData = React.useCallback(async () => {
    if (!variant.id) return;

    setIsLoading(true);
    try {
      const data: Record<string, any> = {};
      const images: Record<string, any[]> = {};

      // Load data for each available context
      for (const context of availableContexts) {
        try {
          const contextData = await variantService.getVariantByContext(
            variant.id,
            context.context_name
          );
          data[context.context_name] = contextData;
          images[context.context_name] = contextData.images || [];

          // Update form with context data
          const form = forms[context.context_name as keyof typeof forms];
          if (form && contextData.attributes) {
            form.reset({ ...variant, ...contextData.attributes });
          }
        } catch (error) {
          console.warn(`Failed to load data for context ${context.context_name}:`, error);
          data[context.context_name] = null;
          images[context.context_name] = [];
        }
      }

      setVariantContextData(data);
      setVariantImages(images);
    } catch (error) {
      console.error("Error loading variant context data:", error);
      toast.error("Failed to load variant context data");
    } finally {
      setIsLoading(false);
    }
  }, [variant.id, availableContexts, forms, variant]);

  React.useEffect(() => {
    if (open) {
      loadVariantContextData();
    }
  }, [open, loadVariantContextData]);

  // Update active tab when current context changes
  React.useEffect(() => {
    if (availableContexts.some((ctx) => ctx.context_name === currentContext)) {
      setActiveTab(currentContext);
    }
  }, [currentContext, availableContexts]);

  // Track form changes
  const handleFormChange = (contextName: string) => {
    setUnsavedChanges((prev) => new Set([...prev, contextName]));
  };

  // Save context data
  const saveContextData = async (contextName: string) => {
    const form = forms[contextName as keyof typeof forms];
    if (!form) return;

    setIsSaving(true);
    try {
      const formData = form.getValues();
      const contextData: VariantContextData = {
        context: contextName,
        attributes: formData,
        images: variantImages[contextName] || [],
      };

      const updatedVariant = await variantService.updateVariantInContext(
        variant.id,
        contextName,
        contextData
      );

      setUnsavedChanges((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contextName);
        return newSet;
      });

      onVariantUpdated?.(updatedVariant);
      toast.success(`${contextName} data saved successfully`);

      // Reload data to get updated values
      await loadVariantContextData();
    } catch (error) {
      console.error(`Error saving ${contextName} data:`, error);
      toast.error(`Failed to save ${contextName} data`);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy data between contexts
  const copyContextData = async (fromContext: string, toContext: string) => {
    setIsSaving(true);
    try {
      const sourceData = variantContextData[fromContext];
      const sourceImages = variantImages[fromContext] || [];

      if (!sourceData?.attributes) {
        toast.error("No data to copy from source context");
        return;
      }

      const contextData: VariantContextData = {
        context: toContext,
        attributes: sourceData.attributes,
        images: sourceImages,
      };

      const updatedVariant = await variantService.updateVariantInContext(
        variant.id,
        toContext,
        contextData
      );

      // Update form and images
      const form = forms[toContext as keyof typeof forms];
      if (form) {
        form.reset({ ...variant, ...sourceData.attributes });
      }
      setVariantImages((prev) => ({ ...prev, [toContext]: sourceImages }));

      onVariantUpdated?.(updatedVariant);
      toast.success(`Data copied from ${fromContext} to ${toContext}`);

      await loadVariantContextData();
    } catch (error) {
      console.error("Error copying context data:", error);
      toast.error("Failed to copy context data");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle image upload (mock implementation)
  const handleImageUpload = (contextName: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    // In a real implementation, this would upload to a storage service
    const newImageUrls = Array.from(files).map(
      (file, index) =>
        `https://example.com/images/${variant.id}/${contextName}/${Date.now()}_${index}.jpg`
    );

    setVariantImages((prev) => ({
      ...prev,
      [contextName]: [...(prev[contextName] || []), ...newImageUrls],
    }));

    handleFormChange(contextName);
    toast.success(`${files.length} image(s) uploaded for ${contextName}`);
  };

  // Remove image
  const removeImage = (contextName: string, imageIndex: number) => {
    setVariantImages((prev) => ({
      ...prev,
      [contextName]: prev[contextName]?.filter((_, i) => i !== imageIndex) || [],
    }));
    handleFormChange(contextName);
  };

  const enabledContexts = availableContexts.filter((ctx) => ctx.is_active);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading variant data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Variant Context Management</DialogTitle>
          <DialogDescription>
            Manage variant data and images across different business contexts for{" "}
            <strong>{variant.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Context Switcher and Actions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Context Views</CardTitle>
                  <CardDescription>
                    Manage variant data across different business contexts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <CopyContextDialog
                    contexts={enabledContexts}
                    onCopy={copyContextData}
                    disabled={enabledContexts.length < 2 || isSaving}
                  />
                  {unsavedChanges.has(activeTab) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => saveContextData(activeTab)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ContextSwitcher
                variant="tabs"
                onContextChange={setActiveTab}
                showManagement={false}
              />
            </CardContent>
          </Card>

          {/* Context Data Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {enabledContexts.map((context) => (
              <TabsContent key={context.id} value={context.context_name}>
                <VariantContextForm
                  context={context}
                  variant={variant}
                  form={forms[context.context_name as keyof typeof forms]}
                  data={variantContextData[context.context_name]}
                  images={variantImages[context.context_name] || []}
                  hasUnsavedChanges={unsavedChanges.has(context.context_name)}
                  onFormChange={() => handleFormChange(context.context_name)}
                  onSave={() => saveContextData(context.context_name)}
                  onImageUpload={(files) => handleImageUpload(context.context_name, files)}
                  onImageRemove={(index) => removeImage(context.context_name, index)}
                  isSaving={isSaving}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Individual Context Form Component
interface VariantContextFormProps {
  context: Context;
  variant: VariantWithAttributes;
  form: any;
  data: any;
  images: string[];
  hasUnsavedChanges: boolean;
  onFormChange: () => void;
  onSave: () => void;
  onImageUpload: (files: FileList | null) => void;
  onImageRemove: (index: number) => void;
  isSaving: boolean;
}

function VariantContextForm({
  context,
  variant: _variant,
  form,
  data,
  images,
  hasUnsavedChanges,
  onFormChange,
  onSave,
  onImageUpload,
  onImageRemove,
  isSaving,
}: VariantContextFormProps) {
  const IconComponent =
    CONTEXT_ICONS[context.context_name as keyof typeof CONTEXT_ICONS] || Package;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getContextFields = (contextName: string) => {
    switch (contextName) {
      case "warehouse":
        return <WarehouseVariantFields form={form} onChange={onFormChange} />;
      case "ecommerce":
        return <EcommerceVariantFields form={form} onChange={onFormChange} />;
      case "b2b":
        return <B2BVariantFields form={form} onChange={onFormChange} />;
      case "pos":
        return <POSVariantFields form={form} onChange={onFormChange} />;
      default:
        return <GenericVariantFields form={form} onChange={onFormChange} />;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Variant Data */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: (context.color || "#10b981") + "20" }}
                >
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: context.color || "#10b981" }}
                  />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {typeof context.display_label === "object" &&
                    context.display_label !== null &&
                    !Array.isArray(context.display_label)
                      ? (() => {
                          const labels = context.display_label as Record<string, any>;
                          return labels.en || labels.pl || context.context_name;
                        })()
                      : context.context_name}{" "}
                    Data
                  </CardTitle>
                  <CardDescription>
                    Variant-specific data for {context.context_name} context
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Unsaved
                  </Badge>
                )}
                <Badge variant={context.api_enabled ? "default" : "secondary"}>
                  {context.api_enabled ? "API Enabled" : "Internal Only"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data ? (
              <Form {...form}>
                <form className="space-y-6">
                  {/* Base variant fields */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variant Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                onFormChange();
                              }}
                            />
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
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                onFormChange();
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              onFormChange();
                            }}
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              onFormChange();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Context-specific fields */}
                  {getContextFields(context.context_name)}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={onSave}
                      disabled={!hasUnsavedChanges || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No data available for this context</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Images */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Images</CardTitle>
                <CardDescription>Context-specific images</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageUpload(e.target.files)}
            />

            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="group relative">
                    <img
                      src={image}
                      alt={`Variant image ${index + 1}`}
                      className="aspect-square w-full rounded-lg border object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onImageRemove(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">No images for this context</p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Context-specific field components (reusing from product-context-views)
function WarehouseVariantFields({ form, onChange }: { form: any; onChange: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="purchase_price"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Purchase Price</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="supplier_sku"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Supplier SKU</FormLabel>
            <FormControl>
              <Input
                placeholder="Supplier product code"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="storage_location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Storage Location</FormLabel>
            <FormControl>
              <Input
                placeholder="Warehouse section"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
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
            <FormLabel>Reorder Point</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="0"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function EcommerceVariantFields({ form, onChange }: { form: any; onChange: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="selling_price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selling Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    onChange();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sale_price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sale Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    onChange();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="is_featured"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Featured Variant</FormLabel>
                <FormDescription className="text-xs">Show prominently in store</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    onChange();
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_visible"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Visible in Store</FormLabel>
                <FormDescription className="text-xs">Available for purchase</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    onChange();
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="short_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Short Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Brief variant description for listings"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function B2BVariantFields({ form, onChange }: { form: any; onChange: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="b2b_price"
        render={({ field }) => (
          <FormItem>
            <FormLabel>B2B Price</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="minimum_order_qty"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Minimum Order Quantity</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="1"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="bulk_discount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bulk Discount (%)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="0"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="lead_time_days"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lead Time (Days)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="0"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function POSVariantFields({ form, onChange }: { form: any; onChange: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="pos_price"
        render={({ field }) => (
          <FormItem>
            <FormLabel>POS Price</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="pos_display_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>POS Display Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Short name for POS"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="quick_sale_category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Quick Sale Category</FormLabel>
            <FormControl>
              <Input
                placeholder="Category for quick access"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="loyalty_points"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loyalty Points</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="0"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  onChange();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function GenericVariantFields({
  form: _form,
  onChange: _onChange,
}: {
  form: any;
  onChange: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Custom context fields not yet implemented</p>
    </div>
  );
}

// Copy Context Dialog Component
interface CopyContextDialogProps {
  contexts: Context[];
  onCopy: (fromContext: string, toContext: string) => void;
  disabled: boolean;
}

function CopyContextDialog({ contexts, onCopy, disabled }: CopyContextDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [fromContext, setFromContext] = React.useState("");
  const [toContext, setToContext] = React.useState("");

  const handleCopy = () => {
    if (fromContext && toContext && fromContext !== toContext) {
      onCopy(fromContext, toContext);
      setOpen(false);
      setFromContext("");
      setToContext("");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <Copy className="mr-2 h-4 w-4" />
        Copy Between Contexts
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Copy Context Data</DialogTitle>
            <DialogDescription>
              Copy variant data from one context to another. This will overwrite existing data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Copy from:</Label>
              <Select value={fromContext} onValueChange={setFromContext}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source context" />
                </SelectTrigger>
                <SelectContent>
                  {contexts.map((context) => (
                    <SelectItem key={context.id} value={context.context_name}>
                      {typeof context.display_label === "object" &&
                      context.display_label !== null &&
                      !Array.isArray(context.display_label)
                        ? (() => {
                            const labels = context.display_label as Record<string, any>;
                            return labels.en || labels.pl || context.context_name;
                          })()
                        : context.context_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Copy to:</Label>
              <Select value={toContext} onValueChange={setToContext}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target context" />
                </SelectTrigger>
                <SelectContent>
                  {contexts
                    .filter((ctx) => ctx.context_name !== fromContext)
                    .map((context) => (
                      <SelectItem key={context.id} value={context.context_name}>
                        {typeof context.display_label === "object" &&
                        context.display_label !== null &&
                        !Array.isArray(context.display_label)
                          ? (() => {
                              const labels = context.display_label as Record<string, any>;
                              return labels.en || labels.pl || context.context_name;
                            })()
                          : context.context_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!fromContext || !toContext || fromContext === toContext}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
