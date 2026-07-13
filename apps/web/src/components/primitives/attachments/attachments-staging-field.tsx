"use client";

import { FileText, X } from "lucide-react";
import { AttachmentDropzone, type AttachmentDropzoneLabels } from "./attachment-dropzone";
import { fileKey, formatFileSize } from "./attachment-utils";
import { cn } from "@/utils";

export interface AttachmentsStagingFieldLabels extends AttachmentDropzoneLabels {
  remove?: string;
}

interface AttachmentsStagingFieldProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  labels?: AttachmentsStagingFieldLabels;
  className?: string;
}

/**
 * Attachment picker for creation forms, where the parent entity doesn't exist
 * yet — holds files in memory instead of uploading immediately (uploads
 * require a real targetId, see AttachmentDropzone/uploadAttachmentsAction).
 * The caller uploads `files` once the entity id is known.
 */
export function AttachmentsStagingField({
  files,
  onChange,
  disabled = false,
  labels,
  className,
}: AttachmentsStagingFieldProps) {
  const addFiles = (incoming: File[]) => {
    const existing = new Set(files.map(fileKey));
    onChange([...files, ...incoming.filter((file) => !existing.has(fileKey(file)))]);
  };

  const removeFile = (key: string) => {
    onChange(files.filter((file) => fileKey(file) !== key));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <AttachmentDropzone onUpload={addFiles} disabled={disabled} labels={labels} />

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
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
