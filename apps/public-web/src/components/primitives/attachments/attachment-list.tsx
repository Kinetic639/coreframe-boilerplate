"use client";

/* eslint-disable @next/next/no-img-element -- Attachment previews use private signed URLs. */

import {
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { AppAttachment } from "@/server/services/attachments.service";
import { cn } from "@/utils";
import { formatFileSize, isImageMimeType } from "./attachment-utils";

export interface AttachmentListLabels {
  empty?: string;
  download?: string;
  remove?: string;
  preview?: string;
  previewUnavailable?: string;
  openPreviewPage?: string;
  actions?: string;
}

interface AttachmentListProps {
  attachments: AppAttachment[];
  onDelete?: (attachmentId: string) => void;
  deletingId?: string | null;
  canDelete?: (attachment: AppAttachment) => boolean;
  labels?: AttachmentListLabels;
  className?: string;
}

function FileIcon({ contentType }: { contentType: string }) {
  if (isImageMimeType(contentType)) return <FileImage className="h-4 w-4" />;
  if (contentType === "application/pdf") return <FileText className="h-4 w-4" />;
  return <FileArchive className="h-4 w-4" />;
}

function canPreview(attachment: AppAttachment): boolean {
  return isImageMimeType(attachment.content_type) || attachment.content_type === "application/pdf";
}

function attachmentFileParams(attachment: AppAttachment): {
  attachmentId: string;
  fileName: string;
} {
  return {
    attachmentId: attachment.id,
    fileName: attachment.file_name,
  };
}

function localizedAttachmentFilePath(
  attachment: AppAttachment,
  locale: string,
  download = false
): string {
  const base = locale === "en" ? "/en/attachments" : "/zalaczniki";
  const action = locale === "en" ? "download" : "pobierz";
  const path = `${base}/${attachment.id}/${action}/${encodeURIComponent(attachment.file_name)}`;
  return download ? `${path}?download=1` : path;
}

export function AttachmentList({
  attachments,
  onDelete,
  deletingId,
  canDelete,
  labels,
  className,
}: AttachmentListProps) {
  const locale = useLocale();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewAttachment = useMemo(
    () => attachments.find((attachment) => attachment.id === previewId) ?? null,
    [attachments, previewId]
  );

  if (attachments.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {labels?.empty ?? "No attachments."}
      </p>
    );
  }

  return (
    <>
      <div className={cn("grid gap-2", className)}>
        {attachments.map((attachment) => {
          const canRemove = onDelete && (canDelete ? canDelete(attachment) : attachment.is_own);
          const isPreviewable = canPreview(attachment);
          const fileUrl = localizedAttachmentFilePath(attachment, locale);
          const fileHref = {
            pathname: "/attachments/[attachmentId]/download/[fileName]",
            params: attachmentFileParams(attachment),
          } as const;
          const downloadHref = { ...fileHref, query: { download: "1" } } as const;

          return (
            <div
              key={attachment.id}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-md border bg-card p-2",
                isPreviewable && "transition-colors hover:bg-muted/40"
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted text-muted-foreground",
                  isPreviewable && "cursor-pointer"
                )}
                disabled={!isPreviewable}
                onClick={() => setPreviewId(attachment.id)}
                aria-label={labels?.preview ?? "Preview attachment"}
              >
                {isImageMimeType(attachment.content_type) ? (
                  <img src={fileUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FileIcon contentType={attachment.content_type} />
                )}
              </button>

              <button
                type="button"
                className={cn("min-w-0 flex-1 text-left", isPreviewable && "cursor-pointer")}
                disabled={!isPreviewable}
                onClick={() => setPreviewId(attachment.id)}
              >
                <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size_bytes)} · {attachment.author?.name ?? "Unknown"}
                </p>
              </button>

              <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Link
                  href={fileHref}
                  target="_blank"
                  aria-label={labels?.openPreviewPage ?? "Open file"}
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={labels?.actions ?? "Attachment actions"}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={downloadHref} target="_blank">
                      <Download className="h-4 w-4" />
                      {labels?.download ?? "Download"}
                    </Link>
                  </DropdownMenuItem>
                  {canRemove ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={deletingId === attachment.id}
                        onSelect={() => onDelete(attachment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {labels?.remove ?? "Remove attachment"}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => !open && setPreviewId(null)}
      >
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          {previewAttachment ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{previewAttachment.file_name}</DialogTitle>
                <DialogDescription>
                  {formatFileSize(previewAttachment.size_bytes)}
                  {previewAttachment.author?.name ? ` · ${previewAttachment.author.name}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20">
                {isImageMimeType(previewAttachment.content_type) ? (
                  <img
                    src={localizedAttachmentFilePath(previewAttachment, locale)}
                    alt={previewAttachment.file_name}
                    className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                  />
                ) : previewAttachment.content_type === "application/pdf" ? (
                  <iframe
                    src={localizedAttachmentFilePath(previewAttachment, locale)}
                    title={previewAttachment.file_name}
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <div className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
                    {labels?.previewUnavailable ?? "Preview is not available for this file."}
                  </div>
                )}
              </div>

              <Button asChild variant="outline" className="self-start">
                <a
                  href={localizedAttachmentFilePath(previewAttachment, locale, true)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" />
                  {labels?.download ?? "Download"}
                </a>
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
