"use client";

import { useFormContext, Controller } from "react-hook-form";
import {
  Select as SelectUI,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function Select({
  name,
  label,
  description,
  placeholder = "Select an option",
  options,
  disabled = false,
  required = false,
  className,
}: SelectProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </Label>

      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <SelectUI onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
            <SelectTrigger
              id={name}
              className={cn(error && "border-red-600 focus-visible:ring-red-600")}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectUI>
        )}
      />

      {error && <p className="text-sm text-red-600">{error.message as string}</p>}
    </div>
  );
}
