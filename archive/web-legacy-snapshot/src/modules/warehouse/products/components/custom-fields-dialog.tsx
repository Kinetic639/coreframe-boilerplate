"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { customFieldsService } from "@/modules/warehouse/api/custom-fields-service";
import type { ProductCustomFieldDefinition } from "@/modules/warehouse/types/products";
import { useAppStore } from "@/lib/stores/app-store";

interface CustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string; // If provided, show field values for this product
  onFieldsUpdated?: () => void;
}

export function CustomFieldsDialog({
  open,
  onOpenChange,
  onFieldsUpdated,
}: CustomFieldsDialogProps) {
  const t = useTranslations("productsModule");
  const { activeOrgId } = useAppStore();
  const [fields, setFields] = React.useState<ProductCustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingField, setEditingField] = React.useState<ProductCustomFieldDefinition | null>(null);
  const [isAddingNew, setIsAddingNew] = React.useState(false);

  // Form schema for field definition
  const fieldSchema = z.object({
    field_name: z.string().min(1, "Field name is required"),
    field_type: z.enum(["text", "number", "date", "dropdown", "checkbox"]),
    dropdown_options: z.string().optional(),
  });

  type FieldFormValues = z.infer<typeof fieldSchema>;

  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      field_name: "",
      field_type: "text",
      dropdown_options: "",
    },
  });

  // Load field definitions
  const loadFields = React.useCallback(async () => {
    if (!activeOrgId) return;

    setIsLoading(true);
    try {
      const definitions = await customFieldsService.getFieldDefinitions(activeOrgId);
      setFields(definitions);
    } catch (error) {
      console.error("Error loading custom fields:", error);
      toast.error("Failed to load custom fields");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId]);

  React.useEffect(() => {
    if (open) {
      loadFields();
    }
  }, [open, loadFields]);

  const onSubmit = async (values: FieldFormValues) => {
    if (!activeOrgId) {
      toast.error("Organization ID is required");
      return;
    }

    setIsSaving(true);

    try {
      const dropdownOptions =
        values.field_type === "dropdown" && values.dropdown_options
          ? values.dropdown_options
              .split(",")
              .map((opt) => opt.trim())
              .filter((opt) => opt.length > 0)
          : null;

      if (editingField) {
        // Update existing field
        await customFieldsService.updateFieldDefinition(editingField.id, {
          field_name: values.field_name,
          field_type: values.field_type,
          dropdown_options: dropdownOptions,
        });
        toast.success("Custom field updated successfully");
      } else {
        // Create new field
        await customFieldsService.createFieldDefinition({
          organization_id: activeOrgId,
          field_name: values.field_name,
          field_type: values.field_type,
          dropdown_options: dropdownOptions,
          display_order: fields.length,
        });
        toast.success("Custom field created successfully");
      }

      form.reset();
      setEditingField(null);
      setIsAddingNew(false);
      loadFields();
      onFieldsUpdated?.();
    } catch (error) {
      console.error("Error saving custom field:", error);
      toast.error("Failed to save custom field");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (field: ProductCustomFieldDefinition) => {
    setEditingField(field);
    setIsAddingNew(true);
    form.reset({
      field_name: field.field_name,
      field_type: field.field_type,
      dropdown_options: field.dropdown_options
        ? (field.dropdown_options as string[]).join(", ")
        : "",
    });
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm("Are you sure you want to delete this custom field?")) return;

    try {
      await customFieldsService.deleteFieldDefinition(fieldId);
      toast.success("Custom field deleted successfully");
      loadFields();
      onFieldsUpdated?.();
    } catch (error) {
      console.error("Error deleting custom field:", error);
      toast.error("Failed to delete custom field");
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setIsAddingNew(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("customFields.title")}</DialogTitle>
          <DialogDescription>{t("customFields.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Fields List */}
          {!isAddingNew && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Custom Fields</h3>
                <Button onClick={() => setIsAddingNew(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : fields.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No custom fields defined yet. Click "Add Field" to create one.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <Card key={field.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{field.field_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Type: {field.field_type}
                              {field.field_type === "dropdown" && field.dropdown_options && (
                                <span className="ml-2">
                                  ({(field.dropdown_options as string[]).length} options)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(field)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(field.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Field Form */}
          {isAddingNew && (
            <Card>
              <CardHeader>
                <CardTitle>{editingField ? "Edit Custom Field" : "Add Custom Field"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="field_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Warranty Period" {...field} />
                          </FormControl>
                          <FormDescription>The name of this custom field</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="field_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select field type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="dropdown">Dropdown</SelectItem>
                              <SelectItem value="checkbox">Checkbox</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("field_type") === "dropdown" && (
                      <FormField
                        control={form.control}
                        name="dropdown_options"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dropdown Options</FormLabel>
                            <FormControl>
                              <Input placeholder="Option 1, Option 2, Option 3" {...field} />
                            </FormControl>
                            <FormDescription>Comma-separated list of options</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingField ? "Update Field" : "Create Field"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
