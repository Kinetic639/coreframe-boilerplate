"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { conversationInitials, conversationTitle, directPeer } from "@/lib/messages/display";
import { formatChatListTime } from "@/lib/messages/format";
import type { ChatConversationSummary } from "@/lib/messages/types";
import { ChatAvatar, ChatCountBadge } from "./chat-avatar";
import { useChat } from "./chat-provider";
import { lastMessagePreview } from "./chat-text";

/** One conversation in a list (bar, Messages page): avatar, name, time, preview, unread */
export function ConversationRow({
  conversation,
  active = false,
  onSelect,
  ringClassName = "ring-sidebar",
}: {
  conversation: ChatConversationSummary;
  active?: boolean;
  onSelect: (conversationId: string) => void;
  ringClassName?: string;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { meId, onlineIds } = useChat();
  const peer = directPeer(conversation, meId);
  const hasUnread = conversation.unread_count > 0 && !conversation.muted;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-left hover:bg-background",
        active && "bg-background"
      )}
    >
      <ChatAvatar
        initials={conversationInitials(conversation, meId)}
        src={peer?.avatar_url}
        group={conversation.kind === "group"}
        online={!!peer && onlineIds.has(peer.user_id)}
        ringClassName={ringClassName}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              hasUnread ? "font-semibold" : "font-medium"
            )}
          >
            {conversationTitle(conversation, meId)}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatChatListTime(conversation.activity_at, locale)}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11px] leading-[15px]",
              hasUnread ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {lastMessagePreview(conversation, meId, t)}
          </span>
          {hasUnread ? <ChatCountBadge count={conversation.unread_count} /> : null}
        </span>
      </span>
    </button>
  );
}
