"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextInputProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "url" | "tel";
  disabled?: boolean;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  maxLength?: number;
  className?: string;
}

export function TextInput({
  name,
  label,
  description,
  placeholder,
  type = "text",
  disabled = false,
  required = false,
  prefix,
  suffix,
  maxLength,
  className,
}: TextInputProps) {
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
          <div className="relative flex items-center">
            {prefix && (
              <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
                {prefix}
              </div>
            )}

            <Input
              {...field}
              id={name}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              className={cn(
                prefix && "pl-10",
                suffix && "pr-10",
                error && "border-red-600 focus-visible:ring-red-600"
              )}
            />

            {suffix && (
              <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground">
                {suffix}
              </div>
            )}
          </div>
        )}
      />

      {error && <p className="text-sm text-red-600">{error.message as string}</p>}
    </div>
  );
}
