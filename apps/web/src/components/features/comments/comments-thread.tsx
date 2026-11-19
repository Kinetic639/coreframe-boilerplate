"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CommentEditor, CommentRenderer } from "@/components/primitives/comments";
import { TypingIndicator, useTypingIndicator } from "@repo/rich-text/comments";
import { isRichTextEmpty } from "@repo/rich-text/rich-text-utils";
import { createClient } from "@/utils/supabase/client";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { useMentionAccess } from "@/hooks/queries/mentions";
import { MentionChip } from "@/components/v2/mentions/mention-chip";
import { ENTITY_MENTIONS } from "@/components/v2/mentions/mention-suggestion-list";
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
  onCommentAdded?: (comment: AppComment) => void | Promise<void>;
  /**
   * Opt-in internal notes (Help Desk handlers): adds a second submit button that posts with
   * visibility "internal" and highlights internal comments. Off by default, so other
   * targets (planning) are unchanged. Who may post or read them is enforced server-side.
   */
  internal?: { noteLabel: string; badge: string };
  /**
   * Realtime channel for "is typing" (e.g. helpdeskTicketTypingTopic(id)); needs an RLS
   * policy on realtime.messages for the topic. Omit to keep the indicator off.
   */
  typingTopic?: string | null;
  /**
   * "top": newest first, with a "Write a comment…" field above them that
   * opens the editor when clicked (as on a Trello card). Default "bottom":
   * oldest first and the editor always open below.
   */
  composer?: "bottom" | "top";
}

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleString();
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

function commentAuthor(comment: AppComment, formerMemberLabel: string) {
  return {
    name: comment.author?.name ?? formerMemberLabel,
    email: comment.author?.email ?? undefined,
    avatarUrl: comment.author?.avatar_url ?? undefined,
    profileHref: comment.author?.profile_href ?? undefined,
  };
}

function appendComment(rows: AppComment[], comment: AppComment): AppComment[] {
  if (rows.some((row) => row.id === comment.id)) return rows;
  return [...rows, comment];
}

