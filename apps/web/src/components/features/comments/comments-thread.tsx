"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommentEditor, CommentRenderer } from "@/components/primitives/comments";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { listCommentsForTargetAction } from "@/app/actions/comments";
import { cn } from "@/utils";
import { useAddCommentMutation, useCommentsQuery } from "@/hooks/queries/comments";
import type { AppComment, PaginatedComments } from "@/server/services/comments.service";
import {
  type CommentsLabels,
  type CommentsProviderValue,
  useCommentsProvider,
} from "./comments-provider";

interface CommentsThreadProps extends Partial<CommentsProviderValue> {
  initialData?: PaginatedComments;
  className?: string;
  contentClassName?: string;
  showTitle?: boolean;
  onCommentAdded?: () => void | Promise<void>;
}

const DEFAULT_LABELS: Required<CommentsLabels> = {
  title: "Comments",
  empty: "No comments yet.",
  placeholder: "Write a comment...",
  submit: "Post comment",
};

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function mergeLabels(labels?: CommentsLabels): Required<CommentsLabels> {
  return { ...DEFAULT_LABELS, ...labels };
}

function resolveConfig(
  props: CommentsThreadProps,
  context: CommentsProviderValue | null
): CommentsProviderValue {
  const targetType = props.targetType ?? context?.targetType;
  const targetId = props.targetId ?? context?.targetId;

  if (!targetType || !targetId) {
    throw new Error("CommentsThread requires targetType and targetId.");
  }

  return {
    targetType,
    targetId,
    canComment: props.canComment ?? context?.canComment ?? true,
    density: props.density ?? context?.density ?? "default",
    pageSize: props.pageSize ?? context?.pageSize ?? 50,
    labels: { ...context?.labels, ...props.labels },
  };
}

function commentAuthor(comment: AppComment) {
  return {
    name: comment.author?.name ?? "Former member",
    email: comment.author?.email ?? undefined,
    avatarUrl: comment.author?.avatar_url ?? undefined,
    profileHref: comment.author?.profile_href ?? undefined,
  };
}

export function CommentsThread(props: CommentsThreadProps) {
  const providerConfig = useCommentsProvider();
  const config = resolveConfig(props, providerConfig);
  const labels = mergeLabels(config.labels);
  const compact = config.density === "compact";
  const onCommentAdded = props.onCommentAdded;

  const [draft, setDraft] = useState<RichTextValue>(createEmptyRichText);
  const [rows, setRows] = useState<AppComment[]>(props.initialData?.rows ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    props.initialData?.nextCursor ?? null
  );
  const [totalCount, setTotalCount] = useState(props.initialData?.totalCount ?? rows.length);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryInput = useMemo(
    () => ({
      targetType: config.targetType,
      targetId: config.targetId,
      pageSize: config.pageSize ?? 50,
    }),
    [config.targetType, config.targetId, config.pageSize]
  );

  const commentsQuery = useCommentsQuery(queryInput, props.initialData);
  const addCommentMutation = useAddCommentMutation(config.targetType, config.targetId);

  useEffect(() => {
    if (!commentsQuery.data) return;
    setRows(commentsQuery.data.rows);
    setNextCursor(commentsQuery.data.nextCursor);
    setTotalCount(commentsQuery.data.totalCount);
  }, [commentsQuery.data]);

  const handleSubmit = useCallback(
    (value: RichTextValue) => {
      const bodyPlain = extractPlainText(value);
      if (!bodyPlain.trim()) return;

      addCommentMutation.mutate(
        {
          targetType: config.targetType,
          targetId: config.targetId,
          bodyPlain: bodyPlain.trim(),
          bodyRich: value,
          visibility: "default",
        },
        {
          onSuccess: async () => {
            setDraft(createEmptyRichText());
            await commentsQuery.refetch();
            await onCommentAdded?.();
          },
        }
      );
    },
    [addCommentMutation, commentsQuery, config.targetId, config.targetType, onCommentAdded]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await listCommentsForTargetAction({
        ...queryInput,
        cursor: nextCursor,
      });
      if (result.success) {
        setRows((current) => [...current, ...result.data.rows]);
        setNextCursor(result.data.nextCursor);
        setTotalCount(result.data.totalCount);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, queryInput]);

  return (
    <section className={cn("min-w-0 space-y-4", props.className)}>
      {props.showTitle !== false && (
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
            {labels.title} ({totalCount})
          </h2>
          {commentsQuery.isFetching && rows.length > 0 && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.empty}</p>
      ) : (
        <div className={cn(compact ? "space-y-4" : "space-y-5", props.contentClassName)}>
          {rows.map((comment) => (
            <CommentRenderer
              key={comment.id}
              value={normalizeRichText(comment.body_rich) ?? undefined}
              author={commentAuthor(comment)}
              createdAt={formatCommentDate(comment.created_at)}
              editedLabel={comment.updated_at !== comment.created_at ? "edited" : undefined}
              emptyText={comment.body_plain}
              density={config.density}
              isOwn={comment.is_own}
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          Load more
        </Button>
      )}

      {config.canComment && (
        <div className="pt-1">
          <CommentEditor
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            placeholder={labels.placeholder}
            submitLabel={labels.submit}
            submitting={addCommentMutation.isPending}
            density={config.density}
          />
        </div>
      )}
    </section>
  );
}
