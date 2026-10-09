import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatMemberProfile,
  ChatMessage,
  ChatMessagesPage,
} from "./types";

/**
 * Pure cache updates for the messages queries: realtime events and optimistic
 * sends land in the TanStack Query cache through these, so they stay testable
 * and every path dedupes the same way (by id, then by the sender's client id).
 */

/** Infinite query shape of a conversation's messages: page 0 is the newest */
export interface MessagesInfiniteData {
  pages: ChatMessagesPage[];
  pageParams: unknown[];
}

/** A message being sent (optimistic) or that failed to send */
export interface PendingChatMessage extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
}

function sameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return (
    a.id === b.id || (!!a.client_id && a.client_id === b.client_id && a.author_id === b.author_id)
  );
}

/** Inserts or replaces a message in the newest page (oldest-first order kept) */
export function upsertMessage(
  data: MessagesInfiniteData | undefined,
  message: PendingChatMessage
): MessagesInfiniteData | undefined {
  if (!data || data.pages.length === 0) return data;
  let replaced = false;
  const pages = data.pages.map((page) => {
    const index = page.messages.findIndex((existing) => sameMessage(existing, message));
    if (index < 0) return page;
    replaced = true;
    const messages = page.messages.slice();
    messages[index] = message;
    return { ...page, messages };
  });
  if (replaced) return { ...data, pages };

  const [newest, ...rest] = pages;
  const messages = [...newest.messages, message].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
  return { ...data, pages: [{ ...newest, messages }, ...rest] };
}

/** All loaded messages, oldest first */
export function flattenMessages(data: MessagesInfiniteData | undefined): PendingChatMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.messages);
}

/** Conversation list after a new message: moved to the top, preview and unread updated */
export function applyMessageToList(
  list: ChatConversationSummary[] | undefined,
  message: ChatMessage,
  meId: string,
  isOpenAndVisible: boolean
): ChatConversationSummary[] | undefined {
  if (!list) return list;
  const index = list.findIndex((conversation) => conversation.id === message.conversation_id);
  if (index < 0) return list;
  const current = list[index];
  const counts = message.kind === "text" && message.author_id !== meId && !isOpenAndVisible;
  const updated: ChatConversationSummary = {
    ...current,
    activity_at: message.created_at,
    unread_count: counts ? Math.min(current.unread_count + 1, 99) : current.unread_count,
    last_message: {
      id: message.id,
      author_id: message.author_id,
      kind: message.kind,
      body_plain: message.body_plain.slice(0, 200),
      system_event: message.system_event,
      attachment_count: message.attachment_ids.length,
      created_at: message.created_at,
      deleted: !!message.deleted_at,
    },
  };
  return [updated, ...list.slice(0, index), ...list.slice(index + 1)];
}

export function clearUnread(
  list: ChatConversationSummary[] | undefined,
  conversationId: string
): ChatConversationSummary[] | undefined {
  if (!list) return list;
  return list.map((conversation) =>
    conversation.id === conversationId && conversation.unread_count > 0
      ? { ...conversation, unread_count: 0 }
      : conversation
  );
}

/** Read receipt of another member */
export function applyReadReceipt<T extends ChatConversationDetail | ChatConversationSummary>(
  conversation: T | undefined,
  userId: string,
  lastReadAt: string
): T | undefined {
  if (!conversation) return conversation;
  const members = conversation.members.map((member: ChatMemberProfile) =>
    member.user_id === userId && member.last_read_at < lastReadAt
      ? { ...member, last_read_at: lastReadAt }
      : member
  );
  return { ...conversation, members };
}

/** Number of conversations with unread messages (badge on the messages icon) */
export function unreadConversations(list: ChatConversationSummary[] | undefined): number {
  return (list ?? []).filter((conversation) => conversation.unread_count > 0 && !conversation.muted)
    .length;
}
