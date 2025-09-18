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
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { DynamicFormFields } from "@/components/ui/dynamic-form-field";
import { useAppStore } from "@/lib/stores/app-store";
import { templateService } from "@/modules/warehouse/api/template-service";
import { flexibleProductService } from "@/modules/warehouse/api/flexible-products";
import type {
  TemplateWithAttributes,
  ProductAttributeDefinition,
} from "@/modules/warehouse/types/template";
import type { AttributeValue } from "@/modules/warehouse/types/flexible-products";
import { toast } from "react-toastify";

interface TemplateBasedProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preSelectedTemplate?: TemplateWithAttributes | null;
}

type FormStep = "template" | "product";

// Create form schema based on template attributes
function createFormSchema(attributes: ProductAttributeDefinition[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

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
function createDefaultValues(attributes: ProductAttributeDefinition[]): Record<string, unknown> {
  const defaultValues: Record<string, unknown> = {};

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
  preSelectedTemplate,
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
  const [customFields, setCustomFields] = React.useState<ProductAttributeDefinition[]>([]);

  // Create combined attributes (basic fields + template + custom)
  const allAttributes = React.useMemo(() => {
    if (!selectedTemplate) return [];

    // Always include basic product fields as the first attributes
    const basicAttributes: ProductAttributeDefinition[] = [
      {
        id: "product_name",
        template_id: selectedTemplate.template.id,
        slug: "product_name",
        label: { en: "Product Name" },
        data_type: "text",
        is_required: true,
        is_unique: false,
        context_scope: "warehouse",
        display_order: 1,
        is_searchable: true,
        is_filterable: true,
        input_type: "text",
        validation_rules: { min_length: 1 },
        default_value: null,
        placeholder: { en: "Enter product name" },
        description: null,
        help_text: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "product_description",
        template_id: selectedTemplate.template.id,
        slug: "product_description",
        label: { en: "Product Description" },
        data_type: "text",
        is_required: false,
        is_unique: false,
        context_scope: "warehouse",
        display_order: 2,
        is_searchable: true,
        is_filterable: false,
        input_type: "textarea",
        validation_rules: null,
        default_value: null,
        placeholder: { en: "Enter product description (optional)" },
        description: null,
        help_text: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "variant_name",
        template_id: selectedTemplate.template.id,
        slug: "variant_name",
        label: { en: "Variant Name" },
        data_type: "text",
        is_required: false,
        is_unique: false,
        context_scope: "warehouse",
        display_order: 3,
        is_searchable: true,
        is_filterable: true,
        input_type: "text",
        validation_rules: null,
        default_value: "Default Variant",
        placeholder: { en: "Default Variant" },
        description: { en: "Name for the default product variant" },
        help_text: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Combine basic fields with template attributes and custom fields
    // Adjust display_order for template and custom fields to come after basic fields
    const templateAttributes = selectedTemplate.attributes.map((attr) => ({
      ...attr,
      display_order: attr.display_order + 10,
    }));

    const adjustedCustomFields = customFields.map((field, index) => ({
      ...field,
      display_order: 20 + templateAttributes.length + index,
    }));

    return [...basicAttributes, ...templateAttributes, ...adjustedCustomFields];
  }, [selectedTemplate, customFields]);

  // Create schema and default values based on all attributes
  const formSchema = React.useMemo(() => {
    if (!selectedTemplate) {
      return z.object({});
    }
    return createFormSchema(allAttributes);
  }, [selectedTemplate, allAttributes]);

  const defaultValues = React.useMemo(() => {
    if (!selectedTemplate) {
      return {};
    }
    return createDefaultValues(allAttributes);
  }, [selectedTemplate, allAttributes]);

  // Initialize form with proper default values
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });

  // Reset form when attributes change
  React.useEffect(() => {
    if (selectedTemplate) {
      form.reset(defaultValues);
    }
  }, [selectedTemplate, defaultValues, form, allAttributes]);

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
      // If a template is pre-selected, skip template selection
      if (preSelectedTemplate) {
        setSelectedTemplate(preSelectedTemplate);
        setCurrentStep("product");
      }
    }
  }, [open, activeOrgId, loadTemplates, preSelectedTemplate]);

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setCurrentStep(preSelectedTemplate ? "product" : "template");
      setSelectedTemplate(preSelectedTemplate || null);
      setCustomFields([]);
      form.reset({});
    }
  }, [open, form, preSelectedTemplate]);

  const handleTemplateSelect = (templateData: TemplateWithAttributes | null) => {
    if (templateData === null) {
      // Create a minimal template for basic product creation
      const basicTemplate: TemplateWithAttributes = {
        template: {
          id: "no-template",
          name: "Blank Product",
          slug: "blank-product",
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
      setCustomFields([]); // Reset custom fields for blank template
    } else {
      setSelectedTemplate(templateData);
      setCustomFields([]); // Reset custom fields for any template
    }
    setCurrentStep("product");
  };

  const handleBack = () => {
    setCurrentStep("template");
    setSelectedTemplate(null);
    setCustomFields([]);
    form.reset({});
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    if (!selectedTemplate || !activeOrgId) return;

    try {
      setSubmitting(true);

      // Transform form data into product attributes
      const attributesObject: Record<string, AttributeValue> = {};

      Object.entries(data).forEach(([key, value]) => {
        const attrDef = allAttributes.find((attr) => attr.slug === key);
        if (!attrDef || value === undefined || value === null) return;

        // Handle different data types and create proper AttributeValue
        switch (attrDef.data_type) {
          case "date":
            attributesObject[key] = {
              type: "date",
              value: value instanceof Date ? value.toISOString() : String(value),
            };
            break;
          case "json":
            attributesObject[key] = {
              type: "json",
              value: typeof value === "object" ? value : {},
            };
            break;
          case "boolean":
            attributesObject[key] = {
              type: "boolean",
              value: Boolean(value),
            };
            break;
          case "number":
            attributesObject[key] = {
              type: "number",
              value: Number(value),
            };
            break;
          case "text":
          default:
            attributesObject[key] = {
              type: "text",
              value: String(value),
            };
        }
      });

      // Create the product
      const createData = {
        template_id:
          selectedTemplate.template.id === "no-template" ? undefined : selectedTemplate.template.id,
        organization_id: activeOrgId,
        name: String(data.product_name || `Product from ${selectedTemplate.template.name}`),
        description: String(
          data.product_description ||
            `Product created using ${selectedTemplate.template.name} template`
        ),
        status: "active" as const,
        variant_name: String(data.variant_name || "Default Variant"),
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

  const addCustomField = () => {
    const newFieldIndex = customFields.length + 1;
    const newField: ProductAttributeDefinition = {
      id: `custom-${Date.now()}`,
      template_id: selectedTemplate?.template.id || "no-template",
      slug: `custom_field_${newFieldIndex}`,
      label: { en: `Custom Field ${newFieldIndex}` },
      data_type: "text",
      is_required: false,
      is_unique: false,
      context_scope: "warehouse",
      display_order: selectedTemplate
        ? selectedTemplate.attributes.length + customFields.length + 1
        : customFields.length + 1,
      is_searchable: false,
      is_filterable: false,
      input_type: "text",
      validation_rules: null,
      default_value: null,
      placeholder: null,
      description: null,
      help_text: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCustomFields([...customFields, newField]);
  };

  const removeCustomField = (fieldId: string) => {
    setCustomFields(customFields.filter((field) => field.id !== fieldId));
    // Also remove the field value from the form
    const fieldToRemove = customFields.find((field) => field.id === fieldId);
    if (fieldToRemove) {
      const currentValues = form.getValues();
      delete currentValues[fieldToRemove.slug];
      form.reset(currentValues);
    }
  };

  const updateCustomField = (fieldId: string, updates: Partial<ProductAttributeDefinition>) => {
    setCustomFields(
      customFields.map((field) => (field.id === fieldId ? { ...field, ...updates } : field))
    );
  };

  const isBlankTemplate = selectedTemplate?.template.id === "no-template";

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
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Templates</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Blank template as first option */}
                      <Card
                        className="cursor-pointer transition-colors hover:bg-accent"
                        onClick={() => handleTemplateSelect(null)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Plus className="h-4 w-4" />
                            Blank Product
                            <Badge variant="secondary" className="ml-auto">
                              0 fields
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            Create a basic product with just name and description
                          </p>
                        </CardContent>
                      </Card>

                      {/* System templates */}
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

                      {/* Organization templates */}
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
                      {/* Dynamic Form Fields */}
                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Product Information
                          </h4>
                          {isBlankTemplate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addCustomField}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Field
                            </Button>
                          )}
                        </div>

                        {allAttributes.length > 0 ? (
                          <div className="space-y-4">
                            <DynamicFormFields
                              attributes={allAttributes}
                              values={Object.keys(form.getValues()).reduce(
                                (acc, key) => {
                                  acc[key] = form.getValues(key);
                                  return acc;
                                },
                                {} as Record<string, unknown>
                              )}
                              errors={Object.keys(form.formState.errors).reduce(
                                (acc, key) => {
                                  const error = form.formState.errors[key];
                                  if (error && typeof error === "object" && "message" in error) {
                                    acc[key] = (error.message as string) || null;
                                  } else {
                                    acc[key] = null;
                                  }
                                  return acc;
                                },
                                {} as Record<string, string | null>
                              )}
                              onChange={(fieldKey, value) => form.setValue(fieldKey, value)}
                              locale="en"
                            />

                            {/* Custom field management for blank template */}
                            {isBlankTemplate && customFields.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-muted-foreground">
                                  Custom Fields Management
                                </h5>
                                {customFields.map((field) => (
                                  <div
                                    key={field.id}
                                    className="flex items-center gap-2 rounded border p-2"
                                  >
                                    <div className="flex-1">
                                      <Input
                                        placeholder="Field label"
                                        value={
                                          typeof field.label === "object"
                                            ? field.label.en
                                            : field.label
                                        }
                                        onChange={(e) =>
                                          updateCustomField(field.id, {
                                            label: { en: e.target.value },
                                            slug: e.target.value
                                              .toLowerCase()
                                              .replace(/\s+/g, "_")
                                              .replace(/[^a-z0-9_]/g, ""),
                                          })
                                        }
                                        className="text-sm"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCustomField(field.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          isBlankTemplate && (
                            <div className="py-8 text-center text-muted-foreground">
                              <p className="text-sm">No attributes added yet.</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addCustomField}
                                className="mt-2"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Your First Field
                              </Button>
                            </div>
                          )
                        )}
                      </div>
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
