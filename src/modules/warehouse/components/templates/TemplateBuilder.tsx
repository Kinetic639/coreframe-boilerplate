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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { templateService } from "../../api/template-service";
import type { CreateTemplateRequest, TemplateWithAttributes } from "../../types/template";
import { useAppStore } from "@/lib/stores/app-store";

// Schema for template builder form
const templateBuilderSchema = z.object({
  name: z.string().min(1, "Template name is required"),
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
      })
    )
    .default([]),
});

type TemplateBuilderFormData = z.infer<typeof templateBuilderSchema>;

interface TemplateBuilderProps {
  baseTemplate?: TemplateWithAttributes;
  onSave?: (template: any) => void;
  onCancel?: () => void;
  mode?: "create" | "clone" | "edit";
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
}: TemplateBuilderProps) {
  const { activeOrgId } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TemplateBuilderFormData>({
    resolver: zodResolver(templateBuilderSchema),
    defaultValues: {
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
    append({
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
    });
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

  const onSubmit = async (data: TemplateBuilderFormData) => {
    if (!activeOrgId) {
      toast.error("No active organization");
      return;
    }

    setIsLoading(true);
    try {
      const templateData: CreateTemplateRequest = {
        name: data.name,
        description: data.description,
        organization_id: activeOrgId,
        category: data.category,
        icon: data.icon,
        color: data.color,
        supported_contexts: data.supported_contexts,
        settings: {},
        attributes: data.attributes.map((attr, index) => ({
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

      const result = await templateService.createTemplate(templateData);
      toast.success("Template created successfully!");
      onSave?.(result);
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === "create"
              ? "Create Template"
              : mode === "clone"
                ? "Clone Template"
                : "Edit Template"}
          </h2>
          <p className="text-muted-foreground">
            Define custom fields and properties for your products
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isLoading || !isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Template Info */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>Basic details about your template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input id="name" {...register("name")} placeholder="e.g., Electronics Inventory" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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

        {/* Fields Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custom Fields</CardTitle>
                <CardDescription>
                  Define the attributes that products using this template will have
                </CardDescription>
              </div>
              <Button type="button" onClick={addField} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AnimatePresence>
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-2 flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => index > 0 && moveField(index, index - 1)}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => index < fields.length - 1 && moveField(index, index + 1)}
                          disabled={index === fields.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
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
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeField(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

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
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {fields.length === 0 && (
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
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
