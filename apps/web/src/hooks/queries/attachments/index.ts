"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useCallback, useRef, useState } from "react";
import { deleteAttachmentAction, listAttachmentsForTargetAction } from "@/app/actions/attachments";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import type { ListAttachmentsInput } from "@/lib/validations/attachments";
import type { AppAttachment } from "@/server/services/attachments.service";
import {
  attachmentUploadProblem,
  uploadAttachmentDirect,
  type AttachmentUploadProblem,
} from "./direct-upload";

export { attachmentUploadProblem, type AttachmentUploadProblem } from "./direct-upload";

export const attachmentsKeys = {
  all: ["attachments"] as const,
  target: (targetType: string, targetId: string) =>
    [...attachmentsKeys.all, "target", targetType, targetId] as const,
};

export function useAttachmentsQuery(input: ListAttachmentsInput, initialData?: AppAttachment[]) {
  return useQuery({
    queryKey: attachmentsKeys.target(input.targetType, input.targetId),
    queryFn: async () => {
      const result = await listAttachmentsForTargetAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

function mergeAttachments(current: AppAttachment[] | undefined, added: AppAttachment[]) {
  const byId = new Map((current ?? []).map((attachment) => [attachment.id, attachment]));
  added.forEach((attachment) => byId.set(attachment.id, attachment));
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Uploads files (each straight to storage) and resolves with all of them once done. */
export function useUploadAttachmentsMutation(targetType: string, targetId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("components.attachments");
  const orgId = useAppStoreV2((state) => state.activeOrgId);
  const queryKey = attachmentsKeys.target(targetType, targetId);

  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!orgId) throw new Error("Unauthorized");
      const problem = files.map(attachmentUploadProblem).find(Boolean);
      if (problem) throw new Error(t(`problem.${problem}`));
      const uploaded: AppAttachment[] = [];
      for (const file of files) {
        uploaded.push(await uploadAttachmentDirect({ orgId, targetType, targetId, file }));
      }
      return uploaded;
    },
    onSuccess: (attachments) => {
      queryClient.setQueryData<AppAttachment[]>(queryKey, (current) =>
        mergeAttachments(current, attachments)
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("uploadFailed"));
    },
  });
}

export type AttachmentUploadStatus = "queued" | "uploading" | "done" | "error";

export interface AttachmentUploadItem {
  key: string;
  file: File;
  status: AttachmentUploadStatus;
  /** 0..1 */
  progress: number;
  error: string | null;
}

const UPLOAD_CONCURRENCY = 3;

/**
 * A queue of files being attached, each with its own progress: picking files
 * starts them at once (three at a time), a failed one can be retried or
 * dismissed while the rest carry on.
 */
export function useAttachmentUploadQueue(
  targetType: string,
  targetId: string,
  onUploaded?: (attachment: AppAttachment) => void
) {
  const queryClient = useQueryClient();
  const t = useTranslations("components.attachments");
  const orgId = useAppStoreV2((state) => state.activeOrgId);
  const [items, setItems] = useState<AttachmentUploadItem[]>([]);
  const running = useRef(0);
  const pending = useRef<AttachmentUploadItem[]>([]);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const update = useCallback((key: string, patch: Partial<AttachmentUploadItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const pump = useCallback(() => {
    while (running.current < UPLOAD_CONCURRENCY && pending.current.length > 0) {
      const item = pending.current.shift()!;
      running.current += 1;
      update(item.key, { status: "uploading", progress: 0, error: null });
      uploadAttachmentDirect({
        orgId: orgId ?? "",
        targetType,
        targetId,
        file: item.file,
        onProgress: (progress) => update(item.key, { progress }),
      })
        .then((attachment) => {
          queryClient.setQueryData<AppAttachment[]>(
            attachmentsKeys.target(targetType, targetId),
            (current) => mergeAttachments(current, [attachment])
          );
          update(item.key, { status: "done", progress: 1 });
          onUploadedRef.current?.(attachment);
          // A finished row stays a moment so the person sees it went through.
          window.setTimeout(
            () => setItems((current) => current.filter((row) => row.key !== item.key)),
            1500
          );
        })
        .catch((error: unknown) => {
          update(item.key, {
            status: "error",
            error: error instanceof Error ? error.message : t("uploadFailed"),
          });
        })
        .finally(() => {
          running.current -= 1;
          pump();
        });
    }
  }, [orgId, queryClient, t, targetId, targetType, update]);

  const add = useCallback(
    (files: File[]) => {
      const added = files.map((file): AttachmentUploadItem => {
        const problem: AttachmentUploadProblem | null = attachmentUploadProblem(file);
        return {
          key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          status: problem ? "error" : "queued",
          progress: 0,
          error: problem ? t(`problem.${problem}`) : null,
        };
      });
      setItems((current) => [...current, ...added]);
      pending.current.push(...added.filter((item) => item.status === "queued"));
      pump();
    },
    [pump, t]
  );

  const retry = useCallback(
    (key: string) => {
      const item = items.find((candidate) => candidate.key === key);
      if (!item || attachmentUploadProblem(item.file)) return;
      update(key, { status: "queued", progress: 0, error: null });
      pending.current.push(item);
      pump();
    },
    [items, pump, update]
  );

  const dismiss = useCallback((key: string) => {
    pending.current = pending.current.filter((item) => item.key !== key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const busy = items.some((item) => item.status === "queued" || item.status === "uploading");

  return { items, add, retry, dismiss, busy };
}

export function useDeleteAttachmentMutation(targetType: string, targetId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("components.attachments");
  const queryKey = attachmentsKeys.target(targetType, targetId);

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const result = await deleteAttachmentAction({ attachmentId });
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData<AppAttachment[]>(queryKey, (current) =>
        (current ?? []).filter((attachment) => attachment.id !== id)
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    },
  });
}
