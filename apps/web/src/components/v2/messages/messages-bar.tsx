"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronsRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  Search,
  SquarePen,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeSearchText } from "@/lib/global-search/match";
import { useConversations } from "@/hooks/queries/messages";
import { unreadConversations } from "@/lib/messages/cache";
import { conversationInitials, conversationTitle, directPeer } from "@/lib/messages/display";
import type { ChatConversationSummary } from "@/lib/messages/types";
import { useChatWindowsStore } from "@/lib/stores/v2/chat-windows-store";
import { ChatAvatar, ChatCountBadge } from "./chat-avatar";
import { useChat } from "./chat-provider";
import { ConversationRow } from "./conversation-row";
import { NewConversationPopover } from "./new-conversation-popover";

export const MESSAGES_BAR_COLLAPSED_WIDTH = 52;
export const MESSAGES_BAR_EXPANDED_WIDTH = 300;

/** Unread first, then by last activity */
function orderForRail(list: ChatConversationSummary[]) {
  return [...list].sort((a, b) => {
    const unread = Number(b.unread_count > 0) - Number(a.unread_count > 0);
    return unread || b.activity_at.localeCompare(a.activity_at);
  });
}

/**
 * Right messages bar, built like the left sidebar (screen height, does not
 * scroll with the page). Collapsed: a 52 px rail — the messages icon on top
 * (expands the bar), conversation avatars, "new conversation" at the bottom.
 * Expanded: a 300 px list with search and sections. Clicking a conversation
 * opens its chat window. Hidden below `lg` (phones use the Messages page).
 */
