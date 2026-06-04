"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { addCommentAction, listCommentsForTargetAction } from "@/app/actions/comments";
import type { AddCommentInput, ListCommentsInput } from "@/lib/validations/comments";
import type { PaginatedComments } from "@/server/services/comments.service";

export const commentsKeys = {
  all: ["comments"] as const,
  target: (targetType: string, targetId: string) =>
    [...commentsKeys.all, "target", targetType, targetId] as const,
};

export function useCommentsQuery(
  input: Omit<ListCommentsInput, "cursor">,
  initialData?: PaginatedComments
) {
  return useQuery({
    queryKey: commentsKeys.target(input.targetType, input.targetId),
    queryFn: async () => {
      const result = await listCommentsForTargetAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useAddCommentMutation(targetType: string, targetId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("components.comments");

  return useMutation({
    mutationFn: async (input: AddCommentInput) => {
      const result = await addCommentAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.target(targetType, targetId) });
    },
    onError: () => {
      toast.error(t("addFailed"));
    },
  });
}
