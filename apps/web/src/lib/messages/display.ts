import type { ChatConversationDetail, ChatConversationSummary, ChatMemberProfile } from "./types";

/** "Paweł Wiśniewski", falling back to the e-mail */
export function memberName(member: Pick<ChatMemberProfile, "first_name" | "last_name" | "email">) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return name || member.email || "";
}

/** "PW" — two letters for the square avatar */
export function memberInitials(
  member: Pick<ChatMemberProfile, "first_name" | "last_name" | "email">
) {
  const first = member.first_name?.trim()?.[0];
  const last = member.last_name?.trim()?.[0];
  if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
  return (member.email ?? "?").slice(0, 2).toUpperCase();
}

/** The other person of a 1:1 */
export function directPeer(
  conversation: Pick<ChatConversationSummary | ChatConversationDetail, "kind" | "members">,
  meId: string
): ChatMemberProfile | null {
  if (conversation.kind !== "direct") return null;
  return conversation.members.find((member) => member.user_id !== meId) ?? null;
}

/** Group name, or the other person's name for a 1:1 */
export function conversationTitle(
  conversation: Pick<ChatConversationSummary | ChatConversationDetail, "kind" | "name" | "members">,
  meId: string
): string {
  if (conversation.kind === "group") return conversation.name ?? "";
  const peer = directPeer(conversation, meId);
  return peer ? memberName(peer) : "";
}

/** Initials for the conversation avatar (group: from its name) */
export function conversationInitials(
  conversation: Pick<ChatConversationSummary | ChatConversationDetail, "kind" | "name" | "members">,
  meId: string
): string {
  if (conversation.kind === "group") {
    const words = (conversation.name ?? "?").trim().split(/\s+/);
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase() || "?";
  }
  const peer = directPeer(conversation, meId);
  return peer ? memberInitials(peer) : "?";
}

/** Photo of the conversation's avatar: the group photo, or the other person's for a 1:1 */
export function conversationAvatarUrl(
  conversation: Pick<
    ChatConversationSummary | ChatConversationDetail,
    "kind" | "members" | "avatar_url"
  >,
  meId: string
): string | null {
  if (conversation.kind === "group") return conversation.avatar_url ?? null;
  return directPeer(conversation, meId)?.avatar_url ?? null;
}

/**
 * The group's owner or its creator (still a member) may change the group photo
 * — the same rule as chat_can_manage_group in the database.
 */
export function canManageGroup(conversation: ChatConversationDetail, meId: string): boolean {
  if (conversation.kind !== "group") return false;
  const me = conversation.members.find((m) => m.user_id === meId && !m.left_at);
  return !!me && (me.role === "owner" || conversation.created_by === meId);
}
