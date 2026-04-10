"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  CustomFieldDefinition,
  CustomFieldValue,
} from "@/modules/warehouse/types/custom-fields";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";

interface CustomFieldsInlineEditorProps {
  productId: string;
  fieldDefinitions: CustomFieldDefinition[];
  fieldValues: CustomFieldValue[];
  onValueChange: (fieldDefinitionId: string, value: any) => Promise<void>;
}

export function CustomFieldsInlineEditor({
  fieldDefinitions,
  fieldValues,
  onValueChange,
}: CustomFieldsInlineEditorProps) {
  const t = useTranslations("productsModule.customFields");
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [localValues, setLocalValues] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    const valuesMap: Record<string, any> = {};
    fieldValues.forEach((v) => {
      const value = v.value_text ?? v.value_number ?? v.value_boolean ?? v.value_date ?? null;
      valuesMap[v.field_definition_id] = value;
    });
    setLocalValues(valuesMap);
  }, [fieldValues]);

  const handleBlur = async (fieldId: string) => {
    setEditingField(null);
    const value = localValues[fieldId];
    // Save even if empty - allows clearing values
    await onValueChange(fieldId, value || "");
  };

  const handleChange = (fieldId: string, value: any) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleKeyDown = async (e: React.KeyboardEvent, fieldId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleBlur(fieldId);
    }
  };

  const renderField = (fieldDef: CustomFieldDefinition) => {
    const value = localValues[fieldDef.id];
    const isEditing = editingField === fieldDef.id;

    switch (fieldDef.field_type) {
      case "text":
        if (isEditing) {
          return (
            <Input
              value={value || ""}
              onChange={(e) => handleChange(fieldDef.id, e.target.value)}
              onBlur={() => handleBlur(fieldDef.id)}
              onKeyDown={(e) => handleKeyDown(e, fieldDef.id)}
              autoFocus
              className="h-7 text-sm"
            />
          );
        }
        return (
          <div
            className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-muted/50"
            onClick={() => setEditingField(fieldDef.id)}
          >
            {value || <span className="text-muted-foreground">{t("enterData")}</span>}
          </div>
        );

      case "dropdown":
        const options =
          fieldDef.dropdown_options && typeof fieldDef.dropdown_options === "string"
            ? JSON.parse(fieldDef.dropdown_options)
            : fieldDef.dropdown_options || [];

        return (
          <Select
            value={value || ""}
            onValueChange={async (newValue) => {
              handleChange(fieldDef.id, newValue);
              await onValueChange(fieldDef.id, newValue);
            }}
          >
            <SelectTrigger className="h-7 text-sm">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {(options as string[]).map((option, idx) => (
                <SelectItem key={idx} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 justify-start text-left text-sm font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? (
                  format(new Date(value), "PPP", { locale: dateLocale })
                ) : (
                  <span>{t("pickDate")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={async (date) => {
                  if (date) {
                    const isoDate = date.toISOString();
                    handleChange(fieldDef.id, isoDate);
                    await onValueChange(fieldDef.id, isoDate);
                  }
                }}
                locale={dateLocale}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!value}
              onCheckedChange={async (checked) => {
                handleChange(fieldDef.id, checked);
                await onValueChange(fieldDef.id, checked);
              }}
            />
            <span className="text-sm">{value ? t("yes") : t("no")}</span>
          </div>
        );

      default:
        return <span className="text-sm text-muted-foreground">{t("enterData")}</span>;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-x-12 gap-y-4">
      {fieldDefinitions.map((fieldDef) => (
        <div key={fieldDef.id}>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {fieldDef.field_name}
          </div>
          {renderField(fieldDef)}
        </div>
      ))}
    </div>
  );
}
