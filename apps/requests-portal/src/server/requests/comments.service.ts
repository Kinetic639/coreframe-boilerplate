import type { Json } from "@repo/supabase/database";
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
    .select("id, body_plain, body_rich, created_by, created_at, updated_at")
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
      bodyRich: r.body_rich ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
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
  body: string,
  bodyRich?: unknown
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
      body_rich: (bodyRich ?? plainToRichDoc(body)) as Json,
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

/** Author edits their own public comment (RLS: created_by = auth.uid()). */
export async function updateOwnComment(
  supabase: PortalSupabase,
  ctx: PortalContext,
  commentId: string,
  body: string,
  bodyRich: unknown
): Promise<ServiceResult<RequestComment>> {
  const { data, error } = await supabase
    .from("app_comments")
    .update({
      body_plain: body,
      body_rich: bodyRich as Json,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("org_id", ctx.org.id)
    .eq("target_type", TICKET_TARGET)
    .eq("created_by", ctx.user.id)
    .neq("visibility", "internal")
    .is("deleted_at", null)
    .select("id, body_plain, body_rich, created_at, updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return {
    ok: true,
    data: {
      id: data.id,
      author: {
        id: ctx.user.id,
        name: ctx.user.displayName,
        initials: ctx.user.initials,
        avatarUrl: ctx.user.avatarUrl,
      },
      bodyPlain: data.body_plain ?? "",
      bodyRich: data.body_rich ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isMine: true,
    },
  };
}
