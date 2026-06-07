"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  deleteAttachmentAction,
  listAttachmentsForTargetAction,
  uploadAttachmentsAction,
} from "@/app/actions/attachments";
import type { ListAttachmentsInput } from "@/lib/validations/attachments";
import type { AppAttachment } from "@/server/services/attachments.service";

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

export function useUploadAttachmentsMutation(targetType: string, targetId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("components.attachments");
  const queryKey = attachmentsKeys.target(targetType, targetId);

  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      formData.set("targetType", targetType);
      formData.set("targetId", targetId);
      files.forEach((file) => formData.append("files", file));

      const result = await uploadAttachmentsAction(formData);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onSuccess: (attachments) => {
      queryClient.setQueryData<AppAttachment[]>(queryKey, (current) => {
        const existing = current ?? [];
        const byId = new Map(existing.map((attachment) => [attachment.id, attachment]));
        attachments.forEach((attachment) => byId.set(attachment.id, attachment));
        return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("uploadFailed"));
    },
  });
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
