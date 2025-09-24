"use client";

import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Package,
  ShoppingCart,
  Users,
  Monitor,
  Grid3X3,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { variantService } from "../../api/variant-service";
import type { VariantMatrixConfig } from "../../types/variant";

// Context configuration
const CONTEXTS = [
  { id: "warehouse", label: "Warehouse", icon: Package, color: "#10b981" },
  { id: "ecommerce", label: "E-commerce", icon: ShoppingCart, color: "#3b82f6" },
  { id: "b2b", label: "B2B", icon: Users, color: "#8b5cf6" },
  { id: "pos", label: "POS", icon: Monitor, color: "#f59e0b" },
] as const;

const valueSchema = z.object({
  value: z.string().min(1, "Value is required"),
  label: z.string().min(1, "Label is required"),
});

const attributeSchema = z.object({
  key: z.string().min(1, "Attribute key is required"),
  label: z.string().min(1, "Attribute label is required"),
  values: z.array(valueSchema).min(1, "At least one value is required"),
  context_scope: z.string().default("warehouse"),
});

const matrixSchema = z.object({
  attributes: z.array(attributeSchema).min(1, "At least one attribute is required"),
  naming_pattern: z.string().min(1, "Naming pattern is required"),
  sku_pattern: z.string().optional(),
  base_sku: z.string().optional(),
  base_status: z.enum(["active", "inactive", "discontinued"]).default("active"),
});

type MatrixFormData = z.infer<typeof matrixSchema>;

