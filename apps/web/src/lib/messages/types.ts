/**
 * Messages (chat between employees) — shapes shared by the server service,
 * the actions and the client. Rows come from the chat RPCs / RLS reads of
 * migration 20261009193050_chat_foundation.sql.
 */

export type ChatConversationKind = "direct" | "group";
export type ChatMemberRole = "owner" | "member";

export interface ChatMemberProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: ChatMemberRole;
  last_read_at: string;
  joined_at?: string;
  left_at?: string | null;
  muted_until?: string | null;
}

export type ChatSystemAction = "created" | "added" | "removed" | "left" | "renamed";

export interface ChatSystemEvent {
  action: ChatSystemAction;
  name?: string;
  user_ids?: string[];
}

export interface ChatLastMessage {
  id: string;
  author_id: string | null;
  kind: "text" | "system";
  body_plain: string;
  system_event: ChatSystemEvent | null;
  attachment_count: number;
  created_at: string;
  deleted: boolean;
}

/** One row of the conversation list (bar, page) */
export interface ChatConversationSummary {
  id: string;
  kind: ChatConversationKind;
  name: string | null;
  created_at: string;
  /** Time of the last message, or of creation */
  activity_at: string;
  unread_count: number;
  muted: boolean;
  member_count: number;
  /** First members (up to 6), the caller included */
  members: ChatMemberProfile[];
  last_message: ChatLastMessage | null;
}

/** One conversation with every member, former ones included (author names) */
export interface ChatConversationDetail {
  id: string;
  organization_id: string;
  kind: ChatConversationKind;
  name: string | null;
  created_by: string | null;
  created_at: string;
  members: ChatMemberProfile[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  author_id: string | null;
  kind: "text" | "system";
  body_plain: string;
  body_rich: unknown | null;
  mentions: unknown[];
  attachment_ids: string[];
  system_event: ChatSystemEvent | null;
  client_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

/** Keyset cursor for older messages */
export interface ChatMessageCursor {
  createdAt: string;
  id: string;
}

export interface ChatMessagesPage {
  /** Oldest first */
  messages: ChatMessage[];
  /** Cursor for the next (older) page, null at the start of the conversation */
  nextCursor: ChatMessageCursor | null;
}

/** Events on the private "user:<uid>:inbox" channel (sent by database triggers) */
export type ChatInboxEvent =
  | { type: "message"; conversation_id: string; message: ChatMessage }
  | { type: "read"; conversation_id: string; user_id: string; last_read_at: string }
  | { type: "membership"; conversation_id: string; active: boolean };

/** Error codes the chat actions return (mapped from Postgres errors) */
export type ChatErrorCode = "forbidden" | "invalid" | "tooLong" | "notFound" | "failed";

export const CHAT_MESSAGE_MAX_LENGTH = 8000;
export const CHAT_GROUP_NAME_MAX_LENGTH = 80;
export const CHAT_MESSAGES_PAGE_SIZE = 40;
