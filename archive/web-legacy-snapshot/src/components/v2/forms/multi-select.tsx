"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  name: string;
  label: string;
  description?: string;
  options: MultiSelectOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function MultiSelect({
  name,
  label,
  description,
  options,
  disabled = false,
  required = false,
  className,
}: MultiSelectProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </Label>

      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${name}-${option.value}`}
                  checked={field.value?.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValues = field.value || [];
                    const newValues = checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: string) => v !== option.value);
                    field.onChange(newValues);
                  }}
                  disabled={disabled || option.disabled}
                />
                <Label
                  htmlFor={`${name}-${option.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        )}
      />

      {error && <p className="text-sm text-red-600">{error.message as string}</p>}
    </div>
  );
}
