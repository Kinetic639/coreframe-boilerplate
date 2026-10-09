"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, PanelRight, Search, SquarePen } from "lucide-react";
import { useTypingIndicator } from "@repo/rich-text/comments";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { normalizeSearchText } from "@/lib/global-search/match";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useConversation, useConversations } from "@/hooks/queries/messages";
import { conversationInitials, conversationTitle, directPeer } from "@/lib/messages/display";
import { ChatAvatar } from "@/components/v2/messages/chat-avatar";
import { ChatComposer, type ChatComposerHandle } from "@/components/v2/messages/chat-composer";
import { useOptionalChat } from "@/components/v2/messages/chat-provider";
import { ChatThread } from "@/components/v2/messages/chat-thread";
import { chatTypingTopic, useReadWhileVisible } from "@/components/v2/messages/chat-window";
import { ConversationRow } from "@/components/v2/messages/conversation-row";
import { NewConversationPopover } from "@/components/v2/messages/new-conversation-popover";
import { ConversationDetails } from "./conversation-details";

type Filter = "all" | "unread" | "groups";

/**
 * Full Messages page: conversation list (search, filters), the selected
 * conversation and its details (members, files, group settings). The selected
 * conversation is in the URL (`?c=<id>`), so windows and the bar can link here.
 */
export function MessagesPageClient({
  initialConversationId,
}: {
  initialConversationId: string | null;
}) {
  const chat = useOptionalChat();
  const setFlushContent = useUiStoreV2((s) => s.setFlushContent);

  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  if (!chat) return null;
  return <MessagesPageBody initialConversationId={initialConversationId} />;
}

function MessagesPageBody({ initialConversationId }: { initialConversationId: string | null }) {
  const t = useTranslations("chat");
  const router = useRouter();
  const chat = useOptionalChat()!;
  const conversations = useConversations(chat.orgId);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => setSelectedId(initialConversationId), [initialConversationId]);

  const select = (id: string | null) => {
    setSelectedId(id);
    router.replace(
      id ? { pathname: "/dashboard/messages", query: { c: id } } : "/dashboard/messages",
      { scroll: false }
    );
  };

  const list = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    return (conversations.data ?? []).filter((conversation) => {
      if (filter === "unread" && !(conversation.unread_count > 0)) return false;
      if (filter === "groups" && conversation.kind !== "group") return false;
      return !q || normalizeSearchText(conversationTitle(conversation, chat.meId)).includes(q);
    });
  }, [chat.meId, conversations.data, filter, query]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("page.filters.all") },
    { id: "unread", label: t("page.filters.unread") },
    { id: "groups", label: t("page.filters.groups") },
  ];

  return (
    <div className="flex h-full min-h-0 bg-background" data-testid="messages-page">
      <aside
        className={cn(
          "flex w-full min-w-0 flex-col border-r md:w-72 md:shrink-0",
          selectedId ? "hidden md:flex" : "flex"
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <h1 className="text-[13px] font-semibold">{t("page.title")}</h1>
          <span className="flex-1" />
          <NewConversationPopover onCreated={(id) => select(id)} side="bottom" align="end">
            <button
              type="button"
              aria-label={t("bar.newConversation")}
              title={t("bar.newConversation")}
              className="flex size-7 items-center justify-center rounded-md text-foreground/80 hover:bg-muted"
            >
              <SquarePen className="size-3.5" />
            </button>
          </NewConversationPopover>
        </div>
        <div className="space-y-2 px-2.5 pt-2">
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
          <div role="tablist" className="flex border-b">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "relative h-8 px-2 text-xs",
                  "after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:rounded-full",
                  filter === item.id
                    ? "font-semibold text-foreground after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
          {list.length === 0 && !conversations.isLoading ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {conversations.data?.length ? t("bar.noResults") : t("bar.empty")}
            </p>
          ) : (
            list.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedId}
                onSelect={select}
                ringClassName="ring-background"
              />
            ))
          )}
        </div>
      </aside>

      {selectedId ? (
        <ConversationPane
          key={selectedId}
          conversationId={selectedId}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails((value) => !value)}
          onBack={() => select(null)}
          onLeft={() => select(null)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center text-xs text-muted-foreground md:flex">
          {t("page.selectConversation")}
        </div>
      )}
    </div>
  );
}

function ConversationPane({
  conversationId,
  showDetails,
  onToggleDetails,
  onBack,
  onLeft,
}: {
  conversationId: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onBack: () => void;
  onLeft: () => void;
}) {
  const t = useTranslations("chat");
  const chat = useOptionalChat()!;
  const detail = useConversation(conversationId);
  const summary = useConversations(chat.orgId).data?.find((c) => c.id === conversationId);
  const source = detail.data ?? summary;
  const composerRef = useRef<ChatComposerHandle>(null);
  const { typing, notifyTyping, notifyStopped } = useTypingIndicator({
    client: chat.supabase,
    topic: chatTypingTopic(conversationId),
    me: { id: chat.meId, name: chat.meName },
  });
  useReadWhileVisible(conversationId, true);

  const peer = source ? directPeer(source, chat.meId) : null;
  const online = !!peer && chat.onlineIds.has(peer.user_id);
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

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("page.back")}
            className="flex size-7 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <ChevronLeft className="size-4" />
          </button>
          <ChatAvatar
            initials={source ? conversationInitials(source, chat.meId) : "…"}
            src={peer?.avatar_url}
            group={source?.kind === "group"}
            online={online}
            size={26}
            ringClassName="ring-background"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {source ? conversationTitle(source, chat.meId) : ""}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{status}</div>
          </div>
          <button
            type="button"
            onClick={onToggleDetails}
            aria-label={t("page.details")}
            aria-pressed={showDetails}
            title={t("page.details")}
            className={cn(
              "hidden size-7 items-center justify-center rounded-md hover:bg-muted xl:flex",
              showDetails && "bg-muted"
            )}
          >
            <PanelRight className="size-4" />
          </button>
        </div>
        <ChatThread
          conversationId={conversationId}
          conversation={detail.data}
          typing={typing}
          onRetry={(message) => composerRef.current?.retry(message)}
          density="comfortable"
        />
        <ChatComposer
          ref={composerRef}
          conversationId={conversationId}
          onTyping={notifyTyping}
          onStopped={notifyStopped}
          autoFocus
          size="comfortable"
        />
      </section>
      {showDetails && detail.data ? (
        <ConversationDetails conversation={detail.data} muted={!!summary?.muted} onLeft={onLeft} />
      ) : null}
    </>
  );
}
