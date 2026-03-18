"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDefinition } from "../../types/custom-fields";

interface CustomFieldsRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, string | boolean | null>;
  onChange: (fieldId: string, value: string | boolean | null) => void;
  onRemove: (fieldId: string) => void;
}

export function CustomFieldsRenderer({
  fields,
  values,
  onChange,
  onRemove,
}: CustomFieldsRendererProps) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = values[field.id];

        const renderWrapper = (children: React.ReactNode) => (
          <div key={field.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">{children}</div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(field.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );

        switch (field.field_type) {
          case "text":
            return renderWrapper(
              <>
                <Label htmlFor={`custom-field-${field.id}`}>{field.field_name}</Label>
                <Input
                  id={`custom-field-${field.id}`}
                  type="text"
                  value={(value as string) || ""}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.field_name.toLowerCase()}`}
                />
              </>
            );

          case "checkbox":
            return renderWrapper(
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id={`custom-field-${field.id}`}
                  checked={(value as boolean) || false}
                  onCheckedChange={(checked) => onChange(field.id, checked as boolean)}
                />
                <Label
                  htmlFor={`custom-field-${field.id}`}
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.field_name}
                </Label>
              </div>
            );

          case "date":
            const dateValue = value ? new Date(value as string) : undefined;
            return renderWrapper(
              <>
                <Label htmlFor={`custom-field-${field.id}`}>{field.field_name}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      id={`custom-field-${field.id}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateValue}
                      onSelect={(date) =>
                        onChange(field.id, date ? format(date, "yyyy-MM-dd") : null)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </>
            );

          case "dropdown":
            const options = field.dropdown_options
              ? typeof field.dropdown_options === "string"
                ? JSON.parse(field.dropdown_options)
                : field.dropdown_options
              : [];
            return renderWrapper(
              <>
                <Label htmlFor={`custom-field-${field.id}`}>{field.field_name}</Label>
                <Select
                  value={(value as string) || ""}
                  onValueChange={(val) => onChange(field.id, val)}
                >
                  <SelectTrigger id={`custom-field-${field.id}`}>
                    <SelectValue placeholder={`Select ${field.field_name.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(options as string[]).map((option, idx) => (
                      <SelectItem key={idx} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
