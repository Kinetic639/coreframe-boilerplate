"use client";

import { useCallback } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  deleteMessageAction,
  editMessageAction,
  markConversationReadAction,
  sendMessageAction,
  type ChatPerson,
} from "@/app/actions/messages";
import {
  applyMessageUpdateToList,
  applyReaction,
  clearUnread,
  setMessageReactions,
  replaceMessage,
  flattenMessages,
  upsertMessage,
  type MessagesInfiniteData,
  type PendingChatMessage,
} from "@/lib/messages/cache";
import { createReadBatcher } from "@/lib/messages/read-batcher";
import type { GifSearchPage } from "@/lib/messages/gif";
import { createClient } from "@/utils/supabase/client";
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatInvitation,
  ChatMedia,
  ChatMessage,
  ChatPendingInvite,
  ChatMessageCursor,
  ChatMessagesPage,
} from "@/lib/messages/types";
import { appRead } from "@/lib/read";

export const messagesKeys = {
  all: ["messages"] as const,
  conversations: (orgId: string) => ["messages", "conversations", orgId] as const,
  conversation: (conversationId: string) => ["messages", "conversation", conversationId] as const,
  thread: (conversationId: string) => ["messages", "thread", conversationId] as const,
  people: (orgId: string) => ["messages", "people", orgId] as const,
  invitations: (orgId: string) => ["messages", "invitations", orgId] as const,
  pendingInvites: (conversationId: string) =>
    ["messages", "pending-invites", conversationId] as const,
};

export function useConversations(orgId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.conversations(orgId ?? ""),
    queryFn: async (): Promise<ChatConversationSummary[]> => {
      const result = await appRead("conversations", { limit: 100 });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.conversation(conversationId ?? ""),
    queryFn: async (): Promise<ChatConversationDetail> => {
      const result = await appRead("conversation", { conversationId });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!conversationId,
    staleTime: 60_000,
  });
}

