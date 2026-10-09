import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./organization.service";
import {
  CHAT_MESSAGES_PAGE_SIZE,
  type ChatConversationDetail,
  type ChatConversationSummary,
  type ChatErrorCode,
  type ChatMessage,
  type ChatMessageCursor,
  type ChatMessagesPage,
} from "@/lib/messages/types";

/**
 * Messages (chat) — reads through RLS (members only), writes through the
 * SECURITY DEFINER RPCs of migration 20261009193050_chat_foundation.sql,
 * which check membership, organization and `messages.use` themselves.
 */

const MESSAGE_COLUMNS =
  "id, conversation_id, author_id, kind, body_plain, body_rich, mentions, attachment_ids, system_event, client_id, created_at, edited_at, deleted_at";

/** Postgres error → stable error code for the client (no internal messages leak) */
export function chatErrorCode(error: { code?: string } | null | undefined): ChatErrorCode {
  switch (error?.code) {
    case "42501":
    case "28000":
      return "forbidden";
    case "22023":
      return "invalid";
    case "22001":
      return "tooLong";
    default:
      return "failed";
  }
}

function fail<T>(
  error: { code?: string; message?: string } | null,
  scope: string
): ServiceResult<T> {
  const code = chatErrorCode(error);
  if (code === "failed") console.error(`[ChatService.${scope}]`, error);
  return { success: false, error: code };
}

export interface SendChatMessageInput {
  conversationId: string;
  bodyPlain: string;
  bodyRich?: unknown | null;
  clientId?: string | null;
  attachmentIds?: string[];
  mentions?: unknown[];
}

export class ChatService {
  static async listConversations(
    supabase: SupabaseClient,
    orgId: string,
    options: { limit?: number; before?: string | null } = {}
  ): Promise<ServiceResult<ChatConversationSummary[]>> {
    const { data, error } = await supabase.rpc("chat_list_conversations", {
      p_org: orgId,
      p_limit: options.limit ?? 50,
      p_before: options.before ?? null,
    });
    if (error) return fail(error, "listConversations");
    return { success: true, data: (data ?? []) as ChatConversationSummary[] };
  }

  static async getConversation(
    supabase: SupabaseClient,
    conversationId: string
  ): Promise<ServiceResult<ChatConversationDetail>> {
    const { data, error } = await supabase.rpc("chat_get_conversation", {
      p_conversation_id: conversationId,
    });
    if (error) return fail(error, "getConversation");
    if (!data) return { success: false, error: "notFound" };
    return { success: true, data: data as ChatConversationDetail };
  }

  /** Newest page first from the database, returned oldest first for display */
  static async listMessages(
    supabase: SupabaseClient,
    conversationId: string,
    options: { before?: ChatMessageCursor | null; limit?: number } = {}
  ): Promise<ServiceResult<ChatMessagesPage>> {
    const limit = Math.min(Math.max(options.limit ?? CHAT_MESSAGES_PAGE_SIZE, 1), 100);
    let query = supabase
      .from("chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    const before = options.before;
    if (before) {
      // (created_at, id) < (cursor.createdAt, cursor.id)
      query = query.or(
        `created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`
      );
    }

    const { data, error } = await query;
    if (error) return fail(error, "listMessages");

    const rows = (data ?? []) as ChatMessage[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const oldest = page[page.length - 1];
    return {
      success: true,
      data: {
        messages: page.reverse(),
        nextCursor: hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
      },
    };
  }

  static async send(
    supabase: SupabaseClient,
    input: SendChatMessageInput
  ): Promise<ServiceResult<ChatMessage>> {
    const { data, error } = await supabase.rpc("chat_send", {
      p_conversation_id: input.conversationId,
      p_body_plain: input.bodyPlain,
      p_body_rich: input.bodyRich ?? null,
      p_client_id: input.clientId ?? null,
      p_attachment_ids: input.attachmentIds ?? [],
      p_mentions: input.mentions ?? [],
    });
    if (error) return fail(error, "send");
    return { success: true, data: data as ChatMessage };
  }

  static async markRead(
    supabase: SupabaseClient,
    conversationId: string,
    until?: string | null
  ): Promise<ServiceResult<string>> {
    const { data, error } = await supabase.rpc("chat_mark_read", {
      p_conversation_id: conversationId,
      p_until: until ?? null,
    });
    if (error) return fail(error, "markRead");
    return { success: true, data: data as string };
  }

  static async openDirect(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<string>> {
    const { data, error } = await supabase.rpc("chat_open_direct", {
      p_org: orgId,
      p_user_id: userId,
    });
    if (error) return fail(error, "openDirect");
    return { success: true, data: data as string };
  }

  static async createGroup(
    supabase: SupabaseClient,
    orgId: string,
    name: string,
    userIds: string[]
  ): Promise<ServiceResult<string>> {
    const { data, error } = await supabase.rpc("chat_create_group", {
      p_org: orgId,
      p_name: name,
      p_user_ids: userIds,
    });
    if (error) return fail(error, "createGroup");
    return { success: true, data: data as string };
  }

  static async addMembers(
    supabase: SupabaseClient,
    conversationId: string,
    userIds: string[]
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_add_members", {
      p_conversation_id: conversationId,
      p_user_ids: userIds,
    });
    if (error) return fail(error, "addMembers");
    return { success: true, data: null };
  }

  /** Owner removes a member; removing oneself leaves the group */
  static async removeMember(
    supabase: SupabaseClient,
    conversationId: string,
    userId: string
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_remove_member", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    if (error) return fail(error, "removeMember");
    return { success: true, data: null };
  }

  static async rename(
    supabase: SupabaseClient,
    conversationId: string,
    name: string
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_rename", {
      p_conversation_id: conversationId,
      p_name: name,
    });
    if (error) return fail(error, "rename");
    return { success: true, data: null };
  }

  static async setMuted(
    supabase: SupabaseClient,
    conversationId: string,
    until: string | null
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_set_muted", {
      p_conversation_id: conversationId,
      p_until: until,
    });
    if (error) return fail(error, "setMuted");
    return { success: true, data: null };
  }
}
