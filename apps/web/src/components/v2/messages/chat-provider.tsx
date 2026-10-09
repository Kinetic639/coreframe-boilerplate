"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { messagesKeys } from "@/hooks/queries/messages";
import {
  applyMessageToList,
  applyReadReceipt,
  upsertMessage,
  type MessagesInfiniteData,
} from "@/lib/messages/cache";
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatInboxEvent,
  ChatMessage,
} from "@/lib/messages/types";

type InboxListener = (event: ChatInboxEvent) => void;

interface ChatContextValue {
  orgId: string;
  meId: string;
  meName: string;
  /** Browser Supabase client (typing channels use the same socket) */
  supabase: ReturnType<typeof createClient>;
  /** Users of the organization with the app open right now */
  onlineIds: ReadonlySet<string>;
  /** Conversations shown on screen (window open and expanded, or the page) */
  setVisible: (conversationId: string, visible: boolean) => void;
  isVisible: (conversationId: string) => boolean;
  /** Raw inbox events (e.g. to open a chat window on a new message) */
  subscribe: (listener: InboxListener) => () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside <ChatProvider>");
  return value;
}

/** Same as useChat, null outside the provider (no permission, no organization) */
export function useOptionalChat(): ChatContextValue | null {
  return useContext(ChatContext);
}

/**
 * Messages realtime for the whole dashboard, mounted once in the layout:
 * - "user:<uid>:inbox" (private broadcast, sent by database triggers): new messages,
 *   read receipts, membership changes → TanStack Query cache;
 * - "org:<org>:presence": who is online.
 * Re-joins after a dropped connection refetch, since events sent meanwhile are lost.
 */
export function ChatProvider({
  orgId,
  meId,
  meName,
  children,
}: {
  orgId: string;
  meId: string;
  meName: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(new Set());
  const listeners = useRef(new Set<InboxListener>());
  const visible = useRef(new Map<string, number>());

  const isVisible = useCallback(
    (conversationId: string) => (visible.current.get(conversationId) ?? 0) > 0,
    []
  );
  const setVisible = useCallback((conversationId: string, on: boolean) => {
    const count = (visible.current.get(conversationId) ?? 0) + (on ? 1 : -1);
    if (count > 0) visible.current.set(conversationId, count);
    else visible.current.delete(conversationId);
  }, []);
  const subscribe = useCallback((listener: InboxListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    const listKey = messagesKeys.conversations(orgId);

    const onMessage = (message: ChatMessage) => {
      queryClient.setQueryData<MessagesInfiniteData>(
        messagesKeys.thread(message.conversation_id),
        (data) => upsertMessage(data, message)
      );
      const known = queryClient
        .getQueryData<ChatConversationSummary[]>(listKey)
        ?.some((conversation) => conversation.id === message.conversation_id);
      if (known) {
        queryClient.setQueryData<ChatConversationSummary[]>(listKey, (list) =>
          applyMessageToList(list, message, meId, isVisible(message.conversation_id))
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: listKey });
      }
      // Membership and names change with system messages
      if (message.kind === "system") {
        void queryClient.invalidateQueries({
          queryKey: messagesKeys.conversation(message.conversation_id),
        });
        void queryClient.invalidateQueries({ queryKey: listKey });
      }
    };

    const handle = (event: ChatInboxEvent) => {
      if (event.type === "message") onMessage(event.message);
      if (event.type === "read") {
        queryClient.setQueryData<ChatConversationDetail>(
          messagesKeys.conversation(event.conversation_id),
          (detail) => applyReadReceipt(detail, event.user_id, event.last_read_at)
        );
        queryClient.setQueryData<ChatConversationSummary[]>(listKey, (list) =>
          list?.map((conversation) =>
            conversation.id === event.conversation_id
              ? (applyReadReceipt(conversation, event.user_id, event.last_read_at) ?? conversation)
              : conversation
          )
        );
      }
      if (event.type === "membership") {
        void queryClient.invalidateQueries({ queryKey: listKey });
        void queryClient.invalidateQueries({
          queryKey: messagesKeys.conversation(event.conversation_id),
        });
      }
      listeners.current.forEach((listener) => listener(event));
    };

    let active = true;
    let joined = false;
    let inbox: ReturnType<typeof supabase.channel> | null = null;
    let presence: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // Session to Realtime first, or the private join is rejected
      await supabase.realtime.setAuth().catch(() => undefined);
      // supabase-js hands back an existing channel with the same topic; a remount must not
      // attach to the one still being removed
      for (const topic of [`realtime:user:${meId}:inbox`, `realtime:org:${orgId}:presence`]) {
        const stale = supabase.getChannels().find((channel) => channel.topic === topic);
        if (stale) await supabase.removeChannel(stale);
      }
      if (!active) return;

      inbox = supabase
        .channel(`user:${meId}:inbox`, { config: { private: true } })
        .on("broadcast", { event: "chat" }, ({ payload }) => handle(payload as ChatInboxEvent))
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          // Re-joined after a dropped connection: events sent meanwhile were lost
          if (joined) void queryClient.invalidateQueries({ queryKey: messagesKeys.all });
          joined = true;
        });

      const channel = supabase.channel(`org:${orgId}:presence`, {
        config: { private: true, presence: { key: meId } },
      });
      presence = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          setOnlineIds(new Set(Object.keys(channel.presenceState())));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void channel.track({ online_at: new Date().toISOString() });
        });
    })();

    return () => {
      active = false;
      if (inbox) void supabase.removeChannel(inbox);
      if (presence) void supabase.removeChannel(presence);
    };
  }, [isVisible, meId, orgId, queryClient, supabase]);

  const value = useMemo<ChatContextValue>(
    () => ({ orgId, meId, meName, supabase, onlineIds, setVisible, isVisible, subscribe }),
    [isVisible, meId, meName, onlineIds, orgId, setVisible, subscribe, supabase]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
