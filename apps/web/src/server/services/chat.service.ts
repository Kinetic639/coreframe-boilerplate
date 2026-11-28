import "server-only";
import { compactRichInput } from "@repo/rich-text/rich-text-utils";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./organization.service";
import { OrgMemberPublicProfileService } from "./org-member-public-profile.service";
import { getSignedChatAvatarUrls } from "@/server/storage/chat-avatar-signed-url";
import {
  CHAT_MESSAGES_PAGE_SIZE,
  type ChatConversationDetail,
  type ChatConversationSummary,
  type ChatInvitation,
  type ChatPendingInvite,
  type ChatErrorCode,
  type ChatMessage,
  type ChatMessageCursor,
  type ChatMessagesPage,
  type ChatMedia,
} from "@/lib/messages/types";

/**
 * Messages (chat) — reads through RLS (members only), writes through the
 * SECURITY DEFINER RPCs of migration 20261009193050_chat_foundation.sql,
 * which check membership, organization and `messages.use` themselves.
 */

const LEGACY_MESSAGE_COLUMNS =
  "id, conversation_id, author_id, kind, body_plain, body_rich, mentions, attachment_ids, system_event, client_id, created_at, edited_at, deleted_at";
/** With reactions and GIFs (migration 20261120090000_chat_reactions_and_gifs.sql) */
const MESSAGE_COLUMNS = `${LEGACY_MESSAGE_COLUMNS}, reactions, media`;
/** Postgres "undefined column": the reactions migration is not applied yet */
const UNDEFINED_COLUMN = "42703";
/** Postgres "undefined function": a newer chat migration is not applied yet */
const UNDEFINED_FUNCTION = "42883";

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
  media?: ChatMedia | null;
}

/**
 * Fills `avatar_url` of people in chat data. The chat RPCs return the profile
 * row's avatar_url, but uploaded avatars are private storage objects that need
 * a signed URL — without this step the chat showed initials only.
 */
async function withAvatars<T>(
  supabase: SupabaseClient,
  orgId: string,
  value: T,
  people: (value: T) => ({ user_id: string; avatar_url?: string | null } | null | undefined)[]
): Promise<T> {
  const list = people(value).filter(
    (person): person is { user_id: string; avatar_url?: string | null } => !!person?.user_id
  );
  if (list.length === 0) return value;
  const urls = await OrgMemberPublicProfileService.avatarUrls(
    supabase,
    orgId,
    list.map((person) => person.user_id)
  );
  for (const person of list) {
    person.avatar_url = urls.get(person.user_id) ?? person.avatar_url ?? null;
  }
  return value;
}

/**
 * Fills `avatar_url` of group conversations (group photo). The path is read
 * through RLS (members only) and signed on the server. Before the group photo
 * migration (20261125160000_chat_group_avatars.sql) the column does not exist:
 * groups keep their initials.
 */
