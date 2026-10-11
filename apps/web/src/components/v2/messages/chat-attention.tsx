"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import { useConversations } from "@/hooks/queries/messages";
import { unreadConversations } from "@/lib/messages/cache";
import { playChatSound } from "@/lib/messages/sound";
import { useChat } from "./chat-provider";

const TITLE_PREFIX = /^\(\d+\+?\) /;

/**
 * Draws attention to new messages without a window in the way: a chime for a
 * message from someone else (not in a muted conversation, not in the one being
 * read) and the number of unread conversations in the browser tab's title.
 */
export function ChatAttention() {
  const { orgId, meId, subscribe, isVisible } = useChat();
  const conversations = useConversations(orgId).data;
  const pathname = usePathname();
  const unread = unreadConversations(conversations);

  const mutedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    mutedRef.current = new Set((conversations ?? []).filter((c) => c.muted).map((c) => c.id));
  }, [conversations]);

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "message" || event.message.kind !== "text") return;
        if (event.message.author_id === meId) return;
        if (mutedRef.current.has(event.conversation_id)) return;
        // Reading it right now: no sound (unless the tab is in the background)
        if (isVisible(event.conversation_id) && !document.hidden) return;
        playChatSound();
      }),
    [isVisible, meId, subscribe]
  );

  // "(3) Ambra" — the page sets its own title on navigation, so re-apply then
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      const next = unread > 0 ? `(${unread > 9 ? "9+" : unread}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const title = document.querySelector("title");
    const observer = title ? new MutationObserver(apply) : null;
    if (title && observer) observer.observe(title, { childList: true });
    return () => {
      observer?.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [pathname, unread]);

  return null;
}
