import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RelationItem } from "@/lib/relations/types";
import type { ServiceResult } from "./organization.service";

type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string | null;
  status: string | null;
  created_at: string;
};

/**
 * What is related to an object. Everything is read through the viewer's RLS:
 * a row the viewer could not open is simply not in the list.
 */
export class ObjectRelationsService {
  /** Where the object is mentioned with "@": descriptions, comments, chat messages */
  static async listMentions(
    supabase: SupabaseClient,
    orgId: string,
    type: string,
    id: string
  ): Promise<ServiceResult<RelationItem[]>> {
    const { data, error } = await supabase.rpc("object_mentions", {
      p_org: orgId,
      p_type: type,
      p_id: id,
    });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as Omit<RelationItem, "relation">[]).map((item) => ({
        ...item,
        relation: "mention" as const,
      })),
    };
  }

  /**
   * Help Desk tickets raised for a repair order. The portal stores the order as
   * text ("<order no>/<warehouse>", or the ZL number), not as an id.
   */
  static async listRepairOrderTickets(
    supabase: SupabaseClient,
    orgId: string,
    order: { zlNumber: string | null; orderNo: string | null; warehouseCode: string | null }
  ): Promise<ServiceResult<RelationItem[]>> {
    const keys = [
      order.orderNo && order.warehouseCode ? `${order.orderNo}/${order.warehouseCode}` : null,
      order.zlNumber,
    ].filter((key): key is string => !!key);
    if (keys.length === 0) return { success: true, data: [] };

    const { data: references, error } = await supabase
      .from("helpdesk_ticket_references")
      .select("ticket_id")
      .eq("source_type", "repair_order_number")
      .in("source_id", keys)
      .limit(100);
    if (error) return { success: false, error: error.message };
    const ticketIds = [
      ...new Set(((references ?? []) as { ticket_id: string }[]).map((row) => row.ticket_id)),
    ];
    if (ticketIds.length === 0) return { success: true, data: [] };

    const { data: tickets, error: ticketsError } = await supabase
      .from("helpdesk_tickets")
      .select("id, ticket_number, title, status, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .in("id", ticketIds)
      .order("created_at", { ascending: false });
    if (ticketsError) return { success: false, error: ticketsError.message };

    return {
      success: true,
      data: ((tickets ?? []) as TicketRow[]).map((ticket) => ({
        source: "ticket" as const,
        relation: "reference" as const,
        id: ticket.id,
        code: ticket.ticket_number,
        title: ticket.title,
        status: ticket.status,
        created_at: ticket.created_at,
      })),
    };
  }

  /** Mentions and ticket references of a repair order, newest first, each row once */
  static async listForRepairOrder(
    supabase: SupabaseClient,
    orgId: string,
    order: {
      id: string;
      zlNumber: string | null;
      orderNo: string | null;
      warehouseCode: string | null;
    }
  ): Promise<ServiceResult<RelationItem[]>> {
    const [mentions, tickets] = await Promise.all([
      ObjectRelationsService.listMentions(supabase, orgId, "repairOrder", order.id),
      ObjectRelationsService.listRepairOrderTickets(supabase, orgId, order),
    ]);
    if (!mentions.success && !tickets.success) {
      return { success: false, error: (mentions as { error: string }).error };
    }
    const referenced = tickets.success ? tickets.data : [];
    const referencedIds = new Set(referenced.map((item) => item.id));
    // A ticket that both refers to the order and mentions it is listed once, as a reference
    const mentioned = (mentions.success ? mentions.data : []).filter(
      (item) => !(item.source === "ticket" && referencedIds.has(item.id))
    );
    return {
      success: true,
      data: [...referenced, ...mentioned].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }
}