interface VariantMatrixDialogProps {
  productId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VariantMatrixDialog({ productId, onSuccess, onCancel }: VariantMatrixDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [previewVariants, setPreviewVariants] = React.useState<any[]>([]);

  const form = useForm<MatrixFormData>({
    resolver: zodResolver(matrixSchema),
    defaultValues: {
      attributes: [
        {
          key: "",
          label: "",
          values: [{ value: "", label: "" }],
          context_scope: "warehouse",
        },
      ],
      naming_pattern: "{attr_0}",
      sku_pattern: "",
      base_sku: "",
      base_status: "active",
    },
  });

  const {
    fields: attributeFields,
    append: appendAttribute,
    remove: removeAttribute,
  } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  const watchedData = form.watch();

  // Generate preview when form data changes
  React.useEffect(() => {
    const generatePreview = () => {
      try {
        const { attributes, naming_pattern, sku_pattern, base_sku } = watchedData;

        // Filter out incomplete attributes
        const validAttributes = attributes.filter(
          (attr) => attr.key && attr.label && attr.values.some((v) => v.value && v.label)
        );

        if (validAttributes.length === 0) {
          setPreviewVariants([]);
          return;
        }

        // Generate all combinations
        const combinations = generateCombinations(
          validAttributes.map((attr) => attr.values.filter((v) => v.value && v.label))
        );

        const variants = combinations.slice(0, 20).map((combination, index) => {
          // Build variant name
          let variantName = naming_pattern;
          combination.forEach((value, attrIndex) => {
            variantName = variantName.replace(`{attr_${attrIndex}}`, value.label);
            variantName = variantName.replace(`{${validAttributes[attrIndex].key}}`, value.label);
          });

          // Build SKU
          let variantSku = sku_pattern;
          if (variantSku) {
            if (base_sku) {
              variantSku = variantSku.replace("{base_sku}", base_sku);
            }
            combination.forEach((value, attrIndex) => {
              const slugValue = value.value.toLowerCase().replace(/\s+/g, "-");
              variantSku = variantSku!.replace(`{attr_${attrIndex}}`, slugValue);
              variantSku = variantSku!.replace(`{${validAttributes[attrIndex].key}}`, slugValue);
            });
          }

          return {
            name: variantName,
            sku: variantSku || undefined,
            attributes: combination.reduce(
              (acc, value, attrIndex) => {
                acc[validAttributes[attrIndex].key] = value.label;
                return acc;
              },
              {} as Record<string, string>
            ),
            is_default: index === 0,
          };
        });

        setPreviewVariants(variants);
      } catch {
        setPreviewVariants([]);
      }
    };

    generatePreview();
  }, [watchedData]);

  const addAttributeValue = (attributeIndex: number) => {
    const currentValues = form.getValues(`attributes.${attributeIndex}.values`);
    form.setValue(`attributes.${attributeIndex}.values`, [
      ...currentValues,
      { value: "", label: "" },
    ]);
  };

  const removeAttributeValue = (attributeIndex: number, valueIndex: number) => {
    const currentValues = form.getValues(`attributes.${attributeIndex}.values`);
    if (currentValues.length > 1) {
      form.setValue(
        `attributes.${attributeIndex}.values`,
        currentValues.filter((_, index) => index !== valueIndex)
      );
    }
  };

  const handleSubmit = async (data: MatrixFormData) => {
    try {
      setLoading(true);

      const config: VariantMatrixConfig = {
        product_id: productId,
        attributes: data.attributes.map((attr) => ({
          key: attr.key,
          label: attr.label,
          values: attr.values
            .filter((v) => v.value && v.label)
            .map((v) => ({ value: v.value!, label: v.label! })),
          context_scope: attr.context_scope,
        })),
        naming_pattern: data.naming_pattern,
        sku_pattern: data.sku_pattern || undefined,
        base_variant: {
          product_id: productId,
          status: data.base_status,
          sku: data.base_sku,
        },
      };

      await variantService.generateVariantsFromMatrix(
        productId,
        config.attributes.reduce(
          (acc, attr) => {
            acc[attr.key] = attr.values.map((v) => v.value);
            return acc;
          },
          {} as Record<string, string[]>
        ),
        config.base_variant
      );

      toast.success(`Created ${previewVariants.length} variants successfully`);
      onSuccess();
    } catch (error) {
      console.error("Error creating variants matrix:", error);
      toast.error("Failed to create variants matrix");
    } finally {
      setLoading(false);
    }
  };

  const totalCombinations = React.useMemo(() => {
    const validAttributes = watchedData.attributes.filter(
      (attr) => attr.key && attr.label && attr.values.some((v) => v.value && v.label)
    );

    if (validAttributes.length === 0) return 0;

    return validAttributes.reduce((total, attr) => {
      const validValues = attr.values.filter((v) => v.value && v.label).length;
      return total * (validValues || 1);
    }, 1);
  }, [watchedData.attributes]);

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Attributes Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Matrix Attributes
            </CardTitle>
            <CardDescription>
              Define the attributes and their possible values to generate variant combinations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attributeFields.map((field, attributeIndex) => (
              <Card key={field.id} className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-medium">Attribute {attributeIndex + 1}</h4>
                  {attributeFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttribute(attributeIndex)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Attribute Key *</Label>
                    <Input
                      {...form.register(`attributes.${attributeIndex}.key`)}
                      placeholder="e.g., color, size"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Display Label *</Label>
                    <Input
                      {...form.register(`attributes.${attributeIndex}.label`)}
                      placeholder="e.g., Color, Size"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Context</Label>
                    <Controller
                      control={form.control}
                      name={`attributes.${attributeIndex}.context_scope`}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTEXTS.map((context) => {
                              const Icon = context.icon;
                              return (
                                <SelectItem key={context.id} value={context.id}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" style={{ color: context.color }} />
                                    {context.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Attribute Values */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Possible Values *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addAttributeValue(attributeIndex)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Value
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {form.watch(`attributes.${attributeIndex}.values`).map((_, valueIndex) => (
                      <div key={valueIndex} className="flex items-center gap-2">
                        <Input
                          {...form.register(
                            `attributes.${attributeIndex}.values.${valueIndex}.value`
                          )}
                          placeholder="Value (e.g., red, large)"
                          className="flex-1"
                        />
                        <Input
                          {...form.register(
                            `attributes.${attributeIndex}.values.${valueIndex}.label`
                          )}
                          placeholder="Label (e.g., Red, Large)"
                          className="flex-1"
                        />
                        {form.watch(`attributes.${attributeIndex}.values`).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttributeValue(attributeIndex, valueIndex)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                appendAttribute({
                  key: "",
                  label: "",
                  values: [{ value: "", label: "" }],
                  context_scope: "warehouse",
                })
              }
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Attribute
            </Button>
          </CardContent>
        </Card>

        {/* Naming Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Variant Generation Settings</CardTitle>
            <CardDescription>Configure how variants will be named and structured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="naming_pattern">Naming Pattern *</Label>
                <Input
                  id="naming_pattern"
                  {...form.register("naming_pattern")}
                  placeholder="e.g., {color} - {size}"
                />
                <p className="text-sm text-muted-foreground">
                  Use {"{attr_0}"}, {"{attr_1}"}, etc. or {"{attribute_key}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_status">Default Status</Label>
                <Controller
                  control={form.control}
                  name="base_status"
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

              <div className="space-y-2">
                <Label htmlFor="sku_pattern">SKU Pattern (Optional)</Label>
                <Input
                  id="sku_pattern"
                  {...form.register("sku_pattern")}
                  placeholder="e.g., {base_sku}-{color}-{size}"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_sku">Base SKU (Optional)</Label>
                <Input id="base_sku" {...form.register("base_sku")} placeholder="e.g., PROD-001" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewVariants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Preview ({previewVariants.length} of {totalCombinations} variants)
                </span>
                <Badge variant="outline">{totalCombinations} total combinations</Badge>
              </CardTitle>
              <CardDescription>
                Preview of the variants that will be created.
                {previewVariants.length < totalCombinations && " Showing first 20 variants."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {previewVariants.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{variant.name}</span>
                          {variant.is_default && (
                            <Badge variant="default" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        {variant.sku && (
                          <p className="text-sm text-muted-foreground">SKU: {variant.sku}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {previewVariants.length >= 20 && totalCombinations > 20 && (
                    <div className="py-2 text-center text-muted-foreground">
                      ... and {totalCombinations - 20} more variants
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || previewVariants.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Variants...
              </>
            ) : (
              <>
                Create {totalCombinations} Variant{totalCombinations !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Helper function to generate all combinations
function generateCombinations<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map((item) => [item]);

  const result: T[][] = [];
  const [first, ...rest] = arrays;
  const restCombinations = generateCombinations(rest);

  for (const item of first) {
    for (const combination of restCombinations) {
      result.push([item, ...combination]);
    }
  }

  return result;
}
