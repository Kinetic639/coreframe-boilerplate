import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateTicketTypeInput,
  SaveHelpdeskSettingsInput,
  TicketPriority,
  UpdateTicketTypeInput,
} from "@/lib/validations/helpdesk";
import type { PaginatedResult } from "@/lib/data-view/types";

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
  scope: "org" | "branch";
  branch_id: string | null;
  requires_acceptance: boolean;
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

export interface HelpdeskTypeDefaultAcceptor {
  id: string;
  org_id: string;
  ticket_type_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

export interface HelpdeskTicketTypeWithDetails extends HelpdeskTicketType {
  default_responders: HelpdeskTypeDefaultResponder[];
  default_acceptors: HelpdeskTypeDefaultAcceptor[];
}

export interface HelpdeskBadgeConfig {
  label: string;
  color: string;
}

export interface HelpdeskSettingsRow {
  org_id: string;
  ticket_prefix: string | null;
  status_configs: Record<string, HelpdeskBadgeConfig> | null;
  priority_configs: Record<string, HelpdeskBadgeConfig> | null;
}

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined
): string | null {
  const full = [firstName, lastName].filter(Boolean).join(" ");
  return full || email || null;
}

export class HelpdeskTicketTypesService {
  // ── List ──────────────────────────────────────────────────────────────────

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

    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as HelpdeskTicketType[] };
  }

  static async listWithDetails(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<HelpdeskTicketTypeWithDetails[]>> {
    const typesResult = await HelpdeskTicketTypesService.list(supabase, orgId, true);
    if (!typesResult.success)
      return { success: false, error: (typesResult as { success: false; error: string }).error };

    const types = typesResult.data;
    if (types.length === 0) return { success: true, data: [] };

    const typeIds = types.map((t) => t.id);

    const [{ data: responderRows }, { data: acceptorRows }] = await Promise.all([
      supabase
        .from("helpdesk_ticket_type_default_responders")
        .select(
          "id, org_id, ticket_type_id, responder_user_id, created_at," +
            "responder:users!responder_user_id(id,first_name,last_name,email)"
        )
        .eq("org_id", orgId)
        .in("ticket_type_id", typeIds)
        .is("deleted_at", null),
      supabase
        .from("helpdesk_ticket_type_acceptors")
        .select(
          "id, org_id, ticket_type_id, user_id, created_at," +
            "user:users!user_id(id,first_name,last_name,email)"
        )
        .eq("org_id", orgId)
        .in("ticket_type_id", typeIds),
    ]);

    const respondersByType = new Map<string, HelpdeskTypeDefaultResponder[]>();
    for (const row of (responderRows ?? []) as any[]) {
      const u = row.responder as {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      const item: HelpdeskTypeDefaultResponder = {
        id: row.id,
        org_id: row.org_id,
        ticket_type_id: row.ticket_type_id,
        responder_user_id: row.responder_user_id,
        responder_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        responder_email: u?.email ?? null,
        created_at: row.created_at,
      };
      const arr = respondersByType.get(row.ticket_type_id) ?? [];
      arr.push(item);
      respondersByType.set(row.ticket_type_id, arr);
    }

    const acceptorsByType = new Map<string, HelpdeskTypeDefaultAcceptor[]>();
    for (const row of (acceptorRows ?? []) as any[]) {
      const u = row.user as {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      const item: HelpdeskTypeDefaultAcceptor = {
        id: row.id,
        org_id: row.org_id,
        ticket_type_id: row.ticket_type_id,
        user_id: row.user_id,
        user_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        user_email: u?.email ?? null,
        created_at: row.created_at,
      };
      const arr = acceptorsByType.get(row.ticket_type_id) ?? [];
      arr.push(item);
      acceptorsByType.set(row.ticket_type_id, arr);
    }

    const result: HelpdeskTicketTypeWithDetails[] = types.map((t) => ({
      ...t,
      default_responders: respondersByType.get(t.id) ?? [],
      default_acceptors: acceptorsByType.get(t.id) ?? [],
    }));

    return { success: true, data: result };
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

  static async getDetailById(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<HelpdeskTicketTypeWithDetails>> {
    const typeResult = await HelpdeskTicketTypesService.getById(supabase, orgId, id);
    if (!typeResult.success)
      return { success: false, error: (typeResult as { success: false; error: string }).error };

    const [respondersResult, acceptorsResult] = await Promise.all([
      HelpdeskTicketTypesService.getDefaultResponders(supabase, orgId, id),
      HelpdeskTicketTypesService.getDefaultAcceptors(supabase, orgId, id),
    ]);

    return {
      success: true,
      data: {
        ...typeResult.data,
        default_responders: respondersResult.success ? respondersResult.data : [],
        default_acceptors: acceptorsResult.success ? acceptorsResult.data : [],
      },
    };
  }

  static async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    page = 1,
    pageSize = 50
  ): Promise<ServiceResult<PaginatedResult<HelpdeskTicketTypeWithDetails>>> {
    const result = await HelpdeskTicketTypesService.listWithDetails(supabase, orgId);
    if (!result.success)
      return { success: false, error: (result as { success: false; error: string }).error };

    const all = result.data;
    const totalCount = all.length;
    const offset = (page - 1) * pageSize;
    const rows = all.slice(offset, offset + pageSize);

    return { success: true, data: { rows, totalCount, page, pageSize } };
  }

  // ── Default responders ────────────────────────────────────────────────────

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
      return {
        id: row.id,
        org_id: row.org_id,
        ticket_type_id: row.ticket_type_id,
        responder_user_id: row.responder_user_id,
        responder_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        responder_email: u?.email ?? null,
        created_at: row.created_at,
      };
    });

    return { success: true, data: rows };
  }

  static async setDefaultResponders(
    supabase: SupabaseClient,
    orgId: string,
    ticketTypeId: string,
    userIds: string[]
  ): Promise<ServiceResult<void>> {
    // Soft-delete all existing
    await supabase
      .from("helpdesk_ticket_type_default_responders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("ticket_type_id", ticketTypeId)
      .is("deleted_at", null);

    if (userIds.length > 0) {
      const rows = userIds.map((uid) => ({
        org_id: orgId,
        ticket_type_id: ticketTypeId,
        responder_user_id: uid,
      }));
      const { error } = await supabase.from("helpdesk_ticket_type_default_responders").insert(rows);
      if (error) return { success: false, error: error.message };
    }

    return { success: true, data: undefined };
  }

  // ── Default acceptors ────────────────────────────────────────────────────

  static async getDefaultAcceptors(
    supabase: SupabaseClient,
    orgId: string,
    ticketTypeId: string
  ): Promise<ServiceResult<HelpdeskTypeDefaultAcceptor[]>> {
    const { data, error } = await supabase
      .from("helpdesk_ticket_type_acceptors")
      .select(
        "id, org_id, ticket_type_id, user_id, created_at," +
          "user:users!user_id(id,first_name,last_name,email)"
      )
      .eq("org_id", orgId)
      .eq("ticket_type_id", ticketTypeId);

    if (error) return { success: false, error: error.message };

    const rows: HelpdeskTypeDefaultAcceptor[] = ((data ?? []) as any[]).map((row) => {
      const u = row.user as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      return {
        id: row.id,
        org_id: row.org_id,
        ticket_type_id: row.ticket_type_id,
        user_id: row.user_id,
        user_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        user_email: u?.email ?? null,
        created_at: row.created_at,
      };
    });

    return { success: true, data: rows };
  }

  static async setDefaultAcceptors(
    supabase: SupabaseClient,
    orgId: string,
    ticketTypeId: string,
    userIds: string[]
  ): Promise<ServiceResult<void>> {
    // Hard delete all existing for this type
    await supabase
      .from("helpdesk_ticket_type_acceptors")
      .delete()
      .eq("org_id", orgId)
      .eq("ticket_type_id", ticketTypeId);

    if (userIds.length > 0) {
      const rows = userIds.map((uid) => ({
        org_id: orgId,
        ticket_type_id: ticketTypeId,
        user_id: uid,
      }));
      const { error } = await supabase.from("helpdesk_ticket_type_acceptors").insert(rows);
      if (error) return { success: false, error: error.message };
    }

    return { success: true, data: undefined };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  static async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateTicketTypeInput
  ): Promise<ServiceResult<HelpdeskTicketType>> {
    const { responder_user_ids: _r, acceptor_user_ids: _a, ...typeFields } = input as any;
    const { data, error } = await supabase
      .from("helpdesk_ticket_types")
      .insert({ ...typeFields, org_id: orgId, created_by: userId })
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
    const { id, responder_user_ids: _r, acceptor_user_ids: _a, ...rest } = input as any;
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

  // ── Settings ──────────────────────────────────────────────────────────────

  static async getSettings(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<HelpdeskSettingsRow | null>> {
    const { data, error } = await supabase
      .from("helpdesk_settings")
      .select("org_id, ticket_prefix, status_configs, priority_configs")
      .eq("org_id", orgId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskSettingsRow | null };
  }

  static async saveSettings(
    supabase: SupabaseClient,
    orgId: string,
    input: SaveHelpdeskSettingsInput
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("helpdesk_settings")
      .upsert({ org_id: orgId, ...input }, { onConflict: "org_id" });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
