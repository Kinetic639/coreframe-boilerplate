"use client";

import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Package, ShoppingCart, Users, Monitor, Settings } from "lucide-react";
import { toast } from "react-toastify";
import {
  variantService,
  type CreateVariantRequest,
  type UpdateVariantRequest,
  type VariantWithAttributes,
} from "../../api/variant-service";
import type { AttributeDefinition } from "../../types/variant";
import type { AttributeValue } from "../../types/flexible-products";

// Context configuration with icons and colors
const CONTEXTS = [
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Package,
    color: "#10b981",
    description: "Basic warehouse information",
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: ShoppingCart,
    color: "#3b82f6",
    description: "Online store specific data",
  },
  {
    id: "b2b",
    label: "B2B",
    icon: Users,
    color: "#8b5cf6",
    description: "Business-to-business information",
  },
  {
    id: "pos",
    label: "POS",
    icon: Monitor,
    color: "#f59e0b",
    description: "Point of sale system data",
  },
] as const;

// Form validation schema
const attributeSchema = z.object({
  key: z.string().min(1, "Attribute key is required"),
  label: z.record(z.string()).optional(),
  description: z.record(z.string()).optional(),
  data_type: z.enum(["text", "number", "boolean", "date", "json"]),
  is_required: z.boolean().default(false),
  is_unique: z.boolean().default(false),
  default_value: z.any().optional(),
  validation_rules: z.record(z.any()).default({}),
  context_scope: z.string(),
  display_order: z.number().default(0),
  is_searchable: z.boolean().default(true),
  is_filterable: z.boolean().default(false),
  input_type: z.string().default("text"),
  placeholder: z.record(z.string()).optional(),
  help_text: z.record(z.string()).optional(),
  value: z.any().optional(),
});

const variantSchema = z.object({
  name: z.string().min(1, "Variant name is required"),
  slug: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  is_default: z.boolean().default(false),
  status: z.enum(["active", "inactive", "discontinued"]).default("active"),
  attributes: z.array(attributeSchema).default([]),
});

type VariantFormData = z.infer<typeof variantSchema>;

interface VariantBuilderProps {
  mode: "create" | "edit";
  productId: string;
  baseVariant?: VariantWithAttributes;
  onSave: (variant: VariantWithAttributes) => void;
  onCancel: () => void;
}

