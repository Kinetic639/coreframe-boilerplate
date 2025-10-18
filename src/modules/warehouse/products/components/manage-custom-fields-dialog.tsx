"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { customFieldsService } from "@/modules/warehouse/api/custom-fields-service";
import type { CustomFieldDefinitionWithValues } from "@/modules/warehouse/types/custom-fields";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { CustomFieldsRenderer } from "./custom-fields-renderer";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";

interface ManageCustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
}

export function ManageCustomFieldsDialog({
  open,
  onOpenChange,
  product,
}: ManageCustomFieldsDialogProps) {
  const { activeOrgId } = useAppStore();
  const [customFields, setCustomFields] = React.useState<CustomFieldDefinitionWithValues[]>([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, any>>({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Load custom fields when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      setLoading(true);
      customFieldsService
        .getFieldDefinitions(activeOrgId)
        .then(setCustomFields)
        .catch((error) => {
          console.error("Failed to load custom fields:", error);
          toast.error("Failed to load custom fields");
        })
        .finally(() => setLoading(false));
    }
  }, [open, activeOrgId]);

  // Load custom field values for the product
  React.useEffect(() => {
    if (open && product?.id) {
      customFieldsService
        .getProductFieldValues(product.id)
        .then((values) => {
          const valueMap: Record<string, any> = {};
          values.forEach((v) => {
            const value = v.value_text ?? v.value_boolean ?? v.value_date ?? v.value_number ?? null;
            valueMap[v.field_definition_id] = value;
          });
          setCustomFieldValues(valueMap);
        })
        .catch((error) => {
          console.error("Failed to load custom field values:", error);
        });
    }
  }, [open, product?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const savePromises = Object.entries(customFieldValues).map(([fieldId, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          return customFieldsService.setFieldValue({
            product_id: product.id,
            field_definition_id: fieldId,
            value,
          });
        }
        return Promise.resolve();
      });
      await Promise.all(savePromises);
      toast.success("Custom fields saved successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save custom field values:", error);
      toast.error("Failed to save custom fields");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Custom Fields</DialogTitle>
          <DialogDescription>Edit custom field values for {product.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading custom fields...
            </div>
          ) : customFields.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No custom fields defined yet. Go to Settings → Custom Fields to create them.
              </p>
            </div>
          ) : (
            <CustomFieldsRenderer
              fields={customFields as any}
              values={customFieldValues}
              onChange={(fieldId, value) => {
                setCustomFieldValues((prev) => ({
                  ...prev,
                  [fieldId]: value,
                }));
              }}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || customFields.length === 0}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
