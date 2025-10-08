"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, AlertCircle, HelpCircle, Currency } from "lucide-react";
import type { ProductAttributeDefinition as TemplateAttributeDefinition } from "@/modules/warehouse/types/template";

interface DynamicFormFieldProps {
  attribute: TemplateAttributeDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  locale?: string;
}

export function DynamicFormField({
  attribute,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required,
  className,
  locale = "en",
}: DynamicFormFieldProps) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Get localized label and help text
  const label = React.useMemo(() => {
    if (typeof attribute.label === "object" && attribute.label) {
      return attribute.label[locale] || attribute.label["en"] || attribute.slug;
    }
    return attribute.slug;
  }, [attribute.label, attribute.slug, locale]);

  const placeholder = React.useMemo(() => {
    if (attribute.placeholder && typeof attribute.placeholder === "object") {
      return attribute.placeholder[locale] || attribute.placeholder["en"] || "";
    }
    return "";
  }, [attribute.placeholder, locale]);

  const helpText = React.useMemo(() => {
    if (attribute.help_text && typeof attribute.help_text === "object") {
      return attribute.help_text[locale] || attribute.help_text["en"] || "";
    }
    return "";
  }, [attribute.help_text, locale]);

  const isRequired = required !== undefined ? required : attribute.is_required;

  const renderField = () => {
    switch (attribute.data_type) {
      case "text":
        if (attribute.input_type === "textarea") {
          return (
            <Textarea
              id={attribute.slug}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(error && "border-red-500")}
              rows={4}
            />
          );
        }

        if (attribute.input_type === "email") {
          return (
            <Input
              id={attribute.slug}
              type="email"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(error && "border-red-500")}
            />
          );
        }

        if (attribute.input_type === "url") {
          return (
            <Input
              id={attribute.slug}
              type="url"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(error && "border-red-500")}
            />
          );
        }

        if (attribute.input_type === "select" && attribute.validation_rules?.options) {
          return (
            <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
              <SelectTrigger className={cn(error && "border-red-500")}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {attribute.validation_rules.options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return (
          <Input
            id={attribute.slug}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(error && "border-red-500")}
          />
        );

      case "number":
        return (
          <div className="relative">
            {attribute.validation_rules?.currency && (
              <Currency className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              id={attribute.slug}
              type="number"
              value={value ?? ""}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              onBlur={onBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                error && "border-red-500",
                attribute.validation_rules?.currency && "pl-10"
              )}
              min={attribute.validation_rules?.min}
              max={attribute.validation_rules?.max}
              step={attribute.validation_rules?.step || "any"}
            />
          </div>
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={attribute.slug}
              checked={Boolean(value)}
              onCheckedChange={onChange}
              disabled={disabled}
            />
            <Label htmlFor={attribute.slug} className="text-sm font-normal">
              {value ? "Yes" : "No"}
            </Label>
          </div>
        );

      case "date":
        return (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id={attribute.slug}
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground",
                  error && "border-red-500"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "PPP") : placeholder || "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => {
                  onChange(date ? date.toISOString().split("T")[0] : "");
                  setIsCalendarOpen(false);
                }}
                disabled={disabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "json":
        return (
          <Textarea
            id={attribute.slug}
            value={value ? JSON.stringify(value, null, 2) : ""}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Keep the raw string value for now
                onChange(e.target.value);
              }
            }}
            onBlur={onBlur}
            placeholder={placeholder || "{}"}
            disabled={disabled}
            className={cn(error && "border-red-500", "font-mono text-sm")}
            rows={6}
          />
        );

      default:
        return (
          <Input
            id={attribute.slug}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(error && "border-red-500")}
          />
        );
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={attribute.slug}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error && "text-red-600"
          )}
        >
          {label}
          {isRequired && <span className="ml-1 text-red-500">*</span>}
        </Label>

        {/* Context indicator */}
        <Badge variant="outline" className="text-xs">
          {attribute.context_scope}
        </Badge>

        {/* Help text indicator */}
        {helpText && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">{label}</h4>
                <p className="text-sm text-muted-foreground">{helpText}</p>
                {attribute.validation_rules && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Validation:</strong>
                    <ul className="mt-1 list-disc pl-4">
                      {attribute.validation_rules.min && (
                        <li>Minimum: {attribute.validation_rules.min}</li>
                      )}
                      {attribute.validation_rules.max && (
                        <li>Maximum: {attribute.validation_rules.max}</li>
                      )}
                      {attribute.validation_rules.pattern && (
                        <li>Pattern: {attribute.validation_rules.pattern}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Field input */}
      {renderField()}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Field description */}
      {attribute.description && typeof attribute.description === "object" && (
        <p className="text-xs text-muted-foreground">
          {attribute.description[locale] || attribute.description["en"]}
        </p>
      )}
    </div>
  );
}

interface DynamicFormFieldsProps {
  attributes: TemplateAttributeDefinition[];
  values: Record<string, any>;
  errors: Record<string, string | null>;
  onChange: (fieldKey: string, value: any) => void;
  onBlur?: (fieldKey: string) => void;
  disabled?: boolean;
  context?: string;
  locale?: string;
  className?: string;
}

export function DynamicFormFields({
  attributes,
  values,
  errors,
  onChange,
  onBlur,
  disabled = false,
  context,
  locale = "en",
  className,
}: DynamicFormFieldsProps) {
  // Filter attributes by context if specified
  const filteredAttributes = React.useMemo(() => {
    if (!context) return attributes;
    return attributes.filter((attr) => attr.context_scope === context);
  }, [attributes, context]);

  // Sort attributes by display_order
  const sortedAttributes = React.useMemo(() => {
    return [...filteredAttributes].sort((a, b) => a.display_order - b.display_order);
  }, [filteredAttributes]);

  if (sortedAttributes.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        No attributes found for this context.
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {sortedAttributes.map((attribute) => (
        <DynamicFormField
          key={attribute.id}
          attribute={attribute}
          value={values[attribute.slug]}
          onChange={(value) => onChange(attribute.slug, value)}
          onBlur={() => onBlur?.(attribute.slug)}
          error={errors[attribute.slug]}
          disabled={disabled}
          locale={locale}
        />
      ))}
    </div>
  );
}
