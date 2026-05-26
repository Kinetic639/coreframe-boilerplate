import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddTicketCommentInput,
  AssigneeRole,
  AssigneeStatus,
  CloseTicketInput,
  CreateTicketInput,
  TicketListFilters,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from "@/lib/validations/helpdesk";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HelpdeskAssigneeInfo {
  user_id: string;
  role: AssigneeRole;
  status: AssigneeStatus;
  name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

export interface HelpdeskTicketListRow {
  id: string;
  org_id: string;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  ticket_type_color: string | null;
  ticket_type_icon: string | null;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  assignees: HelpdeskAssigneeInfo[];
  branch_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HelpdeskTicketDetail extends HelpdeskTicketListRow {
  description: string | null;
  description_plain: string | null;
  description_rich: unknown | null;
  closed_by: string | null;
  resolved_at: string | null;
  due_at: string | null;
  comments: HelpdeskTicketComment[];
  activity: HelpdeskTicketActivity[];
}

export interface HelpdeskTicketComment {
  id: string;
  ticket_id: string;
  org_id: string;
  body: string;
  body_rich: unknown | null;
  is_internal: boolean;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  creator_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HelpdeskTicketActivity {
  id: string;
  ticket_id: string;
  org_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// Legacy type kept for backward compat with existing action imports
export interface HelpdeskTicket {
  id: string;
  org_id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type_id: string | null;
  assigned_to: string | null;
  created_by: string;
  branch_id: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined
): string | null {
  const full = [firstName, lastName].filter(Boolean).join(" ");
  return full || email || null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HelpdeskTicketsService {
  // ── List (DataView) ────────────────────────────────────────────────────────

  static async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<HelpdeskTicketListRow>>> {
    const { search, sort, page, pageSize, filters } = params;
    const offset = (page - 1) * pageSize;

    // Resolve assignedTo filter: get ticket IDs where that user is an assignee
    let assignedToTicketIds: string[] | null = null;
    if (filters.assignedTo) {
      const { data: assigneeRows } = await supabase
        .from("helpdesk_ticket_assignees")
        .select("ticket_id")
        .eq("org_id", orgId)
        .eq("user_id", filters.assignedTo as string)
        .is("deleted_at", null);
      assignedToTicketIds = (assigneeRows ?? []).map((r) => r.ticket_id as string);
      if (assignedToTicketIds.length === 0) {
        return { success: true, data: { rows: [], totalCount: 0, page, pageSize } };
      }
    }

    // Main tickets query
    let query = supabase
      .from("helpdesk_tickets")
      .select(
        [
          "id, org_id, ticket_number, title, status, priority,",
          "ticket_type_id, created_by, branch_id, closed_at, created_at, updated_at,",
          "ticket_type:helpdesk_ticket_types!ticket_type_id(id,name,color,icon),",
          "creator:users!created_by(id,first_name,last_name,email)",
        ].join(""),
        { count: "exact" }
      )
      .eq("org_id", orgId)
      .is("deleted_at", null);

    // Filters
    if (filters.status) query = query.eq("status", filters.status as string);
    if (filters.priority) query = query.eq("priority", filters.priority as string);
    if (filters.ticketTypeId) query = query.eq("ticket_type_id", filters.ticketTypeId as string);
    if (filters.createdBy) query = query.eq("created_by", filters.createdBy as string);
    if (filters.createdAtFrom) query = query.gte("created_at", filters.createdAtFrom as string);
    if (filters.createdAtTo) query = query.lte("created_at", filters.createdAtTo as string);
    if (assignedToTicketIds) query = query.in("id", assignedToTicketIds);
    if (search) query = query.ilike("title", `%${search}%`);

    // Sort
    const sortField = sort?.field ?? "created_at";
    const allowedSorts: Record<string, boolean> = {
      created_at: true,
      updated_at: true,
      ticket_number: true,
      title: true,
      status: true,
      priority: true,
    };
    const safeField = allowedSorts[sortField] ? sortField : "created_at";
    query = query.order(safeField, { ascending: sort?.direction === "asc" });
    query = query.range(offset, offset + pageSize - 1);

    const { data: ticketsRaw, error, count } = await query;
    if (error) return { success: false, error: error.message };

    const tickets = (ticketsRaw ?? []) as any[];

    const ticketIds = tickets.map((t) => t.id as string);

    // Load assignees for the page
    const assigneeMap = new Map<string, HelpdeskAssigneeInfo[]>();
    if (ticketIds.length > 0) {
      const { data: assigneeRows } = await supabase
        .from("helpdesk_ticket_assignees")
        .select(
          "ticket_id, user_id, role, status, user:users!user_id(id,first_name,last_name,email,avatar_url)"
        )
        .in("ticket_id", ticketIds)
        .is("deleted_at", null);

      for (const row of (assigneeRows ?? []) as any[]) {
        const u = row.user as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          avatar_url: string | null;
        } | null;
        const info: HelpdeskAssigneeInfo = {
          user_id: row.user_id as string,
          role: row.role as AssigneeRole,
          status: row.status as AssigneeStatus,
          name: u ? displayName(u.first_name, u.last_name, u.email) : null,
          email: u?.email ?? null,
          avatar_url: u?.avatar_url ?? null,
        };
        const existing = assigneeMap.get(row.ticket_id as string) ?? [];
        assigneeMap.set(row.ticket_id as string, [...existing, info]);
      }
    }

    const rows: HelpdeskTicketListRow[] = tickets.map((t) => {
      const type = t.ticket_type as {
        id: string;
        name: string;
        color: string;
        icon: string;
      } | null;
      const creator = t.creator as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      return {
        id: t.id as string,
        org_id: t.org_id as string,
        ticket_number: t.ticket_number as string,
        title: t.title as string,
        status: t.status as TicketStatus,
        priority: t.priority as TicketPriority,
        ticket_type_id: (t.ticket_type_id as string | null) ?? null,
        ticket_type_name: type?.name ?? null,
        ticket_type_color: type?.color ?? null,
        ticket_type_icon: type?.icon ?? null,
        created_by: t.created_by as string,
        creator_name: creator
          ? displayName(creator.first_name, creator.last_name, creator.email)
          : null,
        creator_email: creator?.email ?? null,
        assignees: assigneeMap.get(t.id as string) ?? [],
        branch_id: (t.branch_id as string | null) ?? null,
        closed_at: (t.closed_at as string | null) ?? null,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string,
      };
    });

    return { success: true, data: { rows, totalCount: count ?? 0, page, pageSize } };
  }

  // ── Detail ─────────────────────────────────────────────────────────────────

  static async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    ticketId: string
  ): Promise<ServiceResult<HelpdeskTicketDetail>> {
    // Ticket + type + creator
    const { data: ticketRaw, error } = await supabase
      .from("helpdesk_tickets")
      .select(
        [
          "*,",
          "ticket_type:helpdesk_ticket_types!ticket_type_id(id,name,color,icon),",
          "creator:users!created_by(id,first_name,last_name,email)",
        ].join("")
      )
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) return { success: false, error: error.message };

    const ticket = ticketRaw as any;

    // Assignees
    const { data: assigneeRows } = await supabase
      .from("helpdesk_ticket_assignees")
      .select("user_id, role, status, user:users!user_id(id,first_name,last_name,email,avatar_url)")
      .eq("ticket_id", ticketId)
      .is("deleted_at", null);

    const assignees: HelpdeskAssigneeInfo[] = ((assigneeRows ?? []) as any[]).map((row) => {
      const u = row.user as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        avatar_url: string | null;
      } | null;
      return {
        user_id: row.user_id as string,
        role: row.role as AssigneeRole,
        status: row.status as AssigneeStatus,
        name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        email: u?.email ?? null,
        avatar_url: u?.avatar_url ?? null,
      };
    });

    // Comments
    const { data: commentRows } = await supabase
      .from("helpdesk_ticket_comments")
      .select("*, commenter:users!created_by(id,first_name,last_name,email,avatar_url)")
      .eq("ticket_id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const comments: HelpdeskTicketComment[] = (commentRows ?? []).map((row) => {
      const u = row.commenter as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        avatar_url: string | null;
      } | null;
      return {
        id: row.id as string,
        ticket_id: row.ticket_id as string,
        org_id: row.org_id as string,
        body: row.body as string,
        body_rich: row.body_rich ?? null,
        is_internal: row.is_internal as boolean,
        created_by: row.created_by as string,
        creator_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        creator_email: u?.email ?? null,
        creator_avatar_url: u?.avatar_url ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        deleted_at: (row.deleted_at as string | null) ?? null,
      };
    });

    // Activity (last 50)
    const { data: activityRows } = await supabase
      .from("helpdesk_ticket_activity")
      .select("*, actor:users!actor_id(id,first_name,last_name,email)")
      .eq("ticket_id", ticketId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    const activity: HelpdeskTicketActivity[] = (activityRows ?? []).map((row) => {
      const a = row.actor as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      return {
        id: row.id as string,
        ticket_id: row.ticket_id as string,
        org_id: row.org_id as string,
        actor_id: (row.actor_id as string | null) ?? null,
        actor_name: a ? displayName(a.first_name, a.last_name, a.email) : null,
        event_type: row.event_type as string,
        payload: (row.payload as Record<string, unknown> | null) ?? null,
        created_at: row.created_at as string,
      };
    });

    const type = ticket.ticket_type as {
      id: string;
      name: string;
      color: string;
      icon: string;
    } | null;
    const creator = ticket.creator as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;

    const detail: HelpdeskTicketDetail = {
      id: ticket.id as string,
      org_id: ticket.org_id as string,
      ticket_number: ticket.ticket_number as string,
      title: ticket.title as string,
      status: ticket.status as TicketStatus,
      priority: ticket.priority as TicketPriority,
      ticket_type_id: (ticket.ticket_type_id as string | null) ?? null,
      ticket_type_name: type?.name ?? null,
      ticket_type_color: type?.color ?? null,
      ticket_type_icon: type?.icon ?? null,
      created_by: ticket.created_by as string,
      creator_name: creator
        ? displayName(creator.first_name, creator.last_name, creator.email)
        : null,
      creator_email: creator?.email ?? null,
      assignees,
      branch_id: (ticket.branch_id as string | null) ?? null,
      closed_at: (ticket.closed_at as string | null) ?? null,
      created_at: ticket.created_at as string,
      updated_at: ticket.updated_at as string,
      description: (ticket.description as string | null) ?? null,
      description_plain: (ticket.description_plain as string | null) ?? null,
      description_rich: ticket.description_rich ?? null,
      closed_by: (ticket.closed_by as string | null) ?? null,
      resolved_at: (ticket.resolved_at as string | null) ?? null,
      due_at: (ticket.due_at as string | null) ?? null,
      comments,
      activity,
    };

    return { success: true, data: detail };
  }

  // ── Create (via atomic RPC) ────────────────────────────────────────────────

  static async createWithAssignees(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateTicketInput
  ): Promise<ServiceResult<{ id: string; ticket_number: string }>> {
    const { data, error } = await supabase.rpc("helpdesk_create_ticket", {
      p_org_id: orgId,
      p_title: input.title,
      p_description_plain: input.description_plain ?? null,
      p_description_rich: (input.description_rich as object | null) ?? null,
      p_status: input.status ?? "waiting_response",
      p_priority: input.priority ?? "medium",
      p_ticket_type_id: input.ticket_type_id ?? null,
      p_branch_id: input.branch_id ?? null,
      p_assignee_ids: input.assignee_user_ids,
      p_due_at: input.due_at ?? null,
    });

    if (error) return { success: false, error: error.message };
    const result = data as { id: string; ticket_number: string };
    return { success: true, data: result };
  }

  // ── Add Comment ────────────────────────────────────────────────────────────

  static async addComment(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: AddTicketCommentInput
  ): Promise<ServiceResult<HelpdeskTicketComment>> {
    const { data: commentRaw, error } = await supabase
      .from("helpdesk_ticket_comments")
      .insert({
        ticket_id: input.ticket_id,
        org_id: orgId,
        body: input.body,
        body_rich: (input.body_rich as object | null) ?? null,
        is_internal: input.is_internal ?? false,
        created_by: userId,
      })
      .select("*, commenter:users!created_by(id,first_name,last_name,email,avatar_url)")
      .single();

    if (error) return { success: false, error: error.message };

    const data = commentRaw as any;

    const u = data.commenter as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;

    // Log activity
    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: input.ticket_id,
      org_id: orgId,
      actor_id: userId,
      event_type: "comment_added",
      payload: { is_internal: input.is_internal ?? false },
    });

    return {
      success: true,
      data: {
        id: data.id as string,
        ticket_id: data.ticket_id as string,
        org_id: data.org_id as string,
        body: data.body as string,
        body_rich: data.body_rich ?? null,
        is_internal: data.is_internal as boolean,
        created_by: data.created_by as string,
        creator_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        creator_email: u?.email ?? null,
        creator_avatar_url: u?.avatar_url ?? null,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        deleted_at: (data.deleted_at as string | null) ?? null,
      },
    };
  }

  // ── Close Ticket ───────────────────────────────────────────────────────────

  static async closeTicket(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CloseTicketInput
  ): Promise<ServiceResult<HelpdeskTicketListRow>> {
    const now = new Date().toISOString();

    const { data: closeRaw, error } = await supabase
      .from("helpdesk_tickets")
      .update({
        status: "closed",
        closed_at: now,
        closed_by: userId,
        updated_at: now,
      })
      .eq("id", input.ticket_id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .select(
        [
          "id, org_id, ticket_number, title, status, priority,",
          "ticket_type_id, created_by, branch_id, closed_at, created_at, updated_at,",
          "ticket_type:helpdesk_ticket_types!ticket_type_id(id,name,color,icon),",
          "creator:users!created_by(id,first_name,last_name,email)",
        ].join("")
      )
      .single();

    if (error) return { success: false, error: error.message };

    const data = closeRaw as any;

    // Log activity
    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: input.ticket_id,
      org_id: orgId,
      actor_id: userId,
      event_type: "ticket_closed",
      payload: {
        resolution_note: input.resolution_note ?? null,
      },
    });

    const type = data.ticket_type as {
      id: string;
      name: string;
      color: string;
      icon: string;
    } | null;
    const creator = data.creator as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;

    return {
      success: true,
      data: {
        id: data.id as string,
        org_id: data.org_id as string,
        ticket_number: data.ticket_number as string,
        title: data.title as string,
        status: data.status as TicketStatus,
        priority: data.priority as TicketPriority,
        ticket_type_id: (data.ticket_type_id as string | null) ?? null,
        ticket_type_name: type?.name ?? null,
        ticket_type_color: type?.color ?? null,
        ticket_type_icon: type?.icon ?? null,
        created_by: data.created_by as string,
        creator_name: creator
          ? displayName(creator.first_name, creator.last_name, creator.email)
          : null,
        creator_email: creator?.email ?? null,
        assignees: [],
        branch_id: (data.branch_id as string | null) ?? null,
        closed_at: data.closed_at as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
      },
    };
  }

  // ── Legacy methods kept for backward compat ────────────────────────────────

  static async list(
    supabase: SupabaseClient,
    orgId: string,
    filters: TicketListFilters = {}
  ): Promise<ServiceResult<{ tickets: HelpdeskTicket[]; total: number }>> {
    let query = supabase
      .from("helpdesk_tickets")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.createdBy) query = query.eq("created_by", filters.createdBy);

    query = query.order("created_at", { ascending: false }).range(0, 49);

    const { data, error, count } = await query;
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: { tickets: (data ?? []) as HelpdeskTicket[], total: count ?? 0 },
    };
  }

  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<HelpdeskTicket>> {
    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskTicket };
  }

  static async update(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateTicketInput
  ): Promise<ServiceResult<HelpdeskTicket>> {
    const { id, ...rest } = input;
    const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

    if (rest.status === "resolved") update.resolved_at = new Date().toISOString();
    if (rest.status === "closed") update.closed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .update(update)
      .eq("id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as HelpdeskTicket };
  }

  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async listComments(
    supabase: SupabaseClient,
    orgId: string,
    ticketId: string
  ): Promise<ServiceResult<HelpdeskTicketComment[]>> {
    const { data, error } = await supabase
      .from("helpdesk_ticket_comments")
      .select("*, commenter:users!created_by(id,first_name,last_name,email,avatar_url)")
      .eq("ticket_id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: (data ?? []).map((row) => {
        const u = row.commenter as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          avatar_url: string | null;
        } | null;
        return {
          id: row.id as string,
          ticket_id: row.ticket_id as string,
          org_id: row.org_id as string,
          body: row.body as string,
          body_rich: row.body_rich ?? null,
          is_internal: row.is_internal as boolean,
          created_by: row.created_by as string,
          creator_name: u ? displayName(u.first_name, u.last_name, u.email) : null,
          creator_email: u?.email ?? null,
          creator_avatar_url: u?.avatar_url ?? null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          deleted_at: (row.deleted_at as string | null) ?? null,
        };
      }),
    };
  }
}
