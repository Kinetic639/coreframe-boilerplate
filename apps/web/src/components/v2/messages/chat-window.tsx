"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Minus, X } from "lucide-react";
import { useTypingIndicator } from "@repo/rich-text/comments";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  useConversation,
  useConversations,
  useMarkConversationRead,
  useMessages,
} from "@/hooks/queries/messages";
import { conversationInitials, conversationTitle, directPeer } from "@/lib/messages/display";
import { useChatWindowsStore, type ChatWindowState } from "@/lib/stores/v2/chat-windows-store";
import { ChatAvatar } from "./chat-avatar";
import { ChatComposer, type ChatComposerHandle } from "./chat-composer";
import { useChat } from "./chat-provider";
import { ChatThread } from "./chat-thread";

export function chatTypingTopic(conversationId: string) {
  return `chat:${conversationId}:typing`;
}

/**
 * Keeps a conversation marked read while it is on screen and the tab is visible
 * (on open, on every new message from someone else, on returning to the tab).
 */
export function useReadWhileVisible(conversationId: string, visible: boolean) {
  const { orgId, meId, setVisible } = useChat();
  const markRead = useMarkConversationRead(orgId);
  const { messages } = useMessages(conversationId);
  const lastForeign = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message && message.author_id !== meId && !message.pending) return message.id;
    }
    return null;
  }, [messages, meId]);

  useEffect(() => {
    if (!visible) return;
    setVisible(conversationId, true);
    return () => setVisible(conversationId, false);
  }, [conversationId, setVisible, visible]);

  useEffect(() => {
    if (!visible) return;
    const markIfShown = () => {
      if (document.visibilityState === "visible") markRead(conversationId);
    };
    markIfShown();
    document.addEventListener("visibilitychange", markIfShown);
    return () => document.removeEventListener("visibilitychange", markIfShown);
  }, [conversationId, lastForeign, markRead, visible]);
}

/** One Messenger-style window: header, thread, message box; collapses to its header */
export function ChatWindow({ state }: { state: ChatWindowState }) {
  const t = useTranslations("chat");
  const { orgId, meId, meName, onlineIds, supabase } = useChat();
  const toggleCollapsed = useChatWindowsStore((s) => s.toggleCollapsed);
  const closeWindow = useChatWindowsStore((s) => s.closeWindow);
  const { conversationId, collapsed } = state;
  const detail = useConversation(conversationId);
  const summary = useConversations(orgId).data?.find((c) => c.id === conversationId);
  const source = detail.data ?? summary;
  const composerRef = useRef<ChatComposerHandle>(null);
  const { typing, notifyTyping, notifyStopped } = useTypingIndicator({
    client: supabase,
    topic: collapsed ? null : chatTypingTopic(conversationId),
    me: { id: meId, name: meName },
  });

  useReadWhileVisible(conversationId, !collapsed);

  const title = source ? conversationTitle(source, meId) : "";
  const peer = source ? directPeer(source, meId) : null;
  const online = !!peer && onlineIds.has(peer.user_id);
  const status =
    source?.kind === "group"
      ? t("window.members", {
          count: detail.data
            ? detail.data.members.filter((m) => !m.left_at).length
            : (summary?.member_count ?? 0),
        })
      : online
        ? t("window.online")
        : t("window.offline");
  const unread = !!summary && summary.unread_count > 0 && !summary.muted;

  return (
    <section
      aria-label={title}
      className={cn(
        "pointer-events-auto flex w-[300px] flex-col overflow-hidden rounded-t-md border border-b-0 bg-background shadow-[0_-2px_12px_rgba(17,24,39,0.08)]",
        collapsed ? "h-[38px]" : "h-[400px]"
      )}
      data-testid="chat-window"
    >
      <div
        className={cn(
          "flex h-[38px] shrink-0 items-center gap-1.5 border-b pl-2 pr-1",
          unread ? "bg-amber-50 dark:bg-amber-950/40" : "bg-background"
        )}
      >
        <ChatAvatar
          initials={source ? conversationInitials(source, meId) : "…"}
          src={peer?.avatar_url}
          group={source?.kind === "group"}
          online={online}
          size={22}
          ringClassName="ring-background"
        />
        <button
          type="button"
          onClick={() => toggleCollapsed(conversationId)}
          className="flex min-w-0 flex-1 flex-col text-left"
          aria-expanded={!collapsed}
        >
          <span className="truncate text-xs font-semibold">{title}</span>
          <span className="truncate text-[10px] text-muted-foreground">{status}</span>
        </button>
        <Link
          href={{ pathname: "/dashboard/messages", query: { c: conversationId } }}
          aria-label={t("window.openFull")}
          title={t("window.openFull")}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3" />
        </Link>
        <button
          type="button"
          aria-label={collapsed ? t("window.expand") : t("window.collapse")}
          title={collapsed ? t("window.expand") : t("window.collapse")}
          onClick={() => toggleCollapsed(conversationId)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          aria-label={t("window.close")}
          title={t("window.close")}
          onClick={() => closeWindow(conversationId)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
      {!collapsed ? (
        <>
          <ChatThread
            conversationId={conversationId}
            conversation={detail.data}
            typing={typing}
            onRetry={(message) => composerRef.current?.retry(message)}
          />
          <ChatComposer
            ref={composerRef}
            conversationId={conversationId}
            onTyping={notifyTyping}
            onStopped={notifyStopped}
            autoFocus
          />
        </>
      ) : null}
    </section>
  );
}
