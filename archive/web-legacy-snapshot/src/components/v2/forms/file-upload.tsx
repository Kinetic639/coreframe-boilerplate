"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Upload, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface FileUploadProps {
  name: string;
  label: string;
  description?: string;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FileUpload({
  name,
  label,
  description,
  accept,
  maxSize,
  multiple = false,
  disabled = false,
  required = false,
  className,
}: FileUploadProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const [dragActive, setDragActive] = useState(false);
  const error = errors[name];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
        render={({ field }) => {
          const files = field.value as FileList | File[] | null;
          const fileArray = files ? Array.from(files instanceof FileList ? files : files) : [];

          const handleFileChange = (newFiles: FileList | null) => {
            if (!newFiles || newFiles.length === 0) return;

            // Check file size
            if (maxSize) {
              const oversized = Array.from(newFiles).some((file) => file.size > maxSize);
              if (oversized) {
                return; // TODO: Show error toast
              }
            }

            if (multiple) {
              const existing = fileArray;
              const combined = [...existing, ...Array.from(newFiles)];
              field.onChange(combined);
            } else {
              field.onChange(newFiles[0]);
            }
          };

          const handleRemove = (index: number) => {
            if (multiple) {
              const filtered = fileArray.filter((_, i) => i !== index);
              field.onChange(filtered.length > 0 ? filtered : null);
            } else {
              field.onChange(null);
            }
          };

          return (
            <div>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                  dragActive && "border-primary bg-primary/5",
                  error && "border-red-600",
                  disabled && "opacity-50 cursor-not-allowed",
                  !disabled && "cursor-pointer hover:border-primary"
                )}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!disabled) setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  if (!disabled) {
                    handleFileChange(e.dataTransfer.files);
                  }
                }}
              >
                <input
                  type="file"
                  id={name}
                  accept={accept}
                  multiple={multiple}
                  disabled={disabled}
                  onChange={(e) => handleFileChange(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Drag and drop files here, or click to browse
                    </p>
                    {maxSize && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Max size: {formatFileSize(maxSize)}
                      </p>
                    )}
                    {accept && <p className="text-xs text-muted-foreground">Accepted: {accept}</p>}
                  </div>
                </div>
              </div>

              {/* File list */}
              {fileArray.length > 0 && (
                <div className="mt-4 space-y-2">
                  {fileArray.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(index)}
                        disabled={disabled}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />

      {error && <p className="text-sm text-red-600">{error.message as string}</p>}
    </div>
  );
}
