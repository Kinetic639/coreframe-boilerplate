"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Textarea as TextareaUI } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextareaProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}

export function Textarea({
  name,
  label,
  description,
  placeholder,
  disabled = false,
  required = false,
  rows = 4,
  maxLength,
  className,
}: TextareaProps) {
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
          <>
            <TextareaUI
              {...field}
              id={name}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              maxLength={maxLength}
              className={cn(error && "border-red-600 focus-visible:ring-red-600")}
            />
            {maxLength && (
              <p className="text-xs text-muted-foreground text-right">
                {field.value?.length || 0}/{maxLength}
              </p>
            )}
          </>
        )}
      />

      {error && <p className="text-sm text-red-600">{error.message as string}</p>}
    </div>
  );
}