export function VariantBuilder({
  mode,
  productId,
  baseVariant,
  onSave,
  onCancel,
}: VariantBuilderProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: baseVariant?.name || "",
      slug: baseVariant?.slug || "",
      sku: baseVariant?.sku || "",
      barcode: baseVariant?.barcode || "",
      is_default: baseVariant?.is_default || false,
      status: (baseVariant?.status as "active" | "inactive" | "discontinued") || "active",
      attributes: baseVariant ? extractAttributesFromVariant(baseVariant) : [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Group attributes by context
  const fieldsByContext = React.useMemo(() => {
    const grouped: Record<string, Array<(typeof fields)[0] & { _index: number }>> = {};

    fields.forEach((field, index) => {
      const context = field.context_scope || "warehouse";
      if (!grouped[context]) {
        grouped[context] = [];
      }
      grouped[context].push({ ...field, _index: index });
    });

    return grouped;
  }, [fields]);

  const handleAddAttribute = (contextId: string) => {
    const newAttribute: AttributeDefinition = {
      slug: `attr_${Date.now()}`,
      label: { en: "", pl: "" },
      description: undefined,
      data_type: "text",
      is_required: false,
      is_unique: false,
      default_value: undefined,
      validation_rules: {},
      context_scope: contextId,
      display_order: fields.length,
      is_searchable: true,
      is_filterable: false,
      input_type: "text",
      placeholder: undefined,
      help_text: undefined,
    };

    append({
      key: newAttribute.slug,
      data_type: newAttribute.data_type,
      is_required: newAttribute.is_required,
      is_unique: newAttribute.is_unique,
      validation_rules: newAttribute.validation_rules,
      context_scope: newAttribute.context_scope,
      display_order: newAttribute.display_order,
      is_searchable: newAttribute.is_searchable,
      is_filterable: newAttribute.is_filterable,
      input_type: newAttribute.input_type,
    });
  };

  const handleSubmit = async (data: VariantFormData) => {
    try {
      setLoading(true);

      // Convert form data to variant request format
      const attributeValues: Record<string, AttributeValue> = {};

      data.attributes.forEach((attr) => {
        if (attr.value !== undefined && attr.value !== null && attr.value !== "") {
          attributeValues[attr.key] = convertToAttributeValue(attr.value, attr.data_type);
        }
      });

      if (mode === "create") {
        const createRequest: CreateVariantRequest = {
          product_id: productId,
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
          sku: data.sku,
          barcode: data.barcode,
          is_default: data.is_default,
          status: data.status,
          attributes: attributeValues,
        };

        const variant = await variantService.createVariant(productId, createRequest);
        toast.success("Variant created successfully");
        onSave(variant);
      } else {
        const updateRequest: UpdateVariantRequest = {
          id: baseVariant!.id,
          name: data.name,
          slug: data.slug,
          sku: data.sku,
          barcode: data.barcode,
          is_default: data.is_default,
          status: data.status,
          attributes: attributeValues,
        };

        const variant = await variantService.updateVariant(baseVariant!.id, updateRequest);
        toast.success("Variant updated successfully");
        onSave(variant);
      }
    } catch (error) {
      console.error("Error saving variant:", error);
      toast.error(`Failed to ${mode === "create" ? "create" : "update"} variant`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === "create" ? "Create New Variant" : "Edit Variant"}
          </h2>
          <p className="text-muted-foreground">
            {mode === "create"
              ? "Create a new product variant with context-specific attributes."
              : "Modify the variant details and context-specific attributes."}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Essential variant details that apply across all contexts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Variant Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="e.g., Red - Large"
                  className={form.formState.errors.name ? "border-red-500" : ""}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  {...form.register("slug")}
                  placeholder="Auto-generated from name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...form.register("sku")} placeholder="Stock Keeping Unit" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" {...form.register("barcode")} placeholder="Product barcode" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="is_default"
                  render={({ field }) => (
                    <Switch
                      id="is_default"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_default">Default Variant</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context-specific Attributes */}
        <Card>
          <CardHeader>
            <CardTitle>Context-Specific Attributes</CardTitle>
            <CardDescription>
              Configure attributes that apply to specific business contexts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="warehouse" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {CONTEXTS.map((context) => {
                  const Icon = context.icon;
                  const count = fieldsByContext[context.id]?.length || 0;

                  return (
                    <TabsTrigger
                      key={context.id}
                      value={context.id}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" style={{ color: context.color }} />
                      <span>{context.label}</span>
                      {count > 0 && <Badge variant="secondary">{count}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {CONTEXTS.map((context) => {
                const contextFields = fieldsByContext[context.id] || [];
                const Icon = context.icon;

                return (
                  <TabsContent key={context.id} value={context.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" style={{ color: context.color }} />
                        <div>
                          <h3 className="font-medium">{context.label} Context</h3>
                          <p className="text-sm text-muted-foreground">{context.description}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAttribute(context.id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Attribute
                      </Button>
                    </div>

                    {contextFields.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Package className="mx-auto mb-2 h-8 w-8" />
                        <p>No attributes defined for this context yet.</p>
                        <p className="text-sm">Click "Add Attribute" to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contextFields.map((field) => {
                          const fieldIndex = field._index;
                          return (
                            <Card key={field.id} className="p-4">
                              <div className="mb-4 flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label>Attribute Key *</Label>
                                      <Input
                                        {...form.register(`attributes.${fieldIndex}.key`)}
                                        placeholder="e.g., color, size, material"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Data Type</Label>
                                      <Controller
                                        control={form.control}
                                        name={`attributes.${fieldIndex}.data_type`}
                                        render={({ field: dataTypeField }) => (
                                          <Select
                                            value={dataTypeField.value}
                                            onValueChange={dataTypeField.onChange}
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
                                        )}
                                      />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Attribute Value</Label>
                                      {renderAttributeValueInput(form, fieldIndex, field.data_type)}
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <div className="flex items-center space-x-2">
                                        <Controller
                                          control={form.control}
                                          name={`attributes.${fieldIndex}.is_required`}
                                          render={({ field: requiredField }) => (
                                            <Switch
                                              checked={requiredField.value}
                                              onCheckedChange={requiredField.onChange}
                                            />
                                          )}
                                        />
                                        <Label>Required</Label>
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        <Controller
                                          control={form.control}
                                          name={`attributes.${fieldIndex}.is_searchable`}
                                          render={({ field: searchableField }) => (
                                            <Switch
                                              checked={searchableField.value}
                                              onCheckedChange={searchableField.onChange}
                                            />
                                          )}
                                        />
                                        <Label>Searchable</Label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => remove(fieldIndex)}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Settings className="mr-2 h-4 w-4 animate-spin" />
                {mode === "create" ? "Creating..." : "Saving Changes..."}
              </>
            ) : (
              <>{mode === "create" ? "Create Variant" : "Save Changes"}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Helper function to render attribute value input based on data type
function renderAttributeValueInput(
  form: ReturnType<typeof useForm<VariantFormData>>,
  fieldIndex: number,
  dataType: string
) {
  switch (dataType) {
    case "boolean":
      return (
        <Controller
          control={form.control}
          name={`attributes.${fieldIndex}.value`}
          render={({ field }) => (
            <Switch checked={field.value || false} onCheckedChange={field.onChange} />
          )}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          {...form.register(`attributes.${fieldIndex}.value`, {
            valueAsNumber: true,
          })}
        />
      );
    case "date":
      return <Input type="date" {...form.register(`attributes.${fieldIndex}.value`)} />;
    case "json":
      return (
        <Textarea
          {...form.register(`attributes.${fieldIndex}.value`)}
          placeholder='{"key": "value"}'
          className="font-mono text-sm"
        />
      );
    default:
      return (
        <Input
          {...form.register(`attributes.${fieldIndex}.value`)}
          placeholder="Enter attribute value"
        />
      );
  }
}

// Helper function to extract attributes from variant for form initialization
function extractAttributesFromVariant(variant: VariantWithAttributes): Array<{
  key: string;
  label: Record<string, string>;
  data_type: "text" | "number" | "boolean" | "date" | "json";
  is_required: boolean;
  is_unique: boolean;
  validation_rules: Record<string, unknown>;
  context_scope: string;
  display_order: number;
  is_searchable: boolean;
  is_filterable: boolean;
  input_type: string;
  value: unknown;
}> {
  if (!variant.attributes) return [];

  return variant.attributes.map((attr, index) => ({
    key: attr.attribute_key,
    label: { en: attr.attribute_key, pl: attr.attribute_key },
    data_type: getDataTypeFromAttribute(attr),
    is_required: false,
    is_unique: false,
    validation_rules: {},
    context_scope: attr.context_scope || "warehouse",
    display_order: index,
    is_searchable: true,
    is_filterable: false,
    input_type: "text",
    value: getAttributeValue(attr),
  }));
}

// Helper function to get data type from database attribute
function getDataTypeFromAttribute(attr: {
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
  value_json?: unknown | null;
}): "text" | "number" | "boolean" | "date" | "json" {
  if (attr.value_number !== null) return "number";
  if (attr.value_boolean !== null) return "boolean";
  if (attr.value_date !== null) return "date";
  if (attr.value_json !== null) return "json";
  return "text";
}

// Helper function to get attribute value from database attribute
function getAttributeValue(attr: any): any {
  if (attr.value_text !== null) return attr.value_text;
  if (attr.value_number !== null) return attr.value_number;
  if (attr.value_boolean !== null) return attr.value_boolean;
  if (attr.value_date !== null) return attr.value_date;
  if (attr.value_json !== null) return attr.value_json;
  return "";
}

// Helper function to convert form value to AttributeValue
function convertToAttributeValue(value: any, dataType: string): AttributeValue {
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
