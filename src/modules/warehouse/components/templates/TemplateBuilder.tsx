"use client";

import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Settings,
  Save,
  X,
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { templateService } from "../../api/template-service";
import { flexibleProductService } from "../../api/flexible-products";
import type { CreateTemplateRequest, TemplateWithAttributes } from "../../types/template";
import type { CreateProductData, AttributeValue } from "../../types/flexible-products";
import { useAppStore } from "@/lib/stores/app-store";

// Base schema for both templates and products
const baseBuilderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().default("custom"),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color")
    .default("#10b981"),
  supported_contexts: z.array(z.string()).min(1, "At least one context is required"),
  attributes: z
    .array(
      z.object({
        slug: z.string().min(1, "Field slug is required"),
        label: z.object({
          en: z.string().min(1, "English label is required"),
          pl: z.string().min(1, "Polish label is required"),
        }),
        description: z
          .object({
            en: z.string().optional(),
            pl: z.string().optional(),
          })
          .optional(),
        data_type: z.enum(["text", "number", "boolean", "date", "json"]),
        is_required: z.boolean().default(false),
        is_unique: z.boolean().default(false),
        is_searchable: z.boolean().default(true),
        context_scope: z.string().default("warehouse"),
        input_type: z.string().default("text"),
        validation_rules: z.record(z.any()).default({}),
        default_value: z.any().optional(),
        placeholder: z
          .object({
            en: z.string().optional(),
            pl: z.string().optional(),
          })
          .optional(),
        help_text: z
          .object({
            en: z.string().optional(),
            pl: z.string().optional(),
          })
          .optional(),
        display_order: z.number().default(0),
        // For products: the actual field values
        value: z.any().optional(),
      })
    )
    .default([]),
});

// Extended schema for products
const productBuilderSchema = baseBuilderSchema.extend({
  // Product-specific fields
  product_name: z.string().min(1, "Product name is required"),
  product_description: z.string().optional(),
  variant_name: z.string().optional(),
  variant_sku: z.string().optional(),
  variant_barcode: z.string().optional(),
});

// Use base schema for templates (backward compatibility)
const templateBuilderSchema = baseBuilderSchema;

type TemplateBuilderFormData = z.infer<typeof templateBuilderSchema>;
type ProductBuilderFormData = z.infer<typeof productBuilderSchema>;

interface TemplateBuilderProps {
  baseTemplate?: TemplateWithAttributes;
  onSave?: (result: any) => void;
  onCancel?: () => void;
  mode?: "create" | "clone" | "edit";
  // New props for product creation
  builderType?: "template" | "product";
  productMode?: "create" | "edit";
}

const DATA_TYPE_ICONS = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  json: FileText,
} as const;

const AVAILABLE_CONTEXTS = [
  { value: "warehouse", label: "Warehouse" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "b2b", label: "B2B" },
  { value: "pos", label: "Point of Sale" },
];

const TEMPLATE_CATEGORIES = [
  { value: "custom", label: "Custom" },
  { value: "retail", label: "Retail" },
  { value: "home", label: "Home Inventory" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "service", label: "Service" },
];

const FIELD_INPUT_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Select Dropdown" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "number", label: "Number Input" },
  { value: "date", label: "Date Picker" },
  { value: "checkbox", label: "Checkbox" },
  { value: "switch", label: "Switch Toggle" },
];

