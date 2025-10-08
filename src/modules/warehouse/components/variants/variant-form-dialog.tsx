"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus } from "lucide-react";
import { useCreateVariant, useUpdateVariant } from "../../hooks/use-product-variants";
import type { Variant } from "../../types/variant-types";

// Form validation schema
const variantFormSchema = z.object({
  name: z.string().min(1, "Variant name is required").max(100, "Name too long"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  attributes: z.record(z.union([z.string(), z.number()])).default({}),
});

type VariantFormData = z.infer<typeof variantFormSchema>;

interface VariantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  variant?: Variant; // For editing
}

export function VariantFormDialog({
  open,
  onOpenChange,
  productId,
  variant,
}: VariantFormDialogProps) {
  const [newAttributeKey, setNewAttributeKey] = React.useState("");
  const [newAttributeValue, setNewAttributeValue] = React.useState("");

  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();

  const isEditing = !!variant;
  const isLoading = createVariant.isPending || updateVariant.isPending;

  const form = useForm<VariantFormData>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: {
      name: variant?.name || "",
      sku: variant?.sku || "",
      barcode: variant?.barcode || "",
      attributes: variant?.attributes || {},
    },
  });

  // Reset form when variant changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: variant?.name || "",
        sku: variant?.sku || "",
        barcode: variant?.barcode || "",
        attributes: variant?.attributes || {},
      });
    }
  }, [open, variant, form]);

  const onSubmit = async (data: VariantFormData) => {
    try {
      if (isEditing && variant) {
        await updateVariant.mutateAsync({
          id: variant.id,
          name: data.name,
          sku: data.sku,
          barcode: data.barcode,
          attributes: data.attributes,
        });
      } else {
        await createVariant.mutateAsync({
          productId,
          data: {
            name: data.name,
            sku: data.sku,
            barcode: data.barcode,
            attributes: data.attributes,
          },
        });
      }
      onOpenChange(false);
      form.reset();
    } catch {
      // Error is handled by the mutation hooks
    }
  };

  const addAttribute = () => {
    if (!newAttributeKey.trim() || !newAttributeValue.trim()) return;

    const currentAttributes = form.getValues("attributes");
    const value = isNaN(Number(newAttributeValue)) ? newAttributeValue : Number(newAttributeValue);

    form.setValue("attributes", {
      ...currentAttributes,
      [newAttributeKey.trim()]: value,
    });

    setNewAttributeKey("");
    setNewAttributeValue("");
  };

  const removeAttribute = (key: string) => {
    const currentAttributes = form.getValues("attributes");
    const rest = Object.fromEntries(Object.entries(currentAttributes).filter(([k]) => k !== key));
    form.setValue("attributes", rest);
  };

  const attributes = form.watch("attributes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Variant" : "Create New Variant"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the variant details below." : "Add a new variant to this product."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Large Red T-Shirt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Attributes */}
            <div className="space-y-3">
              <div>
                <FormLabel>Attributes</FormLabel>
                <FormDescription>
                  Add custom attributes like size, color, material, etc.
                </FormDescription>
              </div>

              {/* Existing Attributes */}
              {Object.entries(attributes).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(attributes).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="flex items-center gap-1 pr-1">
                      <span className="text-xs">
                        {key}: {value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttribute(key)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add New Attribute */}
              <div className="flex gap-2">
                <Input
                  placeholder="Attribute name"
                  value={newAttributeKey}
                  onChange={(e) => setNewAttributeKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={newAttributeValue}
                  onChange={(e) => setNewAttributeValue(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addAttribute}
                  disabled={!newAttributeKey.trim() || !newAttributeValue.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Variant" : "Create Variant"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