export function CommentsThread(props: CommentsThreadProps) {
  const t = useTranslations("components.comments");
  const providerConfig = useCommentsProvider();
  const config = resolveConfig(props, providerConfig);
  const labels = {
    title: config.labels?.title ?? t("title"),
    empty: config.labels?.empty ?? t("empty"),
    loading: config.labels?.loading ?? t("loading"),
    placeholder: config.labels?.placeholder ?? t("placeholder"),
    submit: config.labels?.submit ?? t("submit"),
    submitting: config.labels?.submitting ?? t("submitting"),
    loadMore: config.labels?.loadMore ?? t("loadMore"),
    edited: config.labels?.edited ?? t("edited"),
    formerMember: config.labels?.formerMember ?? t("formerMember"),
  };
  const compact = config.density === "compact";
  const onCommentAdded = props.onCommentAdded;

  const [draft, setDraft] = useState<RichTextValue>(createEmptyRichText);
  const composerOnTop = props.composer === "top";
  const [composerOpen, setComposerOpen] = useState(!composerOnTop);
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

  // Mentioned objects link only when the reader may open them (one batched check)
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const meId = useUserStoreV2((s) => s.user?.id ?? null);
  const richBodies = useMemo(() => rows.map((row) => row.body_rich).filter(Boolean), [rows]);
  const mentionAccess = useMentionAccess(orgId, richBodies);
  const renderMention = useCallback(
    (mention: MentionItem) => (
      <MentionChip mention={mention} access={mentionAccess(mention)} meId={meId} />
    ),
    [meId, mentionAccess]
  );

  const commentsQuery = useCommentsQuery(queryInput, props.initialData);
  const addCommentMutation = useAddCommentMutation(config.targetType, config.targetId);
  const loadingInitialComments = !props.initialData && commentsQuery.isPending && rows.length === 0;

  // Comments shown before the server confirmed them (optimistic): they stay
  // on screen through a refetch until their save settles.
  const pendingRef = useRef<AppComment[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!commentsQuery.data) return;
    const pending = pendingRef.current;
    setRows([...commentsQuery.data.rows, ...pending]);
    setNextCursor(commentsQuery.data.nextCursor);
    setTotalCount(commentsQuery.data.totalCount + pending.length);
  }, [commentsQuery.data]);

  const [supabase] = useState(createClient);
  const user = useUserStoreV2((state) => state.user);
  const typingMe = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
          }
        : null,
    [user]
  );
  const { typing, notifyTyping, notifyStopped } = useTypingIndicator({
    client: supabase,
    topic: props.typingTopic ?? null,
    me: typingMe,
  });

  const handleSubmit = useCallback(
    (value: RichTextValue, visibility: "default" | "internal" = "default") => {
      const bodyPlain = extractPlainText(value);
      if (!bodyPlain.trim()) return;
      notifyStopped();

      // Shown at once, slightly faded until saved; on failure it goes away and
      // the text comes back to the editor.
      const pendingId = `pending-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const pendingComment: AppComment = {
        id: pendingId,
        org_id: orgId ?? "",
        target_type: config.targetType,
        target_id: config.targetId,
        body_plain: bodyPlain.trim(),
        body_rich: value,
        visibility,
        kind: "comment",
        parent_comment_id: null,
        metadata: {},
        created_by: user?.id ?? "",
        updated_by: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        author: user
          ? {
              user_id: user.id,
              name: typingMe?.name ?? user.email,
              email: user.email,
              avatar_url: user.avatar_signed_url ?? user.avatar_url ?? null,
              profile_href: null,
            }
          : null,
        is_own: true,
      };
      const settle = () => {
        pendingRef.current = pendingRef.current.filter((row) => row.id !== pendingId);
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(pendingId);
          return next;
        });
      };
      pendingRef.current = [...pendingRef.current, pendingComment];
      setPendingIds((current) => new Set(current).add(pendingId));
      setRows((current) => [...current, pendingComment]);
      setTotalCount((current) => current + 1);
      setDraft(createEmptyRichText());
      if (composerOnTop) setComposerOpen(false);

      addCommentMutation.mutate(
        {
          targetType: config.targetType,
          targetId: config.targetId,
          bodyPlain: bodyPlain.trim(),
          bodyRich: value,
          visibility,
        },
        {
          onSuccess: (comment) => {
            settle();
            // A refetch may already have brought the saved comment in.
            if (rowsRef.current.some((row) => row.id === comment.id)) {
              setTotalCount((count) => count - 1);
            }
            setRows((current) =>
              appendComment(
                current.filter((row) => row.id !== pendingId),
                comment
              )
            );
            void onCommentAdded?.(comment);
          },
          onError: () => {
            settle();
            setRows((current) => current.filter((row) => row.id !== pendingId));
            setTotalCount((current) => current - 1);
            setDraft(value);
            if (composerOnTop) setComposerOpen(true);
          },
        }
      );
    },
    [
      addCommentMutation,
      composerOnTop,
      config.targetId,
      config.targetType,
      notifyStopped,
      onCommentAdded,
      orgId,
      typingMe,
      user,
    ]
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

  const composerNode = config.canComment ? (
    composerOpen ? (
      <div className={composerOnTop ? undefined : "pt-1"}>
        <CommentEditor
          mention={ENTITY_MENTIONS}
          value={draft}
          onChange={(next) => {
            setDraft(next);
            if (isRichTextEmpty(next)) notifyStopped();
            else notifyTyping();
          }}
          onSubmit={handleSubmit}
          placeholder={labels.placeholder}
          submitLabel={labels.submit}
          submittingLabel={labels.submitting}
          submitting={addCommentMutation.isPending}
          autoFocus={composerOnTop}
          onCancel={
            composerOnTop
              ? () => {
                  setDraft(createEmptyRichText());
                  notifyStopped();
                  setComposerOpen(false);
                }
              : undefined
          }
          density={config.density}
          actions={
            props.internal ? (
              <Button
                type="button"
                variant="outline"
                size={compact ? "sm" : "default"}
                className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:text-amber-200"
                onClick={() => handleSubmit(draft, "internal")}
                disabled={addCommentMutation.isPending || !extractPlainText(draft).trim()}
              >
                {props.internal.noteLabel}
              </Button>
            ) : undefined
          }
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="w-full rounded-md border bg-background px-3 py-2.5 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/50"
      >
        {labels.placeholder}
      </button>
    )
  ) : null;

  const shownRows = composerOnTop ? [...rows].reverse() : rows;

  if (loadingInitialComments) {
    return (
      <section className={cn("min-w-0", props.className)}>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{labels.loading}</span>
        </div>
      </section>
    );
  }

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

      {composerOnTop ? composerNode : null}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.empty}</p>
      ) : (
        <div className={cn(compact ? "space-y-4" : "space-y-5", props.contentClassName)}>
          {shownRows.map((comment) => (
            <CommentRenderer
              key={comment.id}
              className={cn(
                comment.visibility === "internal" &&
                  "rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900",
                pendingIds.has(comment.id) && "opacity-60 transition-opacity"
              )}
              value={normalizeRichText(comment.body_rich) ?? undefined}
              author={commentAuthor(comment, labels.formerMember)}
              createdAt={
                comment.visibility === "internal" && props.internal ? (
                  <span className="inline-flex items-center gap-2">
                    {formatCommentDate(comment.created_at)}
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      {props.internal.badge}
                    </span>
                  </span>
                ) : (
                  formatCommentDate(comment.created_at)
                )
              }
              editedLabel={comment.updated_at !== comment.created_at ? labels.edited : undefined}
              emptyText={comment.body_plain}
              density={config.density}
              isOwn={comment.is_own}
              renderMention={renderMention}
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
          {labels.loadMore}
        </Button>
      )}

      <TypingIndicator people={typing} />

      {!composerOnTop ? composerNode : null}
    </section>
  );
}
