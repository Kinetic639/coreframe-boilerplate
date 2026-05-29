"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  HELPDESK_READ,
  HELPDESK_TICKETS_READ,
  HELPDESK_TICKETS_CREATE,
  HELPDESK_TICKETS_MANAGE,
  HELPDESK_TICKET_TYPES_MANAGE,
} from "@/lib/constants/permissions";
import {
  HelpdeskTicketTypesService,
  type HelpdeskTicketType,
} from "@/server/services/helpdesk-ticket-types.service";
import {
  HelpdeskTicketsService,
  type HelpdeskTicketListRow,
  type HelpdeskTicketDetail,
  type HelpdeskTicketComment,
} from "@/server/services/helpdesk-tickets.service";
import {
  createTicketTypeSchema,
  updateTicketTypeSchema,
  createTicketSchema,
  acceptTicketSchema,
  closeTicketSchema,
  addTicketCommentSchema,
  type AcceptTicketInput,
  type CreateTicketTypeInput,
  type UpdateTicketTypeInput,
  type CreateTicketInput,
  type CloseTicketInput,
  type AddTicketCommentInput,
} from "@/lib/validations/helpdesk";
import { OrgMembersService, type OrgMember } from "@/server/services/organization.service";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthedContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, context, userId: user.id, orgId: context.app.activeOrgId };
}

// ---------------------------------------------------------------------------
// Ticket Types
// ---------------------------------------------------------------------------

export async function listTicketTypesAction(
  includeInactive = false
): Promise<ActionResult<HelpdeskTicketType[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_READ))
      return { success: false, error: "Insufficient permissions" };
    return HelpdeskTicketTypesService.list(ctx.supabase, ctx.orgId, includeInactive);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function getTicketTypeDefaultRespondersAction(ticketTypeId: string): Promise<
  ActionResult<
    Array<{
      id: string;
      org_id: string;
      ticket_type_id: string;
      responder_user_id: string;
      responder_name: string | null;
      responder_email: string | null;
      created_at: string;
    }>
  >
> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_READ))
      return { success: false, error: "Insufficient permissions" };
    return HelpdeskTicketTypesService.getDefaultResponders(ctx.supabase, ctx.orgId, ticketTypeId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function createTicketTypeAction(
  input: CreateTicketTypeInput
): Promise<ActionResult<HelpdeskTicketType>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE))
      return { success: false, error: "Insufficient permissions" };
    const parsed = createTicketTypeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    return HelpdeskTicketTypesService.create(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateTicketTypeAction(
  input: UpdateTicketTypeInput
): Promise<ActionResult<HelpdeskTicketType>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE))
      return { success: false, error: "Insufficient permissions" };
    const parsed = updateTicketTypeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    return HelpdeskTicketTypesService.update(ctx.supabase, ctx.orgId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteTicketTypeAction(id: string): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE))
      return { success: false, error: "Insufficient permissions" };
    return HelpdeskTicketTypesService.softDelete(ctx.supabase, ctx.orgId, id);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Tickets — DataView
// ---------------------------------------------------------------------------

export async function listTicketsForDataViewAction(
  params: DataViewListParams,
  orgId: string
): Promise<ActionResult<PaginatedResult<HelpdeskTicketListRow>>> {
  try {
    // Lightweight auth: RLS enforces is_org_member(org_id) + has_permission('helpdesk.tickets.read')
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };
    return HelpdeskTicketsService.listForDataView(supabase, orgId, params);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Tickets — CRUD
// ---------------------------------------------------------------------------

export async function getTicketDetailAction(
  ticketId: string,
  orgId: string
): Promise<ActionResult<HelpdeskTicketDetail>> {
  try {
    // Lightweight auth: RLS enforces is_org_member(org_id) + has_permission('helpdesk.tickets.read')
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };
    return HelpdeskTicketsService.getDetail(supabase, orgId, ticketId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function createTicketAction(
  input: CreateTicketInput
): Promise<ActionResult<{ id: string; ticket_number: string }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_CREATE))
      return { success: false, error: "Insufficient permissions" };
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };
    return HelpdeskTicketsService.createWithAssignees(ctx.supabase, ctx.orgId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function closeTicketAction(
  input: CloseTicketInput
): Promise<ActionResult<HelpdeskTicketListRow>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ))
      return { success: false, error: "Insufficient permissions" };
    const parsed = closeTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    // Only creator or manager can close
    const isManager = checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE);
    if (!isManager) {
      // Verify caller created this ticket
      const detailResult = await HelpdeskTicketsService.getById(
        ctx.supabase,
        ctx.orgId,
        parsed.data.ticket_id
      );
      if (!detailResult.success) return { success: false, error: "Ticket not found" };
      if (detailResult.data.created_by !== ctx.userId)
        return { success: false, error: "Only the ticket creator or a manager can close tickets" };
    }

    return HelpdeskTicketsService.closeTicket(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addTicketCommentAction(
  input: AddTicketCommentInput
): Promise<ActionResult<HelpdeskTicketComment>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ))
      return { success: false, error: "Insufficient permissions" };
    const parsed = addTicketCommentSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };
    return HelpdeskTicketsService.addComment(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Org Members — for ticket assignment selector
// Uses HELPDESK_TICKETS_CREATE (not MEMBERS_READ) so ticket creators
// can fetch the member list without org management access.
// ---------------------------------------------------------------------------

export async function listOrgMembersForTicketAssignmentAction(): Promise<
  ActionResult<
    Array<{
      user_id: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    }>
  >
> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_CREATE))
      return { success: false, error: "Insufficient permissions" };

    const result = await OrgMembersService.listMembers(ctx.supabase, ctx.orgId);
    if (!result.success)
      return { success: false, error: (result as { success: false; error: string }).error };

    const mapped = (result.data as OrgMember[]).map((m) => {
      const fullName = [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null;
      return {
        user_id: m.user_id,
        name: fullName,
        email: m.user_email,
        avatar_url: m.user_avatar_url,
      };
    });

    return { success: true, data: mapped };
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Legacy action aliases (keep backward compat with any existing callers)
// ---------------------------------------------------------------------------

export async function listTicketsAction(
  filters: Record<string, unknown> = {}
): Promise<ActionResult<{ tickets: unknown[]; total: number }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ))
      return { success: false, error: "Insufficient permissions" };
    return HelpdeskTicketsService.list(ctx.supabase, ctx.orgId, filters);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function acceptTicketAction(
  input: AcceptTicketInput
): Promise<
  ActionResult<{ id: string; ticket_number: string; accepted_by: string; accepted_at: string }>
> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ))
      return { success: false, error: "Insufficient permissions" };
    const parsed = acceptTicketSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };
    return HelpdeskTicketsService.acceptTicket(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function listCommentsAction(
  ticketId: string
): Promise<ActionResult<HelpdeskTicketComment[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ))
      return { success: false, error: "Insufficient permissions" };
    return HelpdeskTicketsService.listComments(ctx.supabase, ctx.orgId, ticketId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
