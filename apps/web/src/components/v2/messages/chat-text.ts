import type { useTranslations } from "next-intl";
import { memberName } from "@/lib/messages/display";
import type {
  ChatConversationSummary,
  ChatMemberProfile,
  ChatSystemEvent,
} from "@/lib/messages/types";

type ChatTranslator = ReturnType<typeof useTranslations<"chat">>;

function nameOf(
  members: ChatMemberProfile[],
  userId: string | null,
  t: ChatTranslator,
  meId: string
) {
  if (!userId) return t("system.someone");
  if (userId === meId) return t("window.you");
  const member = members.find((m) => m.user_id === userId);
  return member ? memberName(member) : t("system.someone");
}

/** "Marta dodała: Krzysztof, Ewa" */
export function systemEventText(
  event: ChatSystemEvent | null,
  actorId: string | null,
  members: ChatMemberProfile[],
  meId: string,
  t: ChatTranslator
): string {
  if (!event) return t("preview.system");
  const actor = nameOf(members, actorId, t, meId);
  const users = (event.user_ids ?? []).map((id) => nameOf(members, id, t, meId)).join(", ");
  switch (event.action) {
    case "created":
      return t("system.created", { actor, name: event.name ?? "" });
    case "added":
      return t("system.added", { actor, users });
    case "removed":
      return t("system.removed", { actor, users });
    case "left":
      return t("system.left", { actor });
    case "renamed":
      return t("system.renamed", { actor, name: event.name ?? "" });
    default:
      return t("preview.system");
  }
}

/** Second line of a conversation row: "Ty: Będę za 10 minut", "Marta: PZ zaksięgowany" */
export function lastMessagePreview(
  conversation: ChatConversationSummary,
  meId: string,
  t: ChatTranslator
): string {
  const last = conversation.last_message;
  if (!last) return t("preview.empty");
  if (last.deleted) return t("window.deleted");
  if (last.kind === "system") {
    return systemEventText(last.system_event, last.author_id, conversation.members, meId, t);
  }
  const body =
    last.body_plain.trim() ||
    (last.attachment_count > 0
      ? t("preview.attachments", { count: last.attachment_count })
      : t("preview.empty"));
  if (last.author_id === meId) return `${t("preview.you")}${body}`;
  if (conversation.kind === "group") {
    const author = conversation.members.find((m) => m.user_id === last.author_id);
    const first = author?.first_name?.trim() || (author ? memberName(author) : "");
    return first ? `${first}: ${body}` : body;
  }
  return body;
}
