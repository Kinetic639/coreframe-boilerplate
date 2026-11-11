"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CheckCheck, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { TypingIndicator, type TypingPerson } from "@repo/rich-text/comments";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { RichTextRenderer } from "@repo/rich-text/rich-text-renderer";
import { normalizeRichText } from "@repo/rich-text/rich-text-utils";
import { cn } from "@/lib/utils";
import { useAttachmentsQuery } from "@/hooks/queries/attachments";
import { useMessageChanges, useMessages } from "@/hooks/queries/messages";
import { useMentionAccess } from "@/hooks/queries/mentions";
import { MentionChip } from "@/components/v2/mentions/mention-chip";
import type { PendingChatMessage } from "@/lib/messages/cache";
import { memberName } from "@/lib/messages/display";
import {
  CHAT_GROUP_WINDOW_MS,
  chatDayKey,
  chatDayLabel,
  formatChatTime,
} from "@/lib/messages/format";
import { CHAT_EDIT_WINDOW_MS, type ChatConversationDetail } from "@/lib/messages/types";
import { useChat } from "./chat-provider";
import { systemEventText } from "./chat-text";

const CHAT_TARGET = "chat.conversation";

/**
 * Messages of one conversation, oldest at the top: day separators, one name /
 * time line per run of messages, system lines, attachments, "seen" under the
 * last own message, "typing…". Scrolls to the bottom on open and on new
 * messages while the reader is at the bottom; older pages load at the top.
 */
