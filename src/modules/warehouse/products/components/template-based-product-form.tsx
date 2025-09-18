"use client";

import * as React from "react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAppStore } from "@/lib/stores/app-store";
import { templateService } from "@/modules/warehouse/api/template-service";
import { flexibleProductService } from "@/modules/warehouse/api/flexible-products";
import type {
  TemplateWithAttributes,
  ProductAttributeDefinition,
} from "@/modules/warehouse/types/template";
import { toast } from "react-toastify";

interface TemplateBasedProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type FormStep = "template" | "product";

// Create form schema based on template attributes
function createFormSchema(attributes: ProductAttributeDefinition[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {
    // Always include basic product fields
    product_name: z.string().min(1, "Product name is required"),
    product_description: z.string().optional(),
    variant_name: z.string().optional(),
  };

  attributes.forEach((attr) => {
    let fieldSchema: z.ZodTypeAny;

    switch (attr.data_type) {
      case "text":
        fieldSchema = z.string();
        break;
      case "number":
        fieldSchema = z.coerce.number();
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      case "date":
        fieldSchema = z.date();
        break;
      case "json":
        fieldSchema = z.any();
        break;
      default:
        fieldSchema = z.string();
    }

    // Apply required validation
    if (!attr.is_required) {
      fieldSchema = fieldSchema.optional();
    }

    // Apply validation rules
    if (attr.validation_rules) {
      if (attr.data_type === "text" && typeof fieldSchema._def === "object") {
        if (attr.validation_rules.min_length) {
          fieldSchema = (fieldSchema as z.ZodString).min(attr.validation_rules.min_length);
        }
        if (attr.validation_rules.max_length) {
          fieldSchema = (fieldSchema as z.ZodString).max(attr.validation_rules.max_length);
        }
      }
    }

    schemaFields[attr.slug] = fieldSchema;
  });

  return z.object(schemaFields);
}

// Create default values based on template attributes
function createDefaultValues(attributes: ProductAttributeDefinition[]): Record<string, any> {
  const defaultValues: Record<string, any> = {
    // Default values for basic product fields
    product_name: "",
    product_description: "",
    variant_name: "",
  };

  attributes.forEach((attr) => {
    if (attr.default_value !== undefined && attr.default_value !== null) {
      defaultValues[attr.slug] = attr.default_value;
    } else {
      switch (attr.data_type) {
        case "text":
          defaultValues[attr.slug] = "";
          break;
        case "number":
          defaultValues[attr.slug] = 0;
          break;
        case "boolean":
          defaultValues[attr.slug] = false;
          break;
        case "date":
          defaultValues[attr.slug] = undefined; // Let date picker handle undefined
          break;
        case "json":
          defaultValues[attr.slug] = {};
          break;
        default:
          defaultValues[attr.slug] = "";
      }
    }
  });

  return defaultValues;
}

export function TemplateBasedProductForm({
  open,
  onOpenChange,
  onSuccess,
}: TemplateBasedProductFormProps) {
  const { activeOrgId } = useAppStore();
  const [currentStep, setCurrentStep] = React.useState<FormStep>("template");
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Templates state
  const [systemTemplates, setSystemTemplates] = React.useState<TemplateWithAttributes[]>([]);
  const [organizationTemplates, setOrganizationTemplates] = React.useState<
    TemplateWithAttributes[]
  >([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateWithAttributes | null>(
    null
  );

  // Create schema and default values based on selected template
  const formSchema = React.useMemo(() => {
    if (!selectedTemplate) {
      return z.object({});
    }
    return createFormSchema(selectedTemplate.attributes);
  }, [selectedTemplate]);

  const defaultValues = React.useMemo(() => {
    if (!selectedTemplate) {
      return {};
    }
    return createDefaultValues(selectedTemplate.attributes);
  }, [selectedTemplate]);

  // Initialize form with proper default values
  const form = useForm<Record<string, any>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });

  // Reset form when template changes
  React.useEffect(() => {
    if (selectedTemplate) {
      form.reset(defaultValues);
    }
  }, [selectedTemplate, defaultValues, form]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const templates = await templateService.getAllTemplates(activeOrgId || undefined);
      setSystemTemplates(templates.system_templates);
      setOrganizationTemplates(templates.organization_templates);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Error loading templates");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  // Load templates when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      loadTemplates();
    }
  }, [open, activeOrgId, loadTemplates]);

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setCurrentStep("template");
      setSelectedTemplate(null);
      form.reset({});
    }
  }, [open, form]);

  const handleTemplateSelect = (templateData: TemplateWithAttributes | null) => {
    if (templateData === null) {
      // Create a minimal template for basic product creation
      const basicTemplate: TemplateWithAttributes = {
        template: {
          id: "no-template",
          name: "Basic Product",
          slug: "basic-product",
          description: "Basic product without template",
          organization_id: activeOrgId,
          parent_template_id: null,
          is_system: false,
          is_active: true,
          category: "basic",
          icon: "Package",
          color: "#6366f1",
          supported_contexts: ["warehouse"],
          settings: {},
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        attributes: [], // No template attributes
        attribute_count: 0,
      };
      setSelectedTemplate(basicTemplate);
    } else {
      setSelectedTemplate(templateData);
    }
    setCurrentStep("product");
  };

  const handleBack = () => {
    setCurrentStep("template");
    setSelectedTemplate(null);
    form.reset({});
  };

  const onSubmit = async (data: Record<string, any>) => {
    if (!selectedTemplate || !activeOrgId) return;

    try {
      setSubmitting(true);

      // Transform form data into product attributes
      const attributesObject: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        const attrDef = selectedTemplate.attributes.find((attr) => attr.slug === key);
        if (!attrDef || value === undefined || value === null) return;

        let processedValue: any = value;

        // Handle different data types
        switch (attrDef.data_type) {
          case "date":
            processedValue = value instanceof Date ? value.toISOString() : value;
            break;
          case "json":
            processedValue = typeof value === "object" ? value : {};
            break;
          case "boolean":
            processedValue = Boolean(value);
            break;
          case "number":
            processedValue = Number(value);
            break;
          case "text":
          default:
            processedValue = String(value);
        }

        attributesObject[key] = {
          type: attrDef.data_type,
          value: processedValue,
          context: attrDef.context_scope || "warehouse",
          locale: "en",
        };
      });

      // Create the product
      const createData = {
        template_id:
          selectedTemplate.template.id === "no-template" ? undefined : selectedTemplate.template.id,
        organization_id: activeOrgId,
        name: data.product_name || `Product from ${selectedTemplate.template.name}`,
        description:
          data.product_description ||
          `Product created using ${selectedTemplate.template.name} template`,
        status: "active" as const,
        variant_name: data.variant_name || "Default Variant",
        attributes: attributesObject,
      };

      await flexibleProductService.createProduct(createData);

      toast.success("Product created successfully!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Error creating product");
    } finally {
      setSubmitting(false);
    }
  };

  const renderAttributeField = (attr: ProductAttributeDefinition) => {
    const currentLocale = "en"; // Get from context if needed

    const label =
      attr.label && typeof attr.label === "object"
        ? attr.label[currentLocale] || attr.label["en"] || attr.slug
        : attr.slug;

    const description =
      attr.description && typeof attr.description === "object"
        ? attr.description[currentLocale] || attr.description["en"] || ""
        : "";

    const placeholder =
      attr.placeholder && typeof attr.placeholder === "object"
        ? attr.placeholder[currentLocale] || attr.placeholder["en"] || ""
        : "";

    return (
      <FormField
        key={attr.slug}
        control={form.control}
        name={attr.slug}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              {label}
              {attr.is_required && <span className="text-red-500">*</span>}
              <Badge variant="outline" className="text-xs">
                {attr.context_scope}
              </Badge>
            </FormLabel>
            <FormControl>
              {attr.data_type === "text" ? (
                <Input
                  placeholder={placeholder}
                  {...field}
                  value={field.value || ""} // Ensure controlled input
                />
              ) : attr.data_type === "number" ? (
                <Input
                  type="number"
                  placeholder={placeholder}
                  {...field}
                  value={field.value || ""} // Ensure controlled input
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                />
              ) : attr.data_type === "boolean" ? (
                <div className="flex items-center space-x-2">
                  <Checkbox checked={field.value || false} onCheckedChange={field.onChange} />
                  <span className="text-sm">{placeholder || label}</span>
                </div>
              ) : attr.data_type === "date" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>{placeholder || "Pick a date"}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Textarea
                  placeholder={placeholder}
                  className="min-h-[80px]"
                  {...field}
                  value={field.value || ""} // Ensure controlled input
                />
              )}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {currentStep === "template" ? "Select Product Template" : "Create Product"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "template"
              ? "Choose a template to define the structure of your product"
              : "Fill in the product details based on the selected template"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {currentStep === "template" ? (
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {systemTemplates.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold">System Templates</h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {systemTemplates.map((template) => (
                          <Card
                            key={template.template.id}
                            className="cursor-pointer transition-colors hover:bg-accent"
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                {template.template.icon && (
                                  <span className="text-lg">{template.template.icon}</span>
                                )}
                                {template.template.name}
                                <Badge variant="secondary" className="ml-auto">
                                  {template.attribute_count} fields
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">
                                {template.template.description || "No description available"}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {organizationTemplates.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold">Custom Templates</h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {organizationTemplates.map((template) => (
                          <Card
                            key={template.template.id}
                            className="cursor-pointer transition-colors hover:bg-accent"
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                {template.template.icon && (
                                  <span className="text-lg">{template.template.icon}</span>
                                )}
                                {template.template.name}
                                <Badge variant="secondary" className="ml-auto">
                                  {template.attribute_count} fields
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">
                                {template.template.description || "No description available"}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Option to skip template selection */}
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <h3 className="mb-2 font-medium">Create Product Without Template</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Create a basic product with just name and description, no predefined
                      attributes
                    </p>
                    <Button variant="outline" onClick={() => handleTemplateSelect(null)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Basic Product
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            selectedTemplate &&
            currentStep === "product" && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
                    <Badge variant="outline">{selectedTemplate.template.name}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedTemplate.template.description}
                    </span>
                  </div>

                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-6">
                      {/* Basic Product Fields */}
                      <div className="space-y-4 rounded-lg border p-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Basic Product Information
                        </h4>

                        <FormField
                          control={form.control}
                          name="product_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter product name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="product_description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter product description (optional)"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="variant_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Variant Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Default Variant" {...field} />
                              </FormControl>
                              <FormDescription>
                                Name for the default product variant
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Template Attributes */}
                      {selectedTemplate.attributes.length > 0 && (
                        <div className="space-y-4 rounded-lg border p-4">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Template Attributes
                          </h4>
                          {selectedTemplate.attributes.map((attr) => (
                            <div key={attr.slug || attr.id}>{renderAttributeField(attr)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </form>
              </Form>
            )
          )}
        </div>

        <DialogFooter className="flex justify-between">
          {currentStep === "product" && (
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {currentStep === "product" && (
              <Button onClick={form.handleSubmit(onSubmit)} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Product
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
