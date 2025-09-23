"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Warehouse,
  ShoppingCart,
  Building2,
  CreditCard,
  Copy,
  Save,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { productService } from "@/modules/warehouse/api/products";
import { ContextSwitcher, useContextStore } from "../../components/context/context-switcher";
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
const warehouseSchema = z.object({
  purchase_price: z.coerce.number().min(0).optional(),
  supplier_sku: z.string().optional(),
  storage_location: z.string().optional(),
  reorder_point: z.coerce.number().min(0).optional(),
  max_stock: z.coerce.number().min(0).optional(),
  storage_conditions: z.string().optional(),
});

const ecommerceSchema = z.object({
  selling_price: z.coerce.number().min(0).optional(),
  sale_price: z.coerce.number().min(0).optional(),
  is_featured: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  short_description: z.string().optional(),
  tags: z.string().optional(),
});

const b2bSchema = z.object({
  b2b_price: z.coerce.number().min(0).optional(),
  minimum_order_qty: z.coerce.number().min(1).optional(),
  bulk_discount: z.coerce.number().min(0).max(100).optional(),
  is_b2b_visible: z.boolean().default(true),
  b2b_sku: z.string().optional(),
  lead_time_days: z.coerce.number().min(0).optional(),
});

const posSchema = z.object({
  pos_price: z.coerce.number().min(0).optional(),
  quick_sale_category: z.string().optional(),
  pos_display_name: z.string().optional(),
  is_pos_visible: z.boolean().default(true),
  loyalty_points: z.coerce.number().min(0).optional(),
});

interface ProductContextViewsProps {
  productId: string;
  onDataChange?: (context: string, data: any) => void;
}

export function ProductContextViews({ productId, onDataChange }: ProductContextViewsProps) {
  const { currentContext, availableContexts } = useContextStore();
  const [activeTab, setActiveTab] = React.useState(currentContext);
  const [productData, setProductData] = React.useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [unsavedChanges, setUnsavedChanges] = React.useState<Set<string>>(new Set());
  const [showCopyDialog, setShowCopyDialog] = React.useState(false);
  const [copyFromContext, setCopyFromContext] = React.useState<string>("");
  const [copyToContexts, setCopyToContexts] = React.useState<string[]>([]);

  // Form instances for each context
  const warehouseForm = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {},
  });
  const ecommerceForm = useForm<z.infer<typeof ecommerceSchema>>({
    resolver: zodResolver(ecommerceSchema),
    defaultValues: {},
  });
  const b2bForm = useForm<z.infer<typeof b2bSchema>>({
    resolver: zodResolver(b2bSchema),
    defaultValues: {},
  });
  const posForm = useForm<z.infer<typeof posSchema>>({
    resolver: zodResolver(posSchema),
    defaultValues: {},
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

  // Load product data for all contexts
  const loadProductData = React.useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    try {
      const data: Record<string, any> = {};

      // Load data for each available context
      for (const context of availableContexts) {
        try {
          const contextData = await productService.getProductByContext(
            productId,
            context.context_name
          );
          data[context.context_name] = contextData;

          // Update form with context data
          const form = forms[context.context_name as keyof typeof forms];
          if (form && contextData.attributes) {
            // Convert attributes array to object for form
            const attributesObject = contextData.attributes.reduce((acc: any, attr: any) => {
              acc[attr.attribute_key] =
                attr.value_text || attr.value_number || attr.value_boolean || attr.value_json;
              return acc;
            }, {});
            form.reset(attributesObject);
          }
        } catch (error) {
          console.warn(`Failed to load data for context ${context.context_name}:`, error);
          data[context.context_name] = null;
        }
      }

      setProductData(data);
    } catch (error) {
      console.error("Error loading product data:", error);
      toast.error("Failed to load product data");
    } finally {
      setIsLoading(false);
    }
  }, [productId, availableContexts, forms]);

  React.useEffect(() => {
    loadProductData();
  }, [loadProductData]);

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
      await productService.updateProductInContext(productId, contextName, {
        attributes: formData,
        images: [],
      });

      setUnsavedChanges((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contextName);
        return newSet;
      });

      onDataChange?.(contextName, formData);
      toast.success(`${contextName} data saved successfully`);

      // Reload data to get updated values
      await loadProductData();
    } catch (error) {
      console.error(`Error saving ${contextName} data:`, error);
      toast.error(`Failed to save ${contextName} data`);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy data between contexts
  const handleCopyData = async () => {
    if (!copyFromContext || copyToContexts.length === 0) return;

    setIsSaving(true);
    try {
      const sourceData = productData[copyFromContext];
      if (!sourceData?.attributes) {
        toast.error("No data to copy from source context");
        return;
      }

      // Copy to each selected context
      for (const targetContext of copyToContexts) {
        try {
          await productService.updateProductInContext(
            productId,
            targetContext,
            sourceData.attributes
          );

          // Update form
          const form = forms[targetContext as keyof typeof forms];
          if (form) {
            form.reset(sourceData.attributes);
          }
        } catch (error) {
          console.warn(`Failed to copy to ${targetContext}:`, error);
        }
      }

      toast.success("Data copied successfully");
      setShowCopyDialog(false);
      setCopyFromContext("");
      setCopyToContexts([]);

      // Reload data
      await loadProductData();
    } catch (error) {
      console.error("Error copying data:", error);
      toast.error("Failed to copy data");
    } finally {
      setIsSaving(false);
    }
  };

  const enabledContexts = availableContexts.filter((ctx) => ctx.is_active);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading product data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Context Switcher and Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Product Context Views</CardTitle>
              <CardDescription>
                Manage product data across different business contexts
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCopyDialog(true)}
                disabled={enabledContexts.length < 2}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Between Contexts
              </Button>
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
          <ContextSwitcher variant="tabs" onContextChange={setActiveTab} showManagement={false} />
        </CardContent>
      </Card>

      {/* Context Data Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {enabledContexts.map((context) => (
          <TabsContent key={context.id} value={context.context_name}>
            <ContextForm
              context={context}
              form={forms[context.context_name as keyof typeof forms]}
              data={productData[context.context_name]}
              hasUnsavedChanges={unsavedChanges.has(context.context_name)}
              onFormChange={() => handleFormChange(context.context_name)}
              onSave={() => saveContextData(context.context_name)}
              isSaving={isSaving}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Copy Data Dialog */}
      <CopyDataDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        contexts={enabledContexts}
        copyFromContext={copyFromContext}
        setCopyFromContext={setCopyFromContext}
        copyToContexts={copyToContexts}
        setCopyToContexts={setCopyToContexts}
        onCopy={handleCopyData}
        isSaving={isSaving}
      />
    </div>
  );
}