export function ChatThread({
  conversationId,
  conversation,
  typing,
  onRetry,
  onEdit,
  density = "compact",
}: {
  conversationId: string;
  conversation: ChatConversationDetail | undefined;
  typing: TypingPerson[];
  onRetry: (message: PendingChatMessage) => void;
  /** Loads an own message into the composer for editing */
  onEdit?: (message: PendingChatMessage) => void;
  density?: "compact" | "comfortable";
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { meId, orgId } = useChat();
  const thread = useMessages(conversationId);
  const { messages } = thread;
  const { deleteMessage } = useMessageChanges(orgId);
  // Delete asks once more on the same button
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // "Edit" disappears when the 15-minute window closes
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const remove = (messageId: string) => {
    setConfirmDeleteId(null);
    deleteMessage.mutate(messageId, { onError: () => toast.error(t("errors.failed")) });
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const lastIdRef = useRef<string | null>(null);
  const heightBeforeOlderRef = useRef<number | null>(null);

  const hasAttachments = messages.some((m) => m.attachment_ids.length > 0);
  const attachments = useAttachmentsQuery({ targetType: CHAT_TARGET, targetId: conversationId });
  const attachmentById = useMemo(
    () => new Map((hasAttachments ? (attachments.data ?? []) : []).map((a) => [a.id, a])),
    [attachments.data, hasAttachments]
  );
  // A message arrived with a file not in the list yet: refresh the list
  const missingAttachment = messages.some((m) =>
    m.attachment_ids.some((id) => !attachmentById.has(id))
  );
  const refetchAttachments = attachments.refetch;
  useEffect(() => {
    if (missingAttachment && !attachments.isFetching) void refetchAttachments();
  }, [attachments.isFetching, missingAttachment, refetchAttachments]);

  // Mentioned objects link only when the reader may open them (one batched check)
  const richBodies = useMemo(
    () => messages.filter((m) => m.body_rich && !m.deleted_at).map((m) => m.body_rich),
    [messages]
  );
  const mentionAccess = useMentionAccess(orgId, richBodies);
  const renderMention = useCallback(
    (mention: MentionItem) => (
      <MentionChip mention={mention} access={mentionAccess(mention)} meId={meId} />
    ),
    [meId, mentionAccess]
  );

  const members = useMemo(() => conversation?.members ?? [], [conversation?.members]);
  const others = members.filter((m) => m.user_id !== meId && !m.left_at);

  // Last own message the others have read (direct: "Seen"; group: "Seen by N")
  const readInfo = useMemo(() => {
    const own = [...messages]
      .reverse()
      .find((m) => m.author_id === meId && m.kind === "text" && !m.pending);
    if (!own) return null;
    const readers = others.filter((m) => m.last_read_at >= own.created_at).length;
    return readers > 0 ? { messageId: own.id, readers } : null;
  }, [messages, meId, others]);

  // Keep the view pinned to the bottom; keep the position when older pages load
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (heightBeforeOlderRef.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlderRef.current;
      heightBeforeOlderRef.current = null;
    } else if (
      lastId !== lastIdRef.current &&
      (atBottomRef.current || lastIdRef.current === null)
    ) {
      el.scrollTop = el.scrollHeight;
    }
    lastIdRef.current = lastId;
  }, [messages]);

  const loadOlder = () => {
    const el = scrollRef.current;
    if (el) heightBeforeOlderRef.current = el.scrollHeight;
    void thread.fetchNextPage();
  };

  const comfortable = density === "comfortable";

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const el = event.currentTarget;
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        if (el.scrollTop < 40 && thread.hasNextPage && !thread.isFetchingNextPage) loadOlder();
      }}
      className={cn("min-h-0 flex-1 overflow-y-auto", comfortable ? "px-5 py-4" : "px-2 pb-1 pt-2")}
      data-testid="chat-thread"
    >
      {thread.isLoading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : thread.isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          {t("window.loadFailed")}
          <button
            type="button"
            onClick={() => void thread.refetch()}
            className="text-primary underline"
          >
            {t("window.retry")}
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {t("window.empty")}
        </div>
      ) : (
        <div className={cn("flex flex-col", comfortable ? "gap-2" : "gap-1.5")}>
          {thread.hasNextPage ? (
            <button
              type="button"
              onClick={loadOlder}
              className="mx-auto text-[11px] text-muted-foreground hover:text-foreground"
            >
              {thread.isFetchingNextPage ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                t("window.loadOlder")
              )}
            </button>
          ) : null}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay =
              !previous || chatDayKey(previous.created_at) !== chatDayKey(message.created_at);
            const grouped =
              !newDay &&
              previous?.kind === "text" &&
              message.kind === "text" &&
              previous.author_id === message.author_id &&
              new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <
                CHAT_GROUP_WINDOW_MS;
            const mine = message.author_id === meId;
            const author = members.find((m) => m.user_id === message.author_id);

            return (
              <Fragment key={message.id}>
                {newDay ? (
                  <div className="my-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="h-px flex-1 bg-border/70" />
                    {chatDayLabel(message.created_at, locale, {
                      today: t("window.today"),
                      yesterday: t("window.yesterday"),
                    })}
                    <span className="h-px flex-1 bg-border/70" />
                  </div>
                ) : null}

                {message.kind === "system" ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {systemEventText(message.system_event, message.author_id, members, meId, t)}
                  </p>
                ) : (
                  <div className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                    {!grouped ? (
                      <span className="px-0.5 text-[10px] text-muted-foreground">
                        {!mine ? (
                          <span className="font-semibold text-foreground/80">
                            {author ? memberName(author) : t("system.someone")}
                          </span>
                        ) : null}
                        {!mine ? " · " : null}
                        {formatChatTime(message.created_at, locale)}
                      </span>
                    ) : null}
                    {message.deleted_at ? (
                      <span className="rounded-md border border-dashed px-2 py-1 text-xs italic text-muted-foreground">
                        {t("window.deleted")}
                      </span>
                    ) : (
                      <>
                        {message.body_plain ? (
                          <div
                            className={cn(
                              "group/msg flex w-full items-center gap-1",
                              mine ? "justify-end" : "justify-start"
                            )}
                            onMouseLeave={() => setConfirmDeleteId(null)}
                          >
                            {mine && !message.pending && !message.failed ? (
                              <span className="flex shrink-0 items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100">
                                {confirmDeleteId === message.id ? (
                                  <button
                                    type="button"
                                    onClick={() => remove(message.id)}
                                    className="rounded px-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                                  >
                                    {t("window.deleteConfirm")}
                                  </button>
                                ) : (
                                  <>
                                    {onEdit &&
                                    now - new Date(message.created_at).getTime() <
                                      CHAT_EDIT_WINDOW_MS ? (
                                      <button
                                        type="button"
                                        aria-label={t("window.edit")}
                                        title={t("window.edit")}
                                        onClick={() => onEdit(message)}
                                        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                      >
                                        <Pencil className="size-3" />
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      aria-label={t("window.delete")}
                                      title={t("window.delete")}
                                      onClick={() => setConfirmDeleteId(message.id)}
                                      className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </>
                                )}
                              </span>
                            ) : null}
                            {/* A failed message is a button (retry); a sent one is text with links */}
                            <div
                              role={message.failed ? "button" : undefined}
                              tabIndex={message.failed ? 0 : undefined}
                              onClick={message.failed ? () => onRetry(message) : undefined}
                              onKeyDown={
                                message.failed
                                  ? (event) => {
                                      if (event.key === "Enter") onRetry(message);
                                    }
                                  : undefined
                              }
                              className={cn(
                                "max-w-[86%] whitespace-pre-wrap break-words rounded-md border px-2 py-1 text-left text-xs leading-[17px]",
                                message.failed && "cursor-pointer",
                                comfortable && "text-[13px] leading-[19px]",
                                mine ? "border-primary/30 bg-primary/15" : "bg-muted/60",
                                message.pending && "opacity-60",
                                message.failed && "border-destructive/60"
                              )}
                            >
                              {normalizeRichText(message.body_rich) ? (
                                <RichTextRenderer
                                  value={normalizeRichText(message.body_rich)}
                                  prose={false}
                                  renderMention={renderMention}
                                  className="text-[length:inherit] [&_p]:leading-[inherit]"
                                />
                              ) : (
                                message.body_plain
                              )}
                            </div>
                          </div>
                        ) : null}
                        {message.attachment_ids.map((id) => {
                          const file = attachmentById.get(id);
                          return (
                            <a
                              key={id}
                              href={file?.download_url ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="flex max-w-[86%] items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted/60"
                            >
                              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                <FileText className="size-3.5" />
                              </span>
                              <span className="min-w-0 truncate">{file?.file_name ?? "…"}</span>
                            </a>
                          );
                        })}
                      </>
                    )}
                    {message.edited_at && !message.deleted_at ? (
                      <span className="px-0.5 text-[10px] italic text-muted-foreground">
                        {t("window.edited")}
                      </span>
                    ) : null}
                    {message.failed ? (
                      <span className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertCircle className="size-3" /> {t("window.failed")}
                      </span>
                    ) : message.pending ? (
                      <span className="text-[10px] text-muted-foreground">
                        {t("window.sending")}
                      </span>
                    ) : readInfo?.messageId === message.id ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCheck className="size-3 text-primary" />
                        {conversation?.kind === "group"
                          ? t("window.readBy", { count: readInfo.readers })
                          : t("window.read")}
                      </span>
                    ) : null}
                  </div>
                )}
              </Fragment>
            );
          })}
          <TypingIndicator people={typing} className="text-[10px]" />
        </div>
      )}
    </div>
  );
}