export function MessagesBar() {
  const t = useTranslations("chat");
  const { orgId, meId, onlineIds } = useChat();
  const expanded = useChatWindowsStore((s) => s.expanded);
  const setExpanded = useChatWindowsStore((s) => s.setExpanded);
  const openWindow = useChatWindowsStore((s) => s.openWindow);
  const windows = useChatWindowsStore((s) => s.windows);
  const conversations = useConversations(orgId);
  const list = useMemo(() => conversations.data ?? [], [conversations.data]);
  const unread = unreadConversations(list);
  const openIds = useMemo(() => new Set(windows.map((w) => w.conversationId)), [windows]);

  const isOnline = (conversation: ChatConversationSummary) => {
    const peer = directPeer(conversation, meId);
    return !!peer && onlineIds.has(peer.user_id);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        aria-label={t("bar.label")}
        className="hidden h-svh shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear lg:flex"
        style={{ width: expanded ? MESSAGES_BAR_EXPANDED_WIDTH : MESSAGES_BAR_COLLAPSED_WIDTH }}
        data-testid="messages-bar"
        data-expanded={expanded ? "true" : "false"}
      >
        {expanded ? (
          <ExpandedList
            list={list}
            loading={conversations.isLoading}
            failed={conversations.isError}
            unread={unread}
            openIds={openIds}
            onOpen={(id) => openWindow(id)}
            onCollapse={() => setExpanded(false)}
          />
        ) : (
          <div className="flex h-full flex-col items-center gap-1 py-2">
            <RailButton
              label={t("bar.expand")}
              onClick={() => setExpanded(true)}
              testId="messages-bar-toggle"
            >
              <MessageSquare className="size-4" />
              {unread > 0 ? (
                <ChatCountBadge count={unread} className="absolute right-0 top-0.5" />
              ) : null}
            </RailButton>
            <span className="my-1 h-px w-6 bg-border" />
            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none]">
              {conversations.isLoading ? (
                <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />
              ) : (
                orderForRail(list).map((conversation) => {
                  const title = conversationTitle(conversation, meId);
                  return (
                    <RailButton
                      key={conversation.id}
                      label={title}
                      onClick={() => openWindow(conversation.id)}
                      active={openIds.has(conversation.id)}
                    >
                      <ChatAvatar
                        initials={conversationInitials(conversation, meId)}
                        src={directPeer(conversation, meId)?.avatar_url}
                        group={conversation.kind === "group"}
                        online={isOnline(conversation)}
                      />
                      {conversation.unread_count > 0 && !conversation.muted ? (
                        <ChatCountBadge
                          count={conversation.unread_count}
                          className="absolute right-0 top-0 ring-2 ring-sidebar"
                        />
                      ) : null}
                    </RailButton>
                  );
                })
              )}
            </div>
            <NewConversationPopover onCreated={(id) => openWindow(id)}>
              <button
                type="button"
                aria-label={t("bar.newConversation")}
                title={t("bar.newConversation")}
                className="flex size-8 items-center justify-center rounded-md text-foreground/80 hover:bg-sidebar-accent"
              >
                <SquarePen className="size-4" />
              </button>
            </NewConversationPopover>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function RailButton({
  label,
  onClick,
  active = false,
  testId,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          data-testid={testId}
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/80 hover:bg-sidebar-accent",
            active && "bg-primary/10"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ExpandedList({
  list,
  loading,
  failed,
  unread,
  openIds,
  onOpen,
  onCollapse,
}: {
  list: ChatConversationSummary[];
  loading: boolean;
  failed: boolean;
  unread: number;
  openIds: ReadonlySet<string>;
  onOpen: (conversationId: string) => void;
  onCollapse: () => void;
}) {
  const t = useTranslations("chat");
  const { meId } = useChat();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    const visible = list.filter(
      (conversation) => !q || normalizeSearchText(conversationTitle(conversation, meId)).includes(q)
    );
    return [
      {
        id: "unread",
        label: t("bar.unread"),
        items: visible.filter((c) => c.unread_count > 0 && !c.muted),
      },
      {
        id: "recent",
        label: t("bar.recent"),
        items: visible.filter((c) => c.kind === "direct" && !(c.unread_count > 0 && !c.muted)),
      },
      {
        id: "groups",
        label: t("bar.groups"),
        items: visible.filter((c) => c.kind === "group" && !(c.unread_count > 0 && !c.muted)),
      },
    ].filter((section) => section.items.length > 0);
  }, [list, meId, query, t]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b pl-3 pr-1.5">
        <span className="text-[13px] font-semibold">{t("bar.label")}</span>
        {unread > 0 ? (
          <span className="flex h-[18px] items-center rounded bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
            {unread}
          </span>
        ) : null}
        <span className="flex-1" />
        <NewConversationPopover onCreated={onOpen} side="bottom">
          <button
            type="button"
            aria-label={t("bar.newConversation")}
            title={t("bar.newConversation")}
            className="flex size-7 items-center justify-center rounded-md text-foreground/80 hover:bg-sidebar-accent"
          >
            <SquarePen className="size-3.5" />
          </button>
        </NewConversationPopover>
        <Link
          href="/dashboard/messages"
          aria-label={t("bar.openPage")}
          title={t("bar.openPage")}
          className="flex size-7 items-center justify-center rounded-md text-foreground/80 hover:bg-sidebar-accent"
        >
          <ExternalLink className="size-3.5" />
        </Link>
        <button
          type="button"
          aria-label={t("bar.collapse")}
          title={t("bar.collapse")}
          onClick={onCollapse}
          data-testid="messages-bar-toggle"
          className="flex size-7 items-center justify-center rounded-md text-foreground/80 hover:bg-sidebar-accent"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>
      <div className="px-2.5 pb-1 pt-2">
        <label className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("bar.search")}
            aria-label={t("bar.search")}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : failed ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("bar.loadFailed")}
          </p>
        ) : list.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-xs font-medium">{t("bar.empty")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("bar.emptyHint")}</p>
          </div>
        ) : sections.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("bar.noResults")}
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.id}>
              <div className="px-1.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </div>
              {section.items.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={openIds.has(conversation.id)}
                  onSelect={onOpen}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
