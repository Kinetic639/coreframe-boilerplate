"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CheckCheck, FileText, Loader2 } from "lucide-react";
import { TypingIndicator, type TypingPerson } from "@repo/rich-text/comments";
import { cn } from "@/lib/utils";
import { useAttachmentsQuery } from "@/hooks/queries/attachments";
import { useMessages } from "@/hooks/queries/messages";
import type { PendingChatMessage } from "@/lib/messages/cache";
import { memberName } from "@/lib/messages/display";
import {
  CHAT_GROUP_WINDOW_MS,
  chatDayKey,
  chatDayLabel,
  formatChatTime,
} from "@/lib/messages/format";
import type { ChatConversationDetail } from "@/lib/messages/types";
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
  density = "compact",
}: {
  conversationId: string;
  conversation: ChatConversationDetail | undefined;
  typing: TypingPerson[];
  onRetry: (message: PendingChatMessage) => void;
  density?: "compact" | "comfortable";
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { meId } = useChat();
  const thread = useMessages(conversationId);
  const { messages } = thread;
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
                          <button
                            type="button"
                            disabled={!message.failed}
                            onClick={() => onRetry(message)}
                            className={cn(
                              "max-w-[86%] whitespace-pre-wrap break-words rounded-md border px-2 py-1 text-left text-xs leading-[17px] disabled:cursor-text",
                              comfortable && "text-[13px] leading-[19px]",
                              mine
                                ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                                : "bg-muted/60",
                              message.pending && "opacity-60",
                              message.failed && "border-destructive/60"
                            )}
                          >
                            {message.body_plain}
                          </button>
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
