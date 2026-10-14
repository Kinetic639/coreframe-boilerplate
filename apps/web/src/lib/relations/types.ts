/**
 * Things related to an object (a repair order today): where it is mentioned
 * with "@" and which tickets refer to it. Rows come from `object_mentions`
 * (migration 20261012233014) and `helpdesk_ticket_references`.
 */

export type RelationSource = "ticket" | "task" | "comment" | "chat";

export interface RelationItem {
  source: RelationSource;
  /** "reference" = an explicit link (a ticket raised for this order); "mention" = "@" in text */
  relation: "reference" | "mention";
  id: string;
  /** Number of the ticket / task (or of the object a comment is on) */
  code: string | null;
  title: string | null;
  status?: string | null;
  /** Excerpt of the comment or the chat message */
  snippet?: string | null;
  author?: string | null;
  created_at: string;
  /** Comments: what they are on */
  target_type?: string | null;
  target_id?: string | null;
  /** Chat messages */
  conversation_id?: string | null;
  conversation_kind?: "direct" | "group" | null;
}

/** Route of a related row, or null when there is no page for it */
export function relationRoute(
  item: RelationItem
): { pathname: string; query?: Record<string, string> } | null {
  const target = (type: string | null | undefined, id: string | null | undefined) => {
    if (!id) return null;
    if (type === "helpdesk.ticket") return { pathname: `/dashboard/help-desk/tickets/${id}` };
    if (type === "planning.task") return { pathname: `/dashboard/planning/tasks/${id}` };
    if (type === "workshop.repair_order") return { pathname: `/dashboard/workshop/${id}` };
    return null;
  };
  switch (item.source) {
    case "ticket":
      return target("helpdesk.ticket", item.id);
    case "task":
      return target("planning.task", item.id);
    case "comment":
      return target(item.target_type, item.target_id);
    case "chat":
      return item.conversation_id
        ? { pathname: "/dashboard/messages", query: { c: item.conversation_id } }
        : null;
    default:
      return null;
  }
}