async function withGroupAvatars<T extends { id: string; kind: string; avatar_url?: string | null }>(
  supabase: SupabaseClient,
  conversations: T[]
): Promise<T[]> {
  const groups = conversations.filter((conversation) => conversation.kind === "group");
  for (const conversation of conversations) conversation.avatar_url ??= null;
  if (groups.length === 0) return conversations;
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, avatar_path")
    .in(
      "id",
      groups.map((group) => group.id)
    );
  if (error) {
    if (error.code !== UNDEFINED_COLUMN) console.error("[ChatService.groupAvatars]", error);
    return conversations;
  }
  const rows = (data ?? []) as { id: string; avatar_path: string | null }[];
  const urls = await getSignedChatAvatarUrls(
    rows.flatMap((row) =>
      row.avatar_path ? [{ conversationId: row.id, avatarPath: row.avatar_path }] : []
    )
  );
  for (const group of groups) group.avatar_url = urls.get(group.id) ?? null;
  return conversations;
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
    const list = await withAvatars(
      supabase,
      orgId,
      (data ?? []) as ChatConversationSummary[],
      (conversations) => conversations.flatMap((conversation) => conversation.members)
    );
    return { success: true, data: await withGroupAvatars(supabase, list) };
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
    const detail = data as ChatConversationDetail;
    await withGroupAvatars(supabase, [detail]);
    return {
      success: true,
      data: await withAvatars(supabase, detail.organization_id, detail, (d) => d.members),
    };
  }

  /** Newest page first from the database, returned oldest first for display */
  static async listMessages(
    supabase: SupabaseClient,
    conversationId: string,
    options: { before?: ChatMessageCursor | null; limit?: number } = {}
  ): Promise<ServiceResult<ChatMessagesPage>> {
    const limit = Math.min(Math.max(options.limit ?? CHAT_MESSAGES_PAGE_SIZE, 1), 100);
    const page = (columns: string) => {
      let query = supabase
        .from("chat_messages")
        .select(columns)
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
      return query;
    };

    let { data, error } = await page(MESSAGE_COLUMNS);
    // Before the reactions migration is applied the chat keeps working without them
    if (error?.code === UNDEFINED_COLUMN) ({ data, error } = await page(LEGACY_MESSAGE_COLUMNS));
    if (error) return fail(error, "listMessages");

    const rows = (data ?? []) as unknown as ChatMessage[];
    const hasMore = rows.length > limit;
    const newest = rows.slice(0, limit);
    const oldest = newest[newest.length - 1];
    return {
      success: true,
      data: {
        messages: newest.reverse(),
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
      p_body_rich: compactRichInput(input.bodyRich ?? null),
      p_client_id: input.clientId ?? null,
      p_attachment_ids: input.attachmentIds ?? [],
      p_mentions: input.mentions ?? [],
      // Only with a GIF: a plain message also works before the GIF migration is applied
      ...(input.media ? { p_media: input.media } : {}),
    });
    if (error) return fail(error, "send");
    return { success: true, data: data as ChatMessage };
  }

  static async editMessage(
    supabase: SupabaseClient,
    input: { messageId: string; bodyPlain: string; bodyRich?: unknown | null; mentions?: unknown[] }
  ): Promise<ServiceResult<ChatMessage>> {
    const { data, error } = await supabase.rpc("chat_edit_message", {
      p_message_id: input.messageId,
      p_body_plain: input.bodyPlain,
      p_body_rich: compactRichInput(input.bodyRich ?? null),
      p_mentions: input.mentions ?? [],
    });
    if (error) return fail(error, "editMessage");
    return { success: true, data: data as ChatMessage };
  }

  static async deleteMessage(
    supabase: SupabaseClient,
    messageId: string
  ): Promise<ServiceResult<ChatMessage>> {
    const { data, error } = await supabase.rpc("chat_delete_message", { p_message_id: messageId });
    if (error) return fail(error, "deleteMessage");
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

  /**
   * Ids of colleagues the caller can message: active members with the ERP and
   * `messages.use` (migration 20261202090000_chat_people_erp_only.sql). Null
   * while that migration is not applied yet, so callers keep every member.
   */
  static async listPeopleIds(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<Set<string> | null>> {
    const { data, error } = await supabase.rpc("chat_list_people", { p_org: orgId });
    if (error?.code === UNDEFINED_FUNCTION) return { success: true, data: null };
    if (error) return fail(error, "listPeopleIds");
    return { success: true, data: new Set((data ?? []) as string[]) };
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

  /** Groups the user was invited to and has not answered yet */
  static async listInvitations(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<ChatInvitation[]>> {
    const { data, error } = await supabase.rpc("chat_list_invitations", { p_org: orgId });
    if (error) return fail(error, "listInvitations");
    const list = await withAvatars(supabase, orgId, (data ?? []) as ChatInvitation[], (rows) =>
      rows.map((row) => row.invited_by)
    );
    return { success: true, data: list };
  }

  /** Joins (accept) or declines a group invitation */
  static async respondToInvitation(
    supabase: SupabaseClient,
    conversationId: string,
    accept: boolean
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_invitation_respond", {
      p_conversation_id: conversationId,
      p_accept: accept,
    });
    if (error) return fail(error, "respondToInvitation");
    return { success: true, data: null };
  }

  /** The inviter or the group's owner takes a pending invitation back */
  static async withdrawInvitation(
    supabase: SupabaseClient,
    conversationId: string,
    userId: string
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("chat_invitation_withdraw", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    if (error) return fail(error, "withdrawInvitation");
    return { success: true, data: null };
  }

  /** People invited to a conversation who have not answered (members only) */
  static async listPendingInvites(
    supabase: SupabaseClient,
    orgId: string,
    conversationId: string
  ): Promise<ServiceResult<ChatPendingInvite[]>> {
    const { data, error } = await supabase.rpc("chat_pending_invitations", {
      p_conversation_id: conversationId,
    });
    if (error) return fail(error, "listPendingInvites");
    const list = await withAvatars(
      supabase,
      orgId,
      (data ?? []) as ChatPendingInvite[],
      (rows) => rows
    );
    return { success: true, data: list };
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

  /** Sets (path) or removes (null) the group photo; returns the previous path */
  static async setAvatar(
    supabase: SupabaseClient,
    conversationId: string,
    path: string | null
  ): Promise<ServiceResult<string | null>> {
    const { data, error } = await supabase.rpc("chat_set_avatar", {
      p_conversation_id: conversationId,
      p_path: path,
    });
    if (error) return fail(error, "setAvatar");
    return { success: true, data: (data as string | null) ?? null };
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