/** Messages of one conversation, newest page first; `fetchNextPage` loads older ones */
export function useMessages(conversationId: string | null | undefined) {
  const query = useInfiniteQuery({
    queryKey: messagesKeys.thread(conversationId ?? ""),
    queryFn: async ({ pageParam }): Promise<ChatMessagesPage> => {
      const result = await appRead("messages", {
        conversationId,
        before: (pageParam as ChatMessageCursor | null) ?? null,
      });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    initialPageParam: null as ChatMessageCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: 60_000,
  });
  return { ...query, messages: flattenMessages(query.data as MessagesInfiniteData | undefined) };
}

/** Groups the user was invited to and has not answered yet */
export function useChatInvitations(orgId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.invitations(orgId ?? ""),
    queryFn: async (): Promise<ChatInvitation[]> => {
      const result = await appRead("chatInvitations");
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** People invited to a conversation who have not answered yet */
export function usePendingChatInvites(conversationId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: messagesKeys.pendingInvites(conversationId ?? ""),
    queryFn: async (): Promise<ChatPendingInvite[]> => {
      const result = await appRead("pendingChatInvites", { conversationId });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!conversationId && enabled,
    staleTime: 30_000,
  });
}

export function useChatPeople(orgId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.people(orgId ?? ""),
    queryFn: async (): Promise<ChatPerson[]> => {
      const result = await appRead("chatPeople");
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

function setThread(queryClient: QueryClient, conversationId: string, message: PendingChatMessage) {
  queryClient.setQueryData<MessagesInfiniteData>(messagesKeys.thread(conversationId), (data) =>
    upsertMessage(data, message)
  );
}

export interface SendMessageVariables {
  conversationId: string;
  bodyPlain: string;
  bodyRich?: unknown | null;
  attachmentIds?: string[];
  /** A GIF sent as the message */
  media?: ChatMedia | null;
  /** Generated by the caller; a retry reuses it so the message is stored once */
  clientId: string;
}

/** Sends with an optimistic message; the stored one replaces it (matched by client id) */
export function useSendMessage(meId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: SendMessageVariables) => {
      const result = await sendMessageAction(variables);
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    onMutate: (variables) => {
      if (!meId) return;
      setThread(queryClient, variables.conversationId, {
        id: `pending:${variables.clientId}`,
        conversation_id: variables.conversationId,
        author_id: meId,
        kind: "text",
        body_plain: variables.bodyPlain,
        body_rich: variables.bodyRich ?? null,
        mentions: [],
        attachment_ids: variables.attachmentIds ?? [],
        system_event: null,
        client_id: variables.clientId,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: {},
        media: variables.media ?? null,
        pending: true,
      });
    },
    onSuccess: (message) => setThread(queryClient, message.conversation_id, message),
    onError: (_error, variables) => {
      queryClient.setQueryData<MessagesInfiniteData>(
        messagesKeys.thread(variables.conversationId),
        (data) => {
          const pending = flattenMessages(data).find((m) => m.client_id === variables.clientId);
          return pending ? upsertMessage(data, { ...pending, pending: false, failed: true }) : data;
        }
      );
    },
  });
}

/** Edit and delete of an own message; the stored row replaces the cached one */
export function useMessageChanges(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const apply = useCallback(
    (message: ChatMessage) => {
      queryClient.setQueryData<MessagesInfiniteData>(
        messagesKeys.thread(message.conversation_id),
        (data) => replaceMessage(data, message)
      );
      if (orgId) {
        queryClient.setQueryData<ChatConversationSummary[]>(
          messagesKeys.conversations(orgId),
          (list) => applyMessageUpdateToList(list, message)
        );
      }
    },
    [orgId, queryClient]
  );
  const editMessage = useMutation({
    mutationFn: async (variables: { messageId: string; bodyPlain: string; bodyRich?: unknown }) => {
      const result = await editMessageAction(variables);
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    onSuccess: apply,
  });
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const result = await deleteMessageAction({ messageId });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    onSuccess: apply,
  });
  return { editMessage, deleteMessage };
}

/**
 * Adds or removes the user's reaction. Straight to the chat_react RPC from the
 * browser (it checks membership itself), so a click costs one small request
 * and no server render; the cache changes at once and every member gets the
 * stored row through the inbox channel ("message_updated").
 */
export function useReactToMessage(meId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: {
      conversationId: string;
      messageId: string;
      emoji: string;
      on: boolean;
    }) => {
      const { data, error } = await createClient().rpc("chat_react", {
        p_message_id: variables.messageId,
        p_emoji: variables.emoji,
        p_on: variables.on,
      });
      if (error) throw new Error(error.code === "22023" ? "invalid" : "failed");
      return data as ChatMessage;
    },
    onMutate: ({ conversationId, messageId, emoji, on }) => {
      if (!meId) return;
      queryClient.setQueryData<MessagesInfiniteData>(messagesKeys.thread(conversationId), (data) =>
        setMessageReactions(data, messageId, (reactions) =>
          applyReaction(reactions, emoji, meId, on)
        )
      );
    },
    onSuccess: (message) => {
      queryClient.setQueryData<MessagesInfiniteData>(
        messagesKeys.thread(message.conversation_id),
        (data) => replaceMessage(data, message)
      );
    },
    onError: (_error, { conversationId, messageId, emoji, on }) => {
      if (!meId) return;
      queryClient.setQueryData<MessagesInfiniteData>(messagesKeys.thread(conversationId), (data) =>
        setMessageReactions(data, messageId, (reactions) =>
          applyReaction(reactions, emoji, meId, !on)
        )
      );
    },
  });
}

/** GIF search for the picker (trending without a query); pages load on scroll */
export function useGifSearch(query: string, locale: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["messages", "gifs", locale, query] as const,
    queryFn: async ({ pageParam }): Promise<GifSearchPage> => {
      const params = new URLSearchParams({ locale });
      if (query) params.set("q", query);
      if (pageParam) params.set("pos", pageParam as string);
      const response = await fetch(`/api/chat/gifs?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as
        | (GifSearchPage & { error?: string })
        | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "failed");
      return body;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next,
    enabled,
    staleTime: 10 * 60_000,
    retry: (count, error) => error.message !== "not_configured" && count < 1,
  });
}

const readBatcher = createReadBatcher((conversationId) => {
  void markConversationReadAction({ conversationId });
});
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => readBatcher.flush());
}

/** Marks a conversation read: the local unread count at once, the server in batches */
export function useMarkConversationRead(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    (conversationId: string) => {
      if (!orgId) return;
      queryClient.setQueryData<ChatConversationSummary[]>(
        messagesKeys.conversations(orgId),
        (list) => clearUnread(list, conversationId)
      );
      // The server call is batched: at most one per conversation every 2.5 s
      readBatcher.request(conversationId);
    },
    [orgId, queryClient]
  );
}
