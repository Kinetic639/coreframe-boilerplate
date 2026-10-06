import type { PortalSupabase } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import { plainToRichDoc, TICKET_TARGET, toPerson } from "./requests.service";
import type { RequestComment, ServiceResult } from "./types";

const USER_COLS = "id, first_name, last_name, email, avatar_url";

/** Public thread only: internal notes are filtered here and denied by RLS for non-managers. */
export async function listComments(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string
): Promise<ServiceResult<RequestComment[]>> {
  const { data, error } = await supabase
    .from("app_comments")
    .select("id, body_plain, created_by, created_at")
    .eq("org_id", ctx.org.id)
    .eq("target_type", TICKET_TARGET)
    .eq("target_id", ticketId)
    .neq("visibility", "internal")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: users } = authorIds.length
    ? await supabase.from("users").select(USER_COLS).in("id", authorIds)
    : { data: [] };
  const byId = new Map((users ?? []).map((u) => [u.id, toPerson(u)]));

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      author: (r.created_by && byId.get(r.created_by)) || null,
      bodyPlain: r.body_plain ?? "",
      createdAt: r.created_at,
      isMine: r.created_by === ctx.user.id,
    })),
  };
}

/**
 * Advisor's reply (always public). A reply to a request the parts department marked
 * "resolved" puts it back in the queue as "open" (plan, section 3a).
 */
export async function addComment(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string,
  body: string
): Promise<ServiceResult<{ id: string }>> {
  const { data: ticket } = await supabase
    .from("helpdesk_tickets")
    .select("id, status, created_by")
    .eq("id", ticketId)
    .eq("org_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "not_found" };
  if (ticket.status === "closed" || ticket.status === "cancelled") {
    return { ok: false, error: "closed" };
  }

  const { data, error } = await supabase
    .from("app_comments")
    .insert({
      org_id: ctx.org.id,
      target_type: TICKET_TARGET,
      target_id: ticketId,
      body_plain: body,
      body_rich: plainToRichDoc(body),
      visibility: "default",
      kind: "comment",
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: ticketId,
      org_id: ctx.org.id,
      actor_id: ctx.user.id,
      event_type: "comment_added",
      payload: { is_internal: false },
    }),
    ticket.status === "resolved" && ticket.created_by === ctx.user.id
      ? supabase
          .from("helpdesk_tickets")
          .update({ status: "open", updated_at: now })
          .eq("id", ticketId)
      : supabase.from("helpdesk_tickets").update({ updated_at: now }).eq("id", ticketId),
  ]);

  return { ok: true, data: { id: data.id } };
}
