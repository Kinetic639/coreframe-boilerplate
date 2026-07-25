"use client";

import { Loader2, Paperclip, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
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
  AttachmentDropzone,
  AttachmentList,
  type AttachmentDropzoneLabels,
  type AttachmentListLabels,
} from "@/components/primitives/attachments";
import {
  useAttachmentsQuery,
  useDeleteAttachmentMutation,
  useUploadAttachmentsMutation,
} from "@/hooks/queries/attachments";
import type { AppAttachment } from "@/server/services/attachments.service";
import { cn } from "@/utils";

type AttachmentsPanelLabels = AttachmentDropzoneLabels &
  AttachmentListLabels & {
    sectionTitle?: string;
    files?: string;
    add?: string;
    loading?: string;
  };

interface AttachmentsPanelProps {
  targetType: string;
  targetId: string;
  initialData?: AppAttachment[];
  canUpload?: boolean;
  canDelete?: boolean;
  showTitle?: boolean;
  className?: string;
  listClassName?: string;
  labels?: AttachmentsPanelLabels;
  onUploaded?: (attachments: AppAttachment[]) => void | Promise<void>;
  onDeleted?: (attachmentId: string) => void | Promise<void>;
}

export function AttachmentsPanel({
  targetType,
  targetId,
  initialData,
  canUpload = true,
  canDelete = true,
  showTitle = true,
  className,
  listClassName,
  labels,
  onUploaded,
  onDeleted,
}: AttachmentsPanelProps) {
  const t = useTranslations("components.attachments");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const queryInput = useMemo(() => ({ targetType, targetId }), [targetId, targetType]);
  const attachmentsQuery = useAttachmentsQuery(queryInput, initialData);
  const uploadMutation = useUploadAttachmentsMutation(targetType, targetId);
  const deleteMutation = useDeleteAttachmentMutation(targetType, targetId);

  const rows = attachmentsQuery.data ?? initialData ?? [];
  const loadingInitial = !initialData && attachmentsQuery.isPending;

  const dropzoneLabels = {
    title: labels?.title ?? t("dropzoneTitle"),
    subtitle: labels?.subtitle ?? t("dropzoneSubtitle"),
    upload: labels?.upload ?? t("upload"),
    uploading: labels?.uploading ?? t("uploading"),
    maxSize: labels?.maxSize ?? t("maxSize"),
    remove: labels?.remove ?? t("remove"),
  };

  const listLabels = {
    empty: labels?.empty ?? t("empty"),
    download: labels?.download ?? t("download"),
    remove: labels?.remove ?? t("remove"),
    preview: labels?.preview ?? t("preview"),
    previewUnavailable: labels?.previewUnavailable ?? t("previewUnavailable"),
    openPreviewPage: labels?.openPreviewPage ?? t("openPreviewPage"),
    actions: labels?.actions ?? t("actions"),
  };

  return (
    <section className={cn("min-w-0 space-y-4", className)}>
      {showTitle ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-sm font-semibold">
              {labels?.sectionTitle ?? t("title")} ({rows.length})
            </h2>
            {attachmentsQuery.isFetching && rows.length > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {canUpload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setUploadOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {labels?.add ?? t("add")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loadingInitial ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {labels?.loading ?? t("loading")}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels?.files ?? t("files")}
            </p>
          ) : null}
          <AttachmentList
            attachments={rows}
            canDelete={(attachment) => canDelete && attachment.is_own}
            deletingId={deletingId}
            labels={listLabels}
            className={listClassName}
            onDelete={
              canDelete
                ? (attachmentId) => {
                    setDeletingId(attachmentId);
                    deleteMutation.mutate(attachmentId, {
                      onSettled: () => setDeletingId(null),
                      onSuccess: () => void onDeleted?.(attachmentId),
                    });
                  }
                : undefined
            }
          />
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{labels?.add ?? t("add")}</DialogTitle>
            <DialogDescription>{labels?.subtitle ?? t("dropzoneSubtitle")}</DialogDescription>
          </DialogHeader>
          <AttachmentDropzone
            labels={dropzoneLabels}
            uploading={uploadMutation.isPending}
            onUpload={(files) => {
              uploadMutation.mutate(files, {
                onSuccess: (attachments) => {
                  setUploadOpen(false);
                  void onUploaded?.(attachments);
                },
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