// Individual Context Form Component
interface ContextFormProps {
  context: Context;
  form: any;
  data: any;
  hasUnsavedChanges: boolean;
  onFormChange: () => void;
  onSave: () => void;
  isSaving: boolean;
}

function ContextForm({
  context,
  form,
  data,
  hasUnsavedChanges,
  onFormChange,
  onSave,
  isSaving,
}: ContextFormProps) {
  const IconComponent =
    CONTEXT_ICONS[context.context_name as keyof typeof CONTEXT_ICONS] || Warehouse;

  const getContextFields = (contextName: string) => {
    switch (contextName) {
      case "warehouse":
        return <WarehouseFields form={form} onChange={onFormChange} />;
      case "ecommerce":
        return <EcommerceFields form={form} onChange={onFormChange} />;
      case "b2b":
        return <B2BFields form={form} onChange={onFormChange} />;
      case "pos":
        return <POSFields form={form} onChange={onFormChange} />;
      default:
        return <GenericFields form={form} onChange={onFormChange} />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: (context.color || "#10b981") + "20" }}
            >
              <IconComponent className="h-5 w-5" style={{ color: context.color || "#10b981" }} />
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
                  : context.context_name}
              </CardTitle>
              <CardDescription>
                Manage product data for {context.context_name} context
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
              {context.api_enabled ? (
                <Globe className="mr-1 h-3 w-3" />
              ) : (
                <Lock className="mr-1 h-3 w-3" />
              )}
              {context.api_enabled ? "API Enabled" : "Internal Only"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data ? (
          <Form {...form}>
            <form className="space-y-6">
              {getContextFields(context.context_name)}
              <div className="flex justify-end">
                <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges || isSaving}>
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
  );
}

// Context-specific field components
function WarehouseFields({ form, onChange }: { form: any; onChange: () => void }) {
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

function EcommerceFields({ form, onChange }: { form: any; onChange: () => void }) {
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
                <FormLabel>Featured Product</FormLabel>
                <p className="text-sm text-muted-foreground">Show on homepage</p>
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
                <p className="text-sm text-muted-foreground">Available for purchase</p>
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
                placeholder="Brief product description for listings"
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

function B2BFields({ form, onChange }: { form: any; onChange: () => void }) {
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

function POSFields({ form, onChange }: { form: any; onChange: () => void }) {
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

function GenericFields({ form: _form, onChange: _onChange }: { form: any; onChange: () => void }) {
  return (
    <div className="py-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Custom context fields not yet implemented</p>
    </div>
  );
}

// Copy Data Dialog Component
interface CopyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexts: Context[];
  copyFromContext: string;
  setCopyFromContext: (context: string) => void;
  copyToContexts: string[];
  setCopyToContexts: (contexts: string[]) => void;
  onCopy: () => void;
  isSaving: boolean;
}

function CopyDataDialog({
  open,
  onOpenChange,
  contexts,
  copyFromContext,
  setCopyFromContext,
  copyToContexts,
  setCopyToContexts,
  onCopy,
  isSaving,
}: CopyDataDialogProps) {
  const handleTargetToggle = (contextName: string) => {
    setCopyToContexts(
      copyToContexts.includes(contextName)
        ? copyToContexts.filter((ctx) => ctx !== contextName)
        : [...copyToContexts, contextName]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copy Data Between Contexts</DialogTitle>
          <DialogDescription>
            Copy product data from one context to another. This will overwrite existing data in the
            target contexts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Copy from:</Label>
            <Select value={copyFromContext} onValueChange={setCopyFromContext}>
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
            <div className="space-y-2">
              {contexts
                .filter((ctx) => ctx.context_name !== copyFromContext)
                .map((context) => (
                  <div key={context.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={context.context_name}
                      checked={copyToContexts.includes(context.context_name)}
                      onChange={() => handleTargetToggle(context.context_name)}
                      className="rounded"
                    />
                    <Label htmlFor={context.context_name}>
                      {typeof context.display_label === "object" &&
                      context.display_label !== null &&
                      !Array.isArray(context.display_label)
                        ? (() => {
                            const labels = context.display_label as Record<string, any>;
                            return labels.en || labels.pl || context.context_name;
                          })()
                        : context.context_name}
                    </Label>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCopy}
            disabled={!copyFromContext || copyToContexts.length === 0 || isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
