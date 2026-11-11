"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { BellOff, Minus, X } from "lucide-react";
import { useTypingIndicator } from "@repo/rich-text/comments";
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
import { ChatWindowOptions } from "./chat-window-options";

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
        // Accent of the colour theme (top line, tinted header, border) and a lift off the page:
        // a window must be noticed over content that uses the same neutral surfaces
        "pointer-events-auto flex w-[300px] flex-col overflow-hidden rounded-t-md border border-b-0 border-primary/35 border-t-2 border-t-primary shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.35)]",
        // The surface is the theme colour itself, deepened (dark mode) or washed out (light
        // mode): depth against the page instead of one more neutral panel
        "bg-[color-mix(in_oklab,var(--primary)_7%,white)] dark:bg-[color-mix(in_oklab,var(--primary)_22%,black)]",
        collapsed ? "h-[38px]" : "h-[400px]"
      )}
      data-testid="chat-window"
    >
      <div
        className={cn(
          "flex h-[38px] shrink-0 items-center gap-1.5 border-b pl-2 pr-1",
          "border-b-primary/20",
          unread ? "bg-primary/25" : "bg-primary/10"
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
          <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
            {summary?.muted ? (
              <BellOff className="size-2.5 shrink-0" aria-label={t("page.muted")} />
            ) : null}
            {status}
          </span>
        </button>
        <ChatWindowOptions
          conversationId={conversationId}
          isGroup={source?.kind === "group"}
          groupName={source?.kind === "group" ? title : ""}
          muted={!!summary?.muted}
          onClose={() => closeWindow(conversationId)}
        />
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
            onEdit={(message) => composerRef.current?.edit(message)}
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
