"use client";

import {
  AlertCircle,
  Camera,
  Check,
  Download,
  Loader2,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  AttachmentList,
  downloadAttachments,
  formatFileSize,
  type AttachmentDropzoneLabels,
  type AttachmentListLabels,
} from "@/components/primitives/attachments";
import {
  attachmentUploadProblem,
  useAttachmentUploadQueue,
  useAttachmentsQuery,
  useDeleteAttachmentMutation,
  type AttachmentUploadItem,
} from "@/hooks/queries/attachments";
import { keepFilesInMemory } from "@/hooks/queries/attachments/direct-upload";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@/lib/validations/attachments";
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
  /** The name of the .zip with several files (without .zip). */
  archiveName?: string;
  onUploaded?: (attachments: AppAttachment[]) => void | Promise<void>;
  onDeleted?: (attachmentId: string) => void | Promise<void>;
}

const ACCEPT = ALLOWED_ATTACHMENT_MIME_TYPES.join(",");

/**
 * The files of one thing (a task, a ticket, a job). "Add files" opens the
 * picker with several files allowed, and each picked file uploads at once
 * with its own progress; files can be dropped on the section too. Ticking
 * files downloads them as one .zip or removes them together.
 */
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
  archiveName,
  onUploaded,
  onDeleted,
}: AttachmentsPanelProps) {
  const t = useTranslations("components.attachments");
  const locale = useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const queryInput = useMemo(() => ({ targetType, targetId }), [targetId, targetType]);
  const attachmentsQuery = useAttachmentsQuery(queryInput, initialData);
  const deleteMutation = useDeleteAttachmentMutation(targetType, targetId);
  const queue = useAttachmentUploadQueue(targetType, targetId, (attachment) => {
    void onUploaded?.([attachment]);
  });

  const rows = useMemo(
    () => attachmentsQuery.data ?? initialData ?? [],
    [attachmentsQuery.data, initialData]
  );
  const loadingInitial = !initialData && attachmentsQuery.isPending;
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const removable = selectedRows.filter((row) => canDelete && row.is_own);

  const listLabels = {
    empty: labels?.empty ?? t("empty"),
    download: labels?.download ?? t("download"),
    remove: labels?.remove ?? t("remove"),
    preview: labels?.preview ?? t("preview"),
    previewUnavailable: labels?.previewUnavailable ?? t("previewUnavailable"),
    openPreviewPage: labels?.openPreviewPage ?? t("openPreviewPage"),
    actions: labels?.actions ?? t("actions"),
    select: t("select"),
  };

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const download = async (files: AppAttachment[]) => {
    setDownloading(true);
    try {
      await downloadAttachments(files, locale, archiveName ?? t("archiveName"));
    } catch (error) {
      toast.error(
        error instanceof Error ? `${t("downloadFailed")} ${error.message}` : t("downloadFailed")
      );
    } finally {
      setDownloading(false);
    }
  };

  const deleteSelected = async () => {
    setBulkDeleting(true);
    for (const row of removable) {
      try {
        await deleteMutation.mutateAsync(row.id);
        await onDeleted?.(row.id);
      } catch {
        // The mutation already said what went wrong; carry on with the rest.
      }
    }
    setBulkDeleting(false);
    setConfirmDelete(false);
    setSelected(new Set());
  };

  // Copied into memory first: on iPhones a picked file can stop being readable later.
  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    void keepFilesInMemory(files).then((copies) => queue.add(copies));
  };

  return (
    <section
      className={cn(
        "min-w-0 space-y-3 rounded-md transition-shadow",
        dragging && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        className
      )}
      onDragEnter={(event) => {
        if (!canUpload || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (canUpload && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!canUpload) return;
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files);
      }}
    >
      {showTitle ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-sm font-semibold">
              {labels?.sectionTitle ?? t("title")}
              <span className="ml-1.5 font-normal text-muted-foreground">{rows.length}</span>
            </h2>
            {attachmentsQuery.isFetching && rows.length > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {canUpload ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-md border-input bg-transparent px-2.5 text-sm font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground sm:hidden"
                onClick={() => cameraInput.current?.click()}
                aria-label={t("takePhoto")}
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-md border-input bg-transparent px-2.5 text-sm font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => fileInput.current?.click()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addFiles")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {canUpload ? (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
        </>
      ) : null}

      {queue.items.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {queue.items.map((item) => (
            <UploadRow
              key={item.key}
              item={item}
              onRetry={() => queue.retry(item.key)}
              onDismiss={() => queue.dismiss(item.key)}
            />
          ))}
        </ul>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm">
          <span className="font-medium">{t("selectedCount", { count: selected.size })}</span>
          <div className="ml-auto flex items-center gap-1">
            {selected.size < rows.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setSelected(new Set(rows.map((row) => row.id)))}
              >
                {t("selectAll")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 tabular-nums"
              disabled={downloading}
              onClick={() => void download(selectedRows)}
              aria-label={`${t("download")} (${selectedRows.length})`}
              title={t("download")}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {selectedRows.length}
            </Button>
            {removable.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 tabular-nums text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label={t("removeSelected", { count: removable.length })}
                title={t("removeSelected", { count: removable.length })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {removable.length}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setSelected(new Set())}
            >
              {t("clearSelection")}
            </Button>
          </div>
        </div>
      ) : null}

      {loadingInitial ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {labels?.loading ?? t("loading")}
        </div>
      ) : rows.length === 0 && canUpload && queue.items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <span className="font-medium text-foreground">{t("emptyCta")}</span>
          <span className="text-xs">{t("emptyHint")}</span>
        </button>
      ) : (
        <AttachmentList
          attachments={rows}
          canDelete={(attachment) => canDelete && attachment.is_own}
          deletingId={deletingId}
          labels={listLabels}
          className={cn("sm:grid-cols-2", listClassName)}
          selectedIds={rows.length > 1 ? selected : undefined}
          onToggleSelected={rows.length > 1 ? toggle : undefined}
          onDelete={
            canDelete
              ? (attachmentId) => {
                  setDeletingId(attachmentId);
                  deleteMutation.mutate(attachmentId, {
                    onSettled: () => setDeletingId(null),
                    onSuccess: () => {
                      setSelected((current) => {
                        const next = new Set(current);
                        next.delete(attachmentId);
                        return next;
                      });
                      void onDeleted?.(attachmentId);
                    },
                  });
                }
              : undefined
          }
        />
      )}

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !bulkDeleting && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeSelectedTitle", { count: removable.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removable.map((row) => row.file_name).join(", ")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteSelected();
              }}
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("removeSelected", { count: removable.length })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function UploadRow({
  item,
  onRetry,
  onDismiss,
}: {
  item: AttachmentUploadItem;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("components.attachments");
  const percent = Math.round(item.progress * 100);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.file.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(item.file.size)}
          </span>
        </div>
        {item.status === "error" ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.error}</span>
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  item.status === "done" ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${item.status === "queued" ? 0 : percent}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
              {item.status === "queued"
                ? t("queued")
                : item.status === "done"
                  ? t("uploaded")
                  : `${percent}%`}
            </span>
          </div>
        )}
      </div>
      {item.status === "done" ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : item.status === "error" ? (
        <div className="flex shrink-0 items-center">
          {attachmentUploadProblem(item.file) === null ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRetry}
              aria-label={t("retry")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDismiss}
            aria-label={t("dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : item.status === "queued" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onDismiss}
          aria-label={t("dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      )}
    </li>
  );
}