export function TemplateBuilder({
  baseTemplate,
  onSave,
  onCancel,
  mode = "create",
  builderType = "template",
  productMode = "create",
}: TemplateBuilderProps) {
  const { activeOrgId } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  // Accordion and batch operation state
  const [collapsedFields, setCollapsedFields] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<number>>(new Set());

  const isProductBuilder = builderType === "product";
  const schema = isProductBuilder ? productBuilderSchema : templateBuilderSchema;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: isProductBuilder
      ? {
          // Product-specific defaults
          product_name: "",
          product_description: "",
          variant_name: "Default Variant",
          variant_sku: "",
          variant_barcode: "",
          // Base fields for product
          name: baseTemplate ? baseTemplate.template.name : "",
          description: baseTemplate?.template.description || "",
          category: baseTemplate?.template.category || "custom",
          icon: baseTemplate?.template.icon || "",
          color: baseTemplate?.template.color || "#10b981",
          supported_contexts: baseTemplate?.template.supported_contexts || ["warehouse"],
          attributes:
            baseTemplate?.attributes.map((attr, index) => ({
              slug: attr.slug,
              label: attr.label,
              description: attr.description,
              data_type: attr.data_type,
              is_required: attr.is_required,
              is_unique: attr.is_unique,
              is_searchable: attr.is_searchable,
              context_scope: attr.context_scope,
              input_type: attr.input_type,
              validation_rules: attr.validation_rules || {},
              default_value: attr.default_value,
              placeholder: attr.placeholder,
              help_text: attr.help_text,
              display_order: index,
              value: "", // Initialize empty value for product attributes
            })) || [],
        }
      : {
          // Template defaults (existing behavior)
          name: baseTemplate ? `${baseTemplate.template.name} (Copy)` : "",
          description: baseTemplate?.template.description || "",
          category: baseTemplate?.template.category || "custom",
          icon: baseTemplate?.template.icon || "",
          color: baseTemplate?.template.color || "#10b981",
          supported_contexts: baseTemplate?.template.supported_contexts || ["warehouse"],
          attributes:
            baseTemplate?.attributes.map((attr, index) => ({
              slug: attr.slug,
              label: attr.label,
              description: attr.description,
              data_type: attr.data_type,
              is_required: attr.is_required,
              is_unique: attr.is_unique,
              is_searchable: attr.is_searchable,
              context_scope: attr.context_scope,
              input_type: attr.input_type,
              validation_rules: attr.validation_rules || {},
              default_value: attr.default_value,
              placeholder: attr.placeholder,
              help_text: attr.help_text,
              display_order: index,
            })) || [],
        },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "attributes",
  });

  const watchedAttributes = watch("attributes");
  const watchedSupportedContexts = watch("supported_contexts");

  const addField = () => {
    const newField = {
      slug: `field_${fields.length + 1}`,
      label: {
        en: `Field ${fields.length + 1}`,
        pl: `Pole ${fields.length + 1}`,
      },
      data_type: "text",
      is_required: false,
      is_unique: false,
      is_searchable: true,
      context_scope: "warehouse",
      input_type: "text",
      validation_rules: {},
      display_order: fields.length,
      ...(isProductBuilder && { value: "" }), // Add value field for products
    } as any;

    append(newField);
  };

  const removeField = (index: number) => {
    remove(index);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    move(fromIndex, toIndex);
    // Update display_order for all fields
    watchedAttributes.forEach((_, index) => {
      setValue(`attributes.${index}.display_order`, index);
    });
  };

  const toggleContext = (context: string) => {
    const current = watchedSupportedContexts || [];
    const updated = current.includes(context)
      ? current.filter((c) => c !== context)
      : [...current, context];
    setValue("supported_contexts", updated);
  };

  // Accordion and batch operation handlers
  const toggleFieldCollapse = (fieldId: string) => {
    const newCollapsed = new Set(collapsedFields);
    if (newCollapsed.has(fieldId)) {
      newCollapsed.delete(fieldId);
    } else {
      newCollapsed.add(fieldId);
    }
    setCollapsedFields(newCollapsed);
  };

  const collapseAllFields = () => {
    const allFieldIds = new Set(fields.map((field) => field.id));
    setCollapsedFields(allFieldIds);
  };

  const expandAllFields = () => {
    setCollapsedFields(new Set());
  };

  const toggleFieldSelection = (index: number) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFields(newSelected);
  };

  const selectAllFields = () => {
    const allIndices = new Set(fields.map((_, index) => index));
    setSelectedFields(allIndices);
  };

  const deselectAllFields = () => {
    setSelectedFields(new Set());
  };

  const removeSelectedFields = () => {
    const indicesToRemove = Array.from(selectedFields).sort((a, b) => b - a);
    indicesToRemove.forEach((index) => remove(index));
    setSelectedFields(new Set());
  };

  const isAllSelected = fields.length > 0 && selectedFields.size === fields.length;
  const isPartiallySelected = selectedFields.size > 0 && selectedFields.size < fields.length;

  const onSubmit = async (data: TemplateBuilderFormData | ProductBuilderFormData) => {
    if (!activeOrgId) {
      toast.error("No active organization");
      return;
    }

    setIsLoading(true);
    try {
      if (isProductBuilder) {
        // Product creation logic
        const productData = data as ProductBuilderFormData;

        // Prepare attribute values from form data
        const attributeValues: Record<string, AttributeValue> = {};
        productData.attributes.forEach((attr) => {
          if ("value" in attr && attr.value !== undefined && attr.value !== "") {
            // Convert value to proper AttributeValue format based on data type
            let attributeValue: AttributeValue;
            switch (attr.data_type) {
              case "number":
                attributeValue = { type: "number", value: Number(attr.value) };
                break;
              case "boolean":
                attributeValue = { type: "boolean", value: Boolean(attr.value) };
                break;
              case "date":
                attributeValue = { type: "date", value: String(attr.value) };
                break;
              case "json":
                attributeValue = { type: "json", value: attr.value };
                break;
              default:
                attributeValue = { type: "text", value: String(attr.value) };
            }
            attributeValues[attr.slug] = attributeValue;
          }
        });

        const createProductData: CreateProductData = {
          name: productData.product_name,
          description: productData.product_description || undefined,
          template_id: baseTemplate?.template.id || "",
          organization_id: activeOrgId,
          variant_name: productData.variant_name || "Default Variant",
          variant_sku: productData.variant_sku || undefined,
          variant_barcode: productData.variant_barcode || undefined,
          attributes: attributeValues,
        };

        const result = await flexibleProductService.createProduct(createProductData);
        toast.success("Product created successfully!");
        onSave?.(result);
      } else {
        // Template creation logic (existing)
        const templateData = data as TemplateBuilderFormData;

        const createTemplateData: CreateTemplateRequest = {
          name: templateData.name,
          description: templateData.description,
          organization_id: activeOrgId,
          category: templateData.category,
          icon: templateData.icon,
          color: templateData.color,
          supported_contexts: templateData.supported_contexts,
          settings: {},
          attributes: templateData.attributes.map((attr, index) => ({
            slug: attr.slug || `field_${index}`,
            label: attr.label || { en: `Field ${index + 1}`, pl: `Pole ${index + 1}` },
            description: attr.description,
            data_type: attr.data_type || "text",
            is_required: attr.is_required || false,
            is_unique: attr.is_unique || false,
            default_value: attr.default_value,
            validation_rules: attr.validation_rules || {},
            context_scope: attr.context_scope || "warehouse",
            display_order: index,
            is_searchable: attr.is_searchable !== false,
            is_filterable: false,
            input_type: attr.input_type || "text",
            placeholder: attr.placeholder,
            help_text: attr.help_text,
          })),
        };

        const result = await templateService.createTemplate(createTemplateData);
        toast.success("Template created successfully!");
        onSave?.(result);
      }
    } catch (error) {
      console.error(`Error creating ${isProductBuilder ? "product" : "template"}:`, error);
      toast.error(`Failed to create ${isProductBuilder ? "product" : "template"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {isProductBuilder
              ? productMode === "create"
                ? "Create Product"
                : "Edit Product"
              : mode === "create"
                ? "Create Template"
                : mode === "clone"
                  ? "Clone Template"
                  : "Edit Template"}
          </h2>
          <p className="text-muted-foreground">
            {isProductBuilder
              ? "Create a new product using template fields and custom attributes"
              : "Define custom fields and properties for your products"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isLoading || !isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Saving..." : isProductBuilder ? "Save Product" : "Save Template"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Product-specific fields (only shown in product mode) */}
        {isProductBuilder && (
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
              <CardDescription>Basic details about your product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product_name">Product Name *</Label>
                  <Input
                    id="product_name"
                    {...register("product_name" as keyof typeof register)}
                    placeholder="e.g., iPhone 15 Pro"
                  />
                  {errors.product_name && (
                    <p className="text-sm text-destructive">
                      {String(
                        typeof errors.product_name === "string"
                          ? errors.product_name
                          : errors.product_name?.message || ""
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_name">Variant Name</Label>
                  <Input
                    id="variant_name"
                    {...register("variant_name" as keyof typeof register)}
                    placeholder="e.g., 128GB Black"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_description">Product Description</Label>
                <Textarea
                  id="product_description"
                  {...register("product_description" as keyof typeof register)}
                  placeholder="Describe your product..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="variant_sku">SKU</Label>
                  <Input
                    id="variant_sku"
                    {...register("variant_sku" as keyof typeof register)}
                    placeholder="e.g., IP15P-128-BLK"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_barcode">Barcode</Label>
                  <Input
                    id="variant_barcode"
                    {...register("variant_barcode" as keyof typeof register)}
                    placeholder="e.g., 1234567890123"
                  />
                </div>
              </div>

              {baseTemplate && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Template:</strong> {baseTemplate.template.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This product will use the fields and structure defined in the selected template.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Basic Template Info - Only show in template mode */}
        {!isProductBuilder && (
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
              <CardDescription>Basic details about your template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="e.g., Electronics Inventory"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">
                      {String(
                        typeof errors.name === "string" ? errors.name : errors.name?.message || ""
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select onValueChange={(value) => setValue("category", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Describe what this template is used for..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2">
                    <Input id="color" type="color" {...register("color")} className="w-20" />
                    <Input {...register("color")} placeholder="#10b981" className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon Name</Label>
                  <Input id="icon" {...register("icon")} placeholder="e.g., Package, Laptop, Car" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Supported Contexts</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CONTEXTS.map((context) => (
                    <Badge
                      key={context.value}
                      variant={
                        watchedSupportedContexts?.includes(context.value) ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleContext(context.value)}
                    >
                      {context.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fields Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{isProductBuilder ? "Product Attributes" : "Custom Fields"}</CardTitle>
                <CardDescription>
                  {isProductBuilder
                    ? "Fill in the values for each attribute defined in the template"
                    : "Define the attributes that products using this template will have"}
                </CardDescription>
              </div>
              {!isProductBuilder && (
                <Button type="button" onClick={addField} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Toolbar for batch operations (only in template mode) */}
            {!isProductBuilder && fields.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-md border bg-muted/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el: any) => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllFields();
                        } else {
                          deselectAllFields();
                        }
                      }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedFields.size > 0 ? `${selectedFields.size} selected` : "Select all"}
                    </span>
                  </div>

                  {selectedFields.size > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeSelectedFields}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove ({selectedFields.size})
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={expandAllFields}
                    title="Expand all fields"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={collapseAllFields}
                    title="Collapse all fields"
                  >
                    <Minimize2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-lg border"
                  >
                    {/* Accordion Header */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Selection checkbox (only in template mode) */}
                      {!isProductBuilder && (
                        <Checkbox
                          checked={selectedFields.has(index)}
                          onCheckedChange={() => toggleFieldSelection(index)}
                        />
                      )}

                      {/* Reorder controls (only in template mode) */}
                      {!isProductBuilder && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => index > 0 && moveField(index, index - 1)}
                            disabled={index === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => index < fields.length - 1 && moveField(index, index + 1)}
                            disabled={index === fields.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Field header - clickable to toggle collapse */}
                      <div
                        className="flex flex-1 cursor-pointer items-center justify-between"
                        onClick={() => toggleFieldCollapse(field.id)}
                      >
                        <div className="flex items-center gap-2">
                          {React.createElement(
                            DATA_TYPE_ICONS[watchedAttributes[index]?.data_type] || Type,
                            { className: "h-4 w-4" }
                          )}
                          <span className="font-medium">
                            {watchedAttributes[index]?.label?.en || `Field ${index + 1}`}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {watchedAttributes[index]?.data_type}
                          </Badge>
                          {isProductBuilder && watchedAttributes[index]?.is_required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Individual remove button (only in template mode) */}
                          {!isProductBuilder && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(index);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}

                          {/* Collapse indicator */}
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              !collapsedFields.has(field.id) ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {!collapsedFields.has(field.id) && (
                      <div className="border-t px-4 pb-4 pt-4">
                        {isProductBuilder ? (
                          // Product mode: Only show the value input
                          <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                              {...register(`attributes.${index}.value` as keyof typeof register)}
                              placeholder={`Enter value for ${watchedAttributes[index]?.label?.en || "this field"}...`}
                            />
                            <p className="text-xs text-muted-foreground">
                              The actual value for this attribute in your product
                            </p>
                          </div>
                        ) : (
                          // Template mode: Show full configuration tabs
                          <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="basic">Basic</TabsTrigger>
                              <TabsTrigger value="validation">Validation</TabsTrigger>
                              <TabsTrigger value="display">Display</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Field Slug *</Label>
                                  <Input
                                    {...register(`attributes.${index}.slug`)}
                                    placeholder="field_name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Data Type *</Label>
                                  <Select
                                    onValueChange={(value) =>
                                      setValue(`attributes.${index}.data_type`, value as any)
                                    }
                                    value={watchedAttributes[index]?.data_type || "text"}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="boolean">Boolean</SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="json">JSON</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>English Label *</Label>
                                  <Input
                                    {...register(`attributes.${index}.label.en`)}
                                    placeholder="Field Name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Polish Label *</Label>
                                  <Input
                                    {...register(`attributes.${index}.label.pl`)}
                                    placeholder="Nazwa Pola"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>English Description</Label>
                                  <Textarea
                                    {...register(`attributes.${index}.description.en`)}
                                    placeholder="Field description..."
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Polish Description</Label>
                                  <Textarea
                                    {...register(`attributes.${index}.description.pl`)}
                                    placeholder="Opis pola..."
                                    rows={2}
                                  />
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="validation" className="space-y-4">
                              <div className="flex flex-wrap gap-4">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={watchedAttributes[index]?.is_required || false}
                                    onCheckedChange={(checked) =>
                                      setValue(`attributes.${index}.is_required`, checked)
                                    }
                                  />
                                  <Label>Required</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={watchedAttributes[index]?.is_unique || false}
                                    onCheckedChange={(checked) =>
                                      setValue(`attributes.${index}.is_unique`, checked)
                                    }
                                  />
                                  <Label>Unique</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={watchedAttributes[index]?.is_searchable !== false}
                                    onCheckedChange={(checked) =>
                                      setValue(`attributes.${index}.is_searchable`, checked)
                                    }
                                  />
                                  <Label>Searchable</Label>
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="display" className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Input Type</Label>
                                  <Select
                                    onValueChange={(value) =>
                                      setValue(`attributes.${index}.input_type`, value)
                                    }
                                    value={watchedAttributes[index]?.input_type || "text"}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIELD_INPUT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          {type.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Context</Label>
                                  <Select
                                    onValueChange={(value) =>
                                      setValue(`attributes.${index}.context_scope`, value)
                                    }
                                    value={watchedAttributes[index]?.context_scope || "warehouse"}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AVAILABLE_CONTEXTS.map((context) => (
                                        <SelectItem key={context.value} value={context.value}>
                                          {context.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>English Placeholder</Label>
                                  <Input
                                    {...register(`attributes.${index}.placeholder.en`)}
                                    placeholder="Enter value..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Polish Placeholder</Label>
                                  <Input
                                    {...register(`attributes.${index}.placeholder.pl`)}
                                    placeholder="Wprowadź wartość..."
                                  />
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {fields.length === 0 && !isProductBuilder && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No fields defined</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Start building your template by adding custom fields
                </p>
                <Button onClick={addField} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Field
                </Button>
              </div>
            )}

            {fields.length === 0 && isProductBuilder && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No attributes in template</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  This template doesn't have any attributes defined yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
