"use client";

import * as React from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { customFieldsService } from "../../api/custom-fields-service";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CreateCustomFieldDialog } from "./create-custom-field-dialog";
import { EditCustomFieldDialog } from "./edit-custom-field-dialog";
import { toast } from "react-toastify";
import type { CustomFieldDefinition } from "../../types/custom-fields";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CustomFieldsPage() {
  const { activeOrgId } = useAppStore();
  const [fields, setFields] = React.useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingField, setEditingField] = React.useState<CustomFieldDefinition | null>(null);

  React.useEffect(() => {
    if (activeOrgId) {
      loadFields();
    }
  }, [activeOrgId]);

  async function loadFields() {
    if (!activeOrgId) return;

    try {
      setIsLoading(true);
      const data = await customFieldsService.getFieldDefinitions(activeOrgId);
      setFields(data);
    } catch (error) {
      console.error("Failed to load custom fields:", error);
      toast.error("Failed to load custom fields");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateField(data: {
    field_name: string;
    field_type: "text" | "checkbox" | "date" | "dropdown";
    dropdown_options?: string[];
  }) {
    if (!activeOrgId) return;

    try {
      const newField = await customFieldsService.createFieldDefinition({
        organization_id: activeOrgId,
        field_name: data.field_name,
        field_type: data.field_type,
        dropdown_options: data.dropdown_options,
      });

      setFields((prev) => [...prev, newField]);
      toast.success("Custom field created successfully");
    } catch (error) {
      console.error("Failed to create custom field:", error);
      toast.error("Failed to create custom field");
      throw error;
    }
  }

  async function handleUpdateField(
    fieldId: string,
    updates: { field_name?: string; dropdown_options?: string[] }
  ) {
    try {
      const updatedField = await customFieldsService.updateFieldDefinition(fieldId, updates);
      setFields((prev) => prev.map((f) => (f.id === fieldId ? updatedField : f)));
      toast.success("Custom field updated");
    } catch (error) {
      console.error("Failed to update custom field:", error);
      toast.error("Failed to update custom field");
      throw error;
    }
  }

  async function handleDeleteField(fieldId: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete "${fieldName}"?`)) {
      return;
    }

    try {
      await customFieldsService.deleteFieldDefinition(fieldId);
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      toast.success("Custom field deleted");
    } catch (error) {
      console.error("Failed to delete custom field:", error);
      toast.error("Failed to delete custom field");
    }
  }

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: "Text field",
      dropdown: "Drop-down",
      date: "Date field",
      checkbox: "Checkbox",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Manage custom fields to store additional product information
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Field
        </Button>
      </div>

      {/* Custom Fields List */}
      {fields.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            No custom fields yet. Create your first custom field to capture additional product data.
          </p>
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Custom Field
          </Button>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Field Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Options</th>
                <th className="w-24 px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field) => {
                const options = field.dropdown_options
                  ? typeof field.dropdown_options === "string"
                    ? JSON.parse(field.dropdown_options)
                    : field.dropdown_options
                  : null;

                return (
                  <tr key={field.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{field.field_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {getFieldTypeLabel(field.field_type)}
                    </td>
                    <td className="px-4 py-2">
                      {field.field_type === "dropdown" && options ? (
                        <div className="flex flex-wrap gap-1">
                          {(options as string[]).slice(0, 3).map((opt, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {opt}
                            </Badge>
                          ))}
                          {(options as string[]).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(options as string[]).length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingField(field)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteField(field.id, field.field_name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <CreateCustomFieldDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateField}
      />

      {/* Edit Dialog */}
      <EditCustomFieldDialog
        open={!!editingField}
        onOpenChange={(open) => !open && setEditingField(null)}
        field={editingField}
        onUpdate={handleUpdateField}
      />
    </div>
  );
}
