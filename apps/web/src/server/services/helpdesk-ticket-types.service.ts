import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateTicketTypeInput,
  TicketPriority,
  UpdateTicketTypeInput,
} from "@/lib/validations/helpdesk";

export interface HelpdeskTicketType {
  id: string;
  org_id: string;
  key: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  is_system: boolean;
  allows_manual_assignees: boolean;
  default_priority: TicketPriority;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface HelpdeskTypeDefaultResponder {
  id: string;
  org_id: string;
  ticket_type_id: string;
  responder_user_id: string;
  responder_name: string | null;
  responder_email: string | null;
  created_at: string;
}

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export class HelpdeskTicketTypesService {
  static async list(
    supabase: SupabaseClient,
    orgId: string,
    includeInactive = false
  ): Promise<ServiceResult<HelpdeskTicketType[]>> {
    let query = supabase
      .from("helpdesk_ticket_types")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as HelpdeskTicketType[] };
  }

  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<HelpdeskTicketType>> {
    const { data, error } = await supabase
      .from("helpdesk_ticket_types")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskTicketType };
  }

  static async getDefaultResponders(
    supabase: SupabaseClient,
    orgId: string,
    ticketTypeId: string
  ): Promise<ServiceResult<HelpdeskTypeDefaultResponder[]>> {
    const { data, error } = await supabase
      .from("helpdesk_ticket_type_default_responders")
      .select(
        "id, org_id, ticket_type_id, responder_user_id, created_at," +
          "responder:users!responder_user_id(id,first_name,last_name,email)"
      )
      .eq("org_id", orgId)
      .eq("ticket_type_id", ticketTypeId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };

    const rows: HelpdeskTypeDefaultResponder[] = ((data ?? []) as any[]).map((row) => {
      const u = row.responder as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      const fullName = u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null;
      return {
        id: row.id as string,
        org_id: row.org_id as string,
        ticket_type_id: row.ticket_type_id as string,
        responder_user_id: row.responder_user_id as string,
        responder_name: fullName ?? null,
        responder_email: u?.email ?? null,
        created_at: row.created_at as string,
      };
    });

    return { success: true, data: rows };
  }

  static async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateTicketTypeInput
  ): Promise<ServiceResult<HelpdeskTicketType>> {
    const { data, error } = await supabase
      .from("helpdesk_ticket_types")
      .insert({ ...input, org_id: orgId, created_by: userId })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskTicketType };
  }

  static async update(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateTicketTypeInput
  ): Promise<ServiceResult<HelpdeskTicketType>> {
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from("helpdesk_ticket_types")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskTicketType };
  }

  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("helpdesk_ticket_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
