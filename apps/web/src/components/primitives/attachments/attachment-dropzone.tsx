"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  isAllowedAttachmentMimeType,
  MAX_ATTACHMENT_BATCH_SIZE,
  MAX_ATTACHMENT_FILE_SIZE,
} from "@/lib/validations/attachments";
import { cn } from "@/utils";
import { fileKey, formatFileSize } from "./attachment-utils";

export interface AttachmentDropzoneLabels {
  title?: string;
  subtitle?: string;
  browse?: string;
  upload?: string;
  uploading?: string;
  maxSize?: string;
  remove?: string;
}

interface AttachmentDropzoneProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  multiple?: boolean;
  labels?: AttachmentDropzoneLabels;
  className?: string;
}

function defaultAccept() {
  return ALLOWED_ATTACHMENT_MIME_TYPES.join(",");
}

export function AttachmentDropzone({
  onUpload,
  disabled = false,
  uploading = false,
  accept = defaultAccept(),
  multiple = true,
  labels,
  className,
}: AttachmentDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      const validFiles = incoming.filter((file) => {
        if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
          setError(
            labels?.maxSize ?? `Maximum file size is ${formatFileSize(MAX_ATTACHMENT_FILE_SIZE)}.`
          );
          return false;
        }
        if (!isAllowedAttachmentMimeType(file.type)) {
          setError("This file type is not allowed.");
          return false;
        }
        return true;
      });

      setFiles((current) => {
        const existing = new Set(current.map(fileKey));
        const merged = multiple
          ? [...current, ...validFiles.filter((file) => !existing.has(fileKey(file)))]
          : validFiles.slice(0, 1);
        return merged.slice(0, MAX_ATTACHMENT_BATCH_SIZE);
      });
    },
    [labels?.maxSize, multiple]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled || uploading) return;
      addFiles(Array.from(event.dataTransfer.files));
    },
    [addFiles, disabled, uploading]
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(event.target.files ?? []));
      if (inputRef.current) inputRef.current.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback((key: string) => {
    setFiles((current) => current.filter((file) => fileKey(file) !== key));
  }, []);

  const submit = useCallback(() => {
    if (files.length === 0 || disabled || uploading) return;
    onUpload(files);
    setFiles([]);
  }, [disabled, files, onUpload, uploading]);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled && !uploading) {
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          "relative flex cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
          (disabled || uploading) && "cursor-not-allowed opacity-60"
        )}
      >
        <UploadCloud className="h-9 w-9 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{labels?.title ?? "Drop files here"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {labels?.subtitle ?? "Click to browse or drag files into this area."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {labels?.maxSize ?? `Max ${formatFileSize(MAX_ATTACHMENT_FILE_SIZE)} per file.`}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled || uploading}
          onChange={onInputChange}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {files.length > 0 ? (
        <div className="divide-y rounded-md border">
          {files.map((file) => (
            <div key={fileKey(file)} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground transition hover:text-destructive"
                aria-label={labels?.remove ?? "Remove file"}
                onClick={() => removeFile(fileKey(file))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Button
        className="w-full gap-2"
        disabled={files.length === 0 || disabled || uploading}
        onClick={submit}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        {uploading ? (labels?.uploading ?? "Uploading...") : (labels?.upload ?? "Upload")}
      </Button>
    </div>
  );
}
