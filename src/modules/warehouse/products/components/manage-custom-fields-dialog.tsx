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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customFieldsService } from "@/modules/warehouse/api/custom-fields-service";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

interface CustomFieldConfig {
  id: string;
  field_name: string;
  field_type: "text" | "checkbox" | "date" | "dropdown" | "number";
  dropdown_options?: string[];
}

interface ManageCustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
  onSave?: () => void | Promise<void>;
}

export function ManageCustomFieldsDialog({
  open,
  onOpenChange,
  onSave,
}: ManageCustomFieldsDialogProps) {
  const t = useTranslations("productsModule.customFields");
  const { activeOrgId } = useAppStore();
  const [fields, setFields] = React.useState<CustomFieldConfig[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expandedDropdowns, setExpandedDropdowns] = React.useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = React.useState(false);

  // Load existing custom field definitions for this product
  React.useEffect(() => {
    if (open && activeOrgId) {
      setLoading(true);
      customFieldsService
        .getFieldDefinitions(activeOrgId)
        .then((definitions) => {
          const configs: CustomFieldConfig[] = definitions.map((def) => ({
            id: def.id,
            field_name: def.field_name,
            field_type: def.field_type,
            dropdown_options:
              def.dropdown_options && typeof def.dropdown_options === "string"
                ? JSON.parse(def.dropdown_options)
                : def.dropdown_options || [],
          }));
          setFields(configs);
        })
        .catch((error) => {
          console.error("Failed to load custom fields:", error);
          toast.error(t("errorLoad"));
        })
        .finally(() => setLoading(false));
    }
  }, [open, activeOrgId]);

  const addField = () => {
    const newField: CustomFieldConfig = {
      id: `temp_${Date.now()}`,
      field_name: "",
      field_type: "text",
      dropdown_options: [],
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<CustomFieldConfig>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const toggleDropdown = (id: string) => {
    setExpandedDropdowns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const addDropdownOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field) {
      updateField(fieldId, {
        dropdown_options: [...(field.dropdown_options || []), ""],
      });
    }
  };

  const updateDropdownOption = (fieldId: string, index: number, value: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && field.dropdown_options) {
      const newOptions = [...field.dropdown_options];
      newOptions[index] = value;
      updateField(fieldId, { dropdown_options: newOptions });
    }
  };

  const removeDropdownOption = (fieldId: string, index: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && field.dropdown_options) {
      const newOptions = field.dropdown_options.filter((_, i) => i !== index);
      updateField(fieldId, { dropdown_options: newOptions });
    }
  };

  const handleSave = async () => {
    if (!activeOrgId) return;

    setSaving(true);
    try {
      // Delete old fields and create new ones
      const existingFields = await customFieldsService.getFieldDefinitions(activeOrgId);

      // Delete all existing fields
      for (const field of existingFields) {
        await customFieldsService.deleteFieldDefinition(field.id);
      }

      // Create new fields
      for (const field of fields) {
        if (field.field_name.trim()) {
          await customFieldsService.createFieldDefinition({
            organization_id: activeOrgId,
            field_name: field.field_name,
            field_type: field.field_type,
            dropdown_options: field.dropdown_options,
          });
        }
      }

      toast.success(t("successUpdate"));
      if (onSave) {
        await onSave();
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save custom fields:", error);
      toast.error(t("errorSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : (
            <>
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeField(field.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <span className="font-medium">
                          {t("fieldLabel", { number: index + 1 })}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        <div>
                          <Label className="text-xs">{t("fieldName")}</Label>
                          <Input
                            value={field.field_name}
                            onChange={(e) => updateField(field.id, { field_name: e.target.value })}
                            placeholder={t("fieldNamePlaceholder")}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">{t("typeLabel")}</Label>
                          <Select
                            value={field.field_type}
                            onValueChange={(value: any) =>
                              updateField(field.id, { field_type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">{t("types.text")}</SelectItem>
                              <SelectItem value="dropdown">{t("types.dropdown")}</SelectItem>
                              <SelectItem value="date">{t("types.date")}</SelectItem>
                              <SelectItem value="checkbox">{t("types.checkbox")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {field.field_type === "dropdown" && (
                          <div>
                            <button
                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                              onClick={() => toggleDropdown(field.id)}
                            >
                              {expandedDropdowns.has(field.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              {t("manageDropdownOptions")}
                            </button>

                            {expandedDropdowns.has(field.id) && (
                              <div className="mt-2 space-y-2 rounded-md border p-3">
                                {(field.dropdown_options || []).map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-2">
                                    <Input
                                      value={option}
                                      onChange={(e) =>
                                        updateDropdownOption(field.id, optIndex, e.target.value)
                                      }
                                      placeholder={t("optionPlaceholder", { number: optIndex + 1 })}
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => removeDropdownOption(field.id, optIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addDropdownOption(field.id)}
                                >
                                  {t("addOption")}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addField} className="w-full">
                {t("addField")}
              </Button>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                />
                <Label htmlFor="show-inactive" className="text-sm">
                  {t("showInactive")}
                </Label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
