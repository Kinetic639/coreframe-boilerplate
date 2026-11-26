import "server-only";
import { compactRichInput } from "@repo/rich-text/rich-text-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcceptTicketInput,
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
import { CommentsService, type AppComment } from "./comments.service";
import { getAuthUser } from "@/server/auth/get-auth-user";
import { getSignedAvatarUrls } from "@/server/storage/avatar-signed-url";

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
  profile_href: string | null;
}

export interface HelpdeskAcceptorInfo {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  profile_href: string;
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
  creator_avatar_url: string | null;
  creator_profile_href: string | null;
  assignees: HelpdeskAssigneeInfo[];
  requires_acceptance: boolean;
  accepted_by: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_avatar_url: string | null;
  branch_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Who took the ticket ("Biorę"); absent on rows read before the list RPC. */
  assigned_to?: string | null;
  /** Comments and files on the ticket; absent on rows read before the list RPC. */
  comment_count?: number | null;
  attachment_count?: number | null;
}

/** The QR code linked to a ticket. */
export interface HelpdeskTicketQr {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
}

export interface HelpdeskTicketDetail extends HelpdeskTicketListRow {
  description: string | null;
  description_plain: string | null;
  description_rich: unknown | null;
  closed_by: string | null;
  resolved_at: string | null;
  due_at: string | null;
  comments: AppComment[];
  /** All comments on the ticket and the cursor of the page after `comments`. */
  comments_total: number;
  comments_next_cursor: string | null;
  activity: HelpdeskTicketActivity[];
  acceptors: HelpdeskAcceptorInfo[];
  /** Whether the reader may handle tickets of this ticket's branch. */
  can_manage: boolean;
  qr_assignment: HelpdeskTicketQr | null;
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
  creator_profile_href: string | null;
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

export interface TicketCalendarRow {
  id: string;
  ticket_number: string;
  title: string;
  due_date: string | null;
  status: TicketStatus;
  priority: TicketPriority;
}

export interface TicketCalendarListParams {
  rangeStart: string;
  rangeEnd: string;
  rangeStartIso: string;
  rangeEndIso: string;
  includeUnscheduled: boolean;
  unscheduledLimit: number;
  unscheduledSearch?: string;
}

export interface TicketCalendarListResult {
  scheduled: TicketCalendarRow[];
  unscheduled: TicketCalendarRow[];
  hasMoreUnscheduled: boolean;
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

function memberProfileHref(userId: string): string {
  return `/dashboard/organization/users/members/${userId}`;
}

// One batch call to Supabase storage for all users — O(1) network round-trips regardless of count.
// Hard 2-second timeout: if storage is slow/unreachable we fall back to avatar_url (or null)
// rather than hanging the entire ticket response.
const AVATAR_SIGN_TIMEOUT_MS = 2_000;

async function batchSignAvatarUrls(
  entries: Array<{ userId: string; avatarPath: string }>
): Promise<Map<string, string>> {
  if (entries.length === 0) return new Map();

  // Signed in one storage call and reused across requests (see getSignedAvatarUrls).
  const sign = () => getSignedAvatarUrls(entries);

  const timeout = new Promise<Map<string, string>>((resolve) =>
    setTimeout(() => resolve(new Map()), AVATAR_SIGN_TIMEOUT_MS)
  );

  return Promise.race([sign(), timeout]);
}

function resolveAvatarUrl(
  userId: string,
  avatarUrl: string | null,
  avatarPath: string | null,
  signedUrls: Map<string, string>
): string | null {
  if (avatarPath?.startsWith(`${userId}/`)) {
    return signedUrls.get(userId) ?? avatarUrl;
  }
  return avatarUrl;
}

function mapAppCommentToHelpdeskComment(comment: AppComment): HelpdeskTicketComment {
  return {
    id: comment.id,
    ticket_id: comment.target_id,
    org_id: comment.org_id,
    body: comment.body_plain,
    body_rich: comment.body_rich,
    is_internal: comment.visibility === "internal",
    created_by: comment.created_by,
    creator_name: comment.author?.name ?? null,
    creator_email: comment.author?.email ?? null,
    creator_avatar_url: comment.author?.avatar_url ?? null,
    creator_profile_href: comment.author?.profile_href ?? null,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    deleted_at: comment.deleted_at,
  };
}

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

/**
 * Builds a safe `ilike` pattern for use inside a PostgREST `.or(...)` filter
 * string, e.g. `title.ilike.${ilikeOrValue(search)}`.
 *
 * Two independent escaping passes are needed because raw user input passes
 * through two different parsers before it reaches the database:
 *
 * 1. Postgres LIKE/ILIKE treats `%` and `_` as wildcards and `\` as its own
 *    escape character, so a user typing a literal `%`, `_`, or `\` would
 *    otherwise get broader-than-intended matches. Escaping them here (in
 *    the order backslash, then %, then _) makes them match literally.
 * 2. PostgREST's `or()`/`and()` logic-tree grammar uses unquoted `,` and
 *    `)` as structural delimiters between conditions — a value containing
 *    either one (unquoted) either breaks the whole filter (comma) or
 *    silently truncates it (closing paren). Wrapping the value in double
 *    quotes makes `,` and `)` literal again; inside quotes the only two
 *    characters that still need escaping are `\` and `"` themselves.
 */
function ilikeOrValue(raw: string): string {
  const likeSafe = raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const quoted = likeSafe.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${quoted}%"`;
}

// ---------------------------------------------------------------------------
// One-request reads and saves (migration 20261126090000_helpdesk_ticket_rpc)
// ---------------------------------------------------------------------------

/**
 * helpdesk_ticket_list(), helpdesk_ticket_view() and the handler saves do in
 * one request what took 2 to 9. They run as the caller (SECURITY INVOKER),
 * so RLS decides what they return exactly as for the separate requests.
 * Until the migration is applied a function is missing: that is remembered
 * for the process and the separate requests are used, as they are after any
 * other error of a read.
 */
const helpdeskRpcMissing: Record<HelpdeskRpcName, boolean> = {
  helpdesk_ticket_list: false,
  helpdesk_ticket_view: false,
  helpdesk_set_ticket_status: false,
  helpdesk_take_ticket: false,
  helpdesk_close_ticket: false,
  helpdesk_update_ticket: false,
};

export type HelpdeskRpcName =
  | "helpdesk_ticket_list"
  | "helpdesk_ticket_view"
  | "helpdesk_set_ticket_status"
  | "helpdesk_take_ticket"
  | "helpdesk_close_ticket"
  | "helpdesk_update_ticket";

type RpcOutcome = { data: any } | { error: string } | undefined;

/** The RPC's result, its error, or undefined when the function is not there. */
async function helpdeskRpc(
  supabase: SupabaseClient,
  name: HelpdeskRpcName,
  args: Record<string, unknown>
): Promise<RpcOutcome> {
  if (helpdeskRpcMissing[name]) return undefined;
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      // PGRST202: not in the schema cache; 42883: no such function.
      if (error.code === "PGRST202" || error.code === "42883") {
        helpdeskRpcMissing[name] = true;
        return undefined;
      }
      return { error: error.message };
    }
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

/** For tests: forget that an RPC was missing. */
export function resetHelpdeskRpcState(): void {
  for (const key of Object.keys(helpdeskRpcMissing) as HelpdeskRpcName[]) {
    helpdeskRpcMissing[key] = false;
  }
}

type RpcUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
} | null;

type RpcAssignee = { user_id: string; role: AssigneeRole; status: AssigneeStatus; user: RpcUser };

/** Users with a private avatar in rows from the RPCs, to sign in one call. */
function rpcAvatarEntries(users: RpcUser[]): Array<{ userId: string; avatarPath: string }> {
  const seen = new Set<string>();
  const entries: Array<{ userId: string; avatarPath: string }> = [];
  for (const u of users) {
    if (!u?.avatar_path?.startsWith(`${u.id}/`) || seen.has(u.id)) continue;
    seen.add(u.id);
    entries.push({ userId: u.id, avatarPath: u.avatar_path });
  }
  return entries;
}

function rpcRowUsers(raw: any): RpcUser[] {
  return [
    raw?.creator ?? null,
    raw?.acceptor ?? null,
    ...((raw?.assignees ?? []) as RpcAssignee[]).map((a) => a.user),
  ];
}

function rpcAvatar(u: RpcUser, signed: Map<string, string>): string | null {
  return u ? resolveAvatarUrl(u.id, u.avatar_url, u.avatar_path, signed) : null;
}

/** A helpdesk_ticket_row_json() result as a list row. */
export function ticketRowFromRpc(raw: any, signed: Map<string, string>): HelpdeskTicketListRow {
  const type = raw.ticket_type as { name: string; color: string; icon: string } | null;
  const creator = raw.creator as RpcUser;
  const acceptor = raw.acceptor as RpcUser;
  return {
    id: raw.id,
    org_id: raw.org_id,
    ticket_number: raw.ticket_number,
    title: raw.title,
    status: raw.status as TicketStatus,
    priority: raw.priority as TicketPriority,
    ticket_type_id: raw.ticket_type_id ?? null,
    ticket_type_name: type?.name ?? null,
    ticket_type_color: type?.color ?? null,
    ticket_type_icon: type?.icon ?? null,
    created_by: raw.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    creator_avatar_url: rpcAvatar(creator, signed),
    creator_profile_href: raw.created_by ? memberProfileHref(raw.created_by) : null,
    assignees: ((raw.assignees ?? []) as RpcAssignee[]).map((a) => ({
      user_id: a.user_id,
      role: a.role,
      status: a.status,
      name: a.user ? displayName(a.user.first_name, a.user.last_name, a.user.email) : null,
      email: a.user?.email ?? null,
      avatar_url: rpcAvatar(a.user, signed),
      profile_href: memberProfileHref(a.user_id),
    })),
    requires_acceptance: raw.requires_acceptance ?? false,
    accepted_by: raw.accepted_by ?? null,
    accepted_at: raw.accepted_at ?? null,
    accepted_by_name: acceptor
      ? displayName(acceptor.first_name, acceptor.last_name, acceptor.email)
      : null,
    accepted_by_avatar_url: rpcAvatar(acceptor, signed),
    branch_id: raw.branch_id ?? null,
    closed_at: raw.closed_at ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    assigned_to: raw.assigned_to ?? null,
    comment_count: typeof raw.comment_count === "number" ? raw.comment_count : null,
    attachment_count: typeof raw.attachment_count === "number" ? raw.attachment_count : null,
  };
}

/** A ticket row from a save RPC, avatars signed. */
async function savedTicketRow(raw: any): Promise<HelpdeskTicketListRow | null> {
  if (!raw?.id) return null;
  const signed = await batchSignAvatarUrls(rpcAvatarEntries(rpcRowUsers(raw)));
  return ticketRowFromRpc(raw, signed);
}

function asArray(value: unknown): string[] | null {
  if (value === null || value === undefined || value === "") return null;
  const list = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
  return list.length ? list : null;
}

/** The QR code row as qr_assignments selects it with its code. */
function qrFromRow(row: any): HelpdeskTicketQr | null {
  if (!row) return null;
  const code = (Array.isArray(row.qr_codes) ? row.qr_codes[0] : row.qr_codes) as {
    token: string;
    label: string | null;
    status: string;
  } | null;
  return {
    assignmentId: row.id as string,
    qrCodeId: row.qr_code_id as string,
    token: code?.token ?? "",
    label: code?.label ?? null,
    status: code?.status ?? "active",
  };
}

const COMMENTS_PAGE = 50;

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

    // One request when the database has helpdesk_ticket_list().
    const rpc = await helpdeskRpc(supabase, "helpdesk_ticket_list", {
      p_org_id: orgId,
      p_search: search || null,
      p_status: asArray(filters.status),
      p_priority: asArray(filters.priority),
      p_type_ids: asArray(filters.ticketTypeId),
      p_branch_ids: asArray(filters.branchId),
      p_created_by: asArray(filters.createdBy),
      p_assigned_to: asArray(filters.assignedTo),
      p_unassigned: filters.unassigned === true,
      p_created_from: (filters.createdAtFrom as string | null | undefined) ?? null,
      p_created_to: (filters.createdAtTo as string | null | undefined) ?? null,
      p_sort: sort?.field ?? "created_at",
      p_desc: sort?.direction !== "asc",
      p_limit: pageSize,
      p_offset: offset,
    });
    if (rpc && "data" in rpc && rpc.data) {
      const rawRows = (rpc.data.rows ?? []) as any[];
      const signed = await batchSignAvatarUrls(rpcAvatarEntries(rawRows.flatMap(rpcRowUsers)));
      return {
        success: true,
        data: {
          rows: rawRows.map((raw) => ticketRowFromRpc(raw, signed)),
          totalCount: Number(rpc.data.total ?? 0),
          page,
          pageSize,
        },
      };
    }

    // Resolve assignedTo filter: get ticket IDs where any of the selected users are assignees
    let assignedToTicketIds: string[] | null = null;
    if (filters.assignedTo) {
      const userIds = Array.isArray(filters.assignedTo)
        ? (filters.assignedTo as string[])
        : [filters.assignedTo as string];
      const { data: assigneeRows } = await supabase
        .from("helpdesk_ticket_assignees")
        .select("ticket_id")
        .eq("org_id", orgId)
        .in("user_id", userIds)
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
          "requires_acceptance, accepted_by, accepted_at,",
          "ticket_type:helpdesk_ticket_types!ticket_type_id(id,name,color,icon),",
          "creator:users!created_by(id,first_name,last_name,email,avatar_url,avatar_path),",
          "acceptor:users!accepted_by(id,first_name,last_name,email,avatar_url,avatar_path)",
        ].join(""),
        { count: "exact" }
      )
      .eq("org_id", orgId)
      .is("deleted_at", null);

    // Filters
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status as string[]);
      } else {
        query = query.eq("status", filters.status as string);
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in("priority", filters.priority as string[]);
      } else {
        query = query.eq("priority", filters.priority as string);
      }
    }
    if (filters.ticketTypeId) {
      if (Array.isArray(filters.ticketTypeId)) {
        query = query.in("ticket_type_id", filters.ticketTypeId as string[]);
      } else {
        query = query.eq("ticket_type_id", filters.ticketTypeId as string);
      }
    }
    // Handler queue "Nieprzypisane": nobody has taken the ticket yet.
    if (filters.unassigned === true) {
      query = query.is("assigned_to", null);
    }
    if (filters.branchId) {
      if (Array.isArray(filters.branchId)) {
        query = query.in("branch_id", filters.branchId as string[]);
      } else {
        query = query.eq("branch_id", filters.branchId as string);
      }
    }
    if (filters.createdBy) {
      if (Array.isArray(filters.createdBy)) {
        query = query.in("created_by", filters.createdBy as string[]);
      } else {
        query = query.eq("created_by", filters.createdBy as string);
      }
    }
    if (filters.createdAtFrom) query = query.gte("created_at", filters.createdAtFrom as string);
    if (filters.createdAtTo) query = query.lte("created_at", filters.createdAtTo as string);
    if (assignedToTicketIds) query = query.in("id", assignedToTicketIds);
    if (search) {
      const pattern = ilikeOrValue(search);
      query = query.or(`title.ilike.${pattern},ticket_number.ilike.${pattern}`);
    }

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
          "ticket_id, user_id, role, status, user:users!user_id(id,first_name,last_name,email,avatar_url,avatar_path)"
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
          avatar_path: string | null;
        } | null;
        const info: HelpdeskAssigneeInfo = {
          user_id: row.user_id as string,
          role: row.role as AssigneeRole,
          status: row.status as AssigneeStatus,
          name: u ? displayName(u.first_name, u.last_name, u.email) : null,
          email: u?.email ?? null,
          avatar_url: u?.avatar_url ?? null,
          _avatar_path: u?.avatar_path ?? null,
          profile_href: null,
        } as HelpdeskAssigneeInfo & { _avatar_path: string | null };
        const tid = row.ticket_id as string;
        const bucket = assigneeMap.get(tid);
        if (bucket) bucket.push(info);
        else assigneeMap.set(tid, [info]);
      }
    }

    // Collect all users with a private avatar_path for batch signing
    const avatarEntries: Array<{ userId: string; avatarPath: string }> = [];
    tickets.forEach((t) => {
      const creator = t.creator as { id: string; avatar_path: string | null } | null;
      if (creator?.avatar_path?.startsWith(`${creator.id}/`)) {
        avatarEntries.push({ userId: creator.id, avatarPath: creator.avatar_path });
      }
      const acceptor = t.acceptor as { id: string; avatar_path: string | null } | null;
      if (acceptor?.avatar_path?.startsWith(`${acceptor.id}/`)) {
        avatarEntries.push({ userId: acceptor.id, avatarPath: acceptor.avatar_path });
      }
    });
    assigneeMap.forEach((infos) => {
      infos.forEach((a) => {
        const ap = (a as HelpdeskAssigneeInfo & { _avatar_path?: string | null })._avatar_path;
        if (ap?.startsWith(`${a.user_id}/`)) {
          avatarEntries.push({ userId: a.user_id, avatarPath: ap });
        }
      });
    });
    const signedAvatarUrls = await batchSignAvatarUrls(avatarEntries);

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
        avatar_url: string | null;
        avatar_path: string | null;
      } | null;
      const acceptorUser = t.acceptor as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        avatar_url: string | null;
        avatar_path: string | null;
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
        creator_avatar_url: creator
          ? resolveAvatarUrl(creator.id, creator.avatar_url, creator.avatar_path, signedAvatarUrls)
          : null,
        creator_profile_href: t.created_by ? memberProfileHref(t.created_by as string) : null,
        assignees: (assigneeMap.get(t.id as string) ?? []).map((a) => ({
          ...a,
          avatar_url: resolveAvatarUrl(
            a.user_id,
            a.avatar_url ?? null,
            (a as any)._avatar_path ?? null,
            signedAvatarUrls
          ),
          profile_href: memberProfileHref(a.user_id),
        })),
        requires_acceptance: (t.requires_acceptance as boolean) ?? false,
        accepted_by: (t.accepted_by as string | null) ?? null,
        accepted_at: (t.accepted_at as string | null) ?? null,
        accepted_by_name: acceptorUser
          ? displayName(acceptorUser.first_name, acceptorUser.last_name, acceptorUser.email)
          : null,
        accepted_by_avatar_url: acceptorUser
          ? resolveAvatarUrl(
              acceptorUser.id,
              acceptorUser.avatar_url,
              acceptorUser.avatar_path,
              signedAvatarUrls
            )
          : null,
        branch_id: (t.branch_id as string | null) ?? null,
        closed_at: (t.closed_at as string | null) ?? null,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string,
      };
    });

    return { success: true, data: { rows, totalCount: count ?? 0, page, pageSize } };
  }

  // ── Detail ─────────────────────────────────────────────────────────────────

  /** The number (`HD-000001`) of a ticket given by its internal id; null when not visible. */
  static async getTicketNumber(
    supabase: SupabaseClient,
    orgId: string,
    ticketId: string
  ): Promise<string | null> {
    const { data } = await supabase
      .from("helpdesk_tickets")
      .select("ticket_number")
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    return (data as { ticket_number: string | null } | null)?.ticket_number ?? null;
  }

  static async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    ticketNumber: string
  ): Promise<ServiceResult<HelpdeskTicketDetail | null>> {
    // One request when the database has helpdesk_ticket_view().
    const rpc = await helpdeskRpc(supabase, "helpdesk_ticket_view", {
      p_org_id: orgId,
      p_ticket_number: ticketNumber,
      p_comment_limit: COMMENTS_PAGE,
    });
    if (rpc && "data" in rpc) {
      if (!rpc.data) return { success: true, data: null };
      return HelpdeskTicketsService.detailFromView(supabase, orgId, rpc.data);
    }
    return HelpdeskTicketsService.getDetailSeparately(supabase, orgId, ticketNumber);
  }

  /** A helpdesk_ticket_view() result as getDetail returns it. */
  private static async detailFromView(
    supabase: SupabaseClient,
    orgId: string,
    view: any
  ): Promise<ServiceResult<HelpdeskTicketDetail>> {
    const raw = view.ticket;
    const acceptorRows = (view.acceptors ?? []) as Array<{ user_id: string; user: RpcUser }>;
    const users = [...rpcRowUsers(raw), ...acceptorRows.map((a) => a.user)];
    // Avatars and comment authors are independent: one wave.
    const [signed, comments] = await Promise.all([
      batchSignAvatarUrls(rpcAvatarEntries(users)),
      CommentsService.pageFromRows(
        supabase,
        orgId,
        (view.comments ?? []) as unknown[],
        COMMENTS_PAGE,
        Number(raw.comment_count ?? 0)
      ),
    ]);
    if (!comments.success) return comments as { success: false; error: string };

    const row = ticketRowFromRpc(raw, signed);
    const activity: HelpdeskTicketActivity[] = ((view.activity ?? []) as any[]).map((a) => ({
      id: a.id,
      ticket_id: a.ticket_id,
      org_id: a.org_id,
      actor_id: a.actor_id ?? null,
      actor_name: a.actor
        ? displayName(a.actor.first_name, a.actor.last_name, a.actor.email)
        : null,
      event_type: a.event_type,
      payload: a.payload ?? null,
      created_at: a.created_at,
    }));
    return {
      success: true,
      data: {
        ...row,
        description: raw.description ?? null,
        description_plain: raw.description_plain ?? null,
        description_rich: raw.description_rich ?? null,
        closed_by: raw.closed_by ?? null,
        resolved_at: raw.resolved_at ?? null,
        due_at: raw.due_at ?? null,
        comments: comments.data.rows,
        comments_total: comments.data.totalCount,
        comments_next_cursor: comments.data.nextCursor,
        activity,
        acceptors: acceptorRows.map(({ user_id, user }) => ({
          user_id,
          name: user ? displayName(user.first_name, user.last_name, user.email) : null,
          email: user?.email ?? null,
          avatar_url: rpcAvatar(user, signed),
          profile_href: memberProfileHref(user_id),
        })),
        can_manage: view.can_manage === true,
        qr_assignment: qrFromRow(view.qr),
      },
    };
  }

  /** getDetail without helpdesk_ticket_view(): the separate requests. */
  private static async getDetailSeparately(
    supabase: SupabaseClient,
    orgId: string,
    ticketNumber: string
  ): Promise<ServiceResult<HelpdeskTicketDetail | null>> {
    // Ticket + type + creator — look up by human-readable ticket_number
    const { data: ticketRaw, error } = await supabase
      .from("helpdesk_tickets")
      .select(
        [
          "*,",
          "ticket_type:helpdesk_ticket_types!ticket_type_id(id,name,color,icon),",
          "creator:users!created_by(id,first_name,last_name,email,avatar_url,avatar_path),",
          "acceptor:users!accepted_by(id,first_name,last_name,email,avatar_url,avatar_path)",
        ].join("")
      )
      .eq("ticket_number", ticketNumber)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!ticketRaw) return { success: true, data: null };

    const ticket = ticketRaw as any;
    // Sub-queries join on the internal UUID FK, not the human-readable ticket_number
    const ticketId = ticket.id as string;

    // Assignees, comments, activity, acceptors — all independent, fetch in parallel
    const {
      data: { user: authUser },
    } = await getAuthUser();
    const [
      { data: assigneeRows },
      commentsResult,
      { data: activityRows },
      { data: acceptorRows },
      { data: qrRow },
      canManage,
    ] = await Promise.all([
      supabase
        .from("helpdesk_ticket_assignees")
        .select(
          "user_id, role, status, user:users!user_id(id,first_name,last_name,email,avatar_url,avatar_path)"
        )
        .eq("ticket_id", ticketId)
        .is("deleted_at", null),
      CommentsService.listForTarget(supabase, orgId, {
        targetType: "helpdesk.ticket",
        targetId: ticketId,
        pageSize: COMMENTS_PAGE,
      }),
      supabase
        .from("helpdesk_ticket_activity")
        .select("*, actor:users!actor_id(id,first_name,last_name,email)")
        .eq("ticket_id", ticketId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("helpdesk_ticket_acceptors")
        .select("user_id, user:users!user_id(id,first_name,last_name,email,avatar_url,avatar_path)")
        .eq("ticket_id", ticketId),
      supabase
        .from("qr_assignments")
        .select("id, qr_code_id, qr_codes!qr_assignments_qr_code_id_fkey(token, label, status)")
        .eq("target_type", "helpdesk.ticket")
        .eq("target_id", ticketId)
        .is("revoked_at", null)
        .maybeSingle(),
      authUser
        ? HelpdeskTicketsService.canManageBranch(
            supabase,
            orgId,
            authUser.id,
            (ticket.branch_id as string | null) ?? null
          )
        : Promise.resolve(false),
    ]);

    if (!commentsResult.success) return commentsResult as { success: false; error: string };

    const assignees = ((assigneeRows ?? []) as any[]).map((row) => {
      const u = row.user as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        avatar_url: string | null;
        avatar_path: string | null;
      } | null;
      return {
        user_id: row.user_id as string,
        role: row.role as AssigneeRole,
        status: row.status as AssigneeStatus,
        name: u ? displayName(u.first_name, u.last_name, u.email) : null,
        email: u?.email ?? null,
        avatar_url: u?.avatar_url ?? null,
        _avatar_path: u?.avatar_path ?? null,
        profile_href: null,
      };
    });

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
      avatar_url: string | null;
      avatar_path: string | null;
    } | null;

    // Batch-sign all private avatar paths in one storage API call
    type RawAssignee = HelpdeskAssigneeInfo & { _avatar_path?: string | null };
    const detailAvatarEntries: Array<{ userId: string; avatarPath: string }> = [];
    if (creator?.avatar_path?.startsWith(`${creator.id}/`)) {
      detailAvatarEntries.push({ userId: creator.id, avatarPath: creator.avatar_path });
    }
    const acceptorUser = ticket.acceptor as RpcUser;
    if (acceptorUser?.avatar_path?.startsWith(`${acceptorUser.id}/`)) {
      detailAvatarEntries.push({ userId: acceptorUser.id, avatarPath: acceptorUser.avatar_path });
    }
    assignees.forEach((a) => {
      const ap = (a as RawAssignee)._avatar_path;
      if (ap?.startsWith(`${a.user_id}/`)) {
        detailAvatarEntries.push({ userId: a.user_id, avatarPath: ap });
      }
    });
    type RawAcceptorUser = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      avatar_url: string | null;
      avatar_path: string | null;
    };
    const rawAcceptors = ((acceptorRows ?? []) as any[]).map((row) => ({
      user_id: row.user_id as string,
      u: row.user as RawAcceptorUser | null,
    }));
    rawAcceptors.forEach(({ u }) => {
      if (u?.avatar_path?.startsWith(`${u.id}/`)) {
        detailAvatarEntries.push({ userId: u.id, avatarPath: u.avatar_path });
      }
    });
    const detailSignedUrls = await batchSignAvatarUrls(detailAvatarEntries);

    const acceptors: HelpdeskAcceptorInfo[] = rawAcceptors.map(({ user_id, u }) => ({
      user_id,
      name: u ? displayName(u.first_name, u.last_name, u.email) : null,
      email: u?.email ?? null,
      avatar_url: u ? resolveAvatarUrl(u.id, u.avatar_url, u.avatar_path, detailSignedUrls) : null,
      profile_href: memberProfileHref(user_id),
    }));

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
      creator_avatar_url: creator
        ? resolveAvatarUrl(creator.id, creator.avatar_url, creator.avatar_path, detailSignedUrls)
        : null,
      creator_profile_href: ticket.created_by
        ? memberProfileHref(ticket.created_by as string)
        : null,
      assignees: assignees.map((a) => ({
        ...a,
        avatar_url: resolveAvatarUrl(
          a.user_id,
          a.avatar_url ?? null,
          (a as RawAssignee)._avatar_path ?? null,
          detailSignedUrls
        ),
        profile_href: memberProfileHref(a.user_id),
      })),
      requires_acceptance: (ticket.requires_acceptance as boolean) ?? false,
      accepted_by: (ticket.accepted_by as string | null) ?? null,
      accepted_at: (ticket.accepted_at as string | null) ?? null,
      accepted_by_name: acceptorUser
        ? displayName(acceptorUser.first_name, acceptorUser.last_name, acceptorUser.email)
        : null,
      accepted_by_avatar_url: rpcAvatar(acceptorUser, detailSignedUrls),
      branch_id: (ticket.branch_id as string | null) ?? null,
      closed_at: (ticket.closed_at as string | null) ?? null,
      created_at: ticket.created_at as string,
      updated_at: ticket.updated_at as string,
      assigned_to: (ticket.assigned_to as string | null) ?? null,
      description: (ticket.description as string | null) ?? null,
      description_plain: (ticket.description_plain as string | null) ?? null,
      description_rich: ticket.description_rich ?? null,
      closed_by: (ticket.closed_by as string | null) ?? null,
      resolved_at: (ticket.resolved_at as string | null) ?? null,
      due_at: (ticket.due_at as string | null) ?? null,
      comments: commentsResult.data.rows,
      comments_total: commentsResult.data.totalCount,
      comments_next_cursor: commentsResult.data.nextCursor,
      activity,
      acceptors,
      can_manage: canManage,
      qr_assignment: qrFromRow(qrRow),
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
      p_description_rich: compactRichInput((input.description_rich as object | null) ?? null),
      p_status: input.status ?? "waiting_response",
      p_priority: input.priority ?? "medium",
      p_ticket_type_id: input.ticket_type_id ?? null,
      p_branch_id: input.branch_id ?? null,
      p_assignee_ids: input.assignee_user_ids,
      p_due_at: input.due_at ?? null,
      p_requires_acceptance: input.requires_acceptance ?? false,
      p_acceptor_ids: input.acceptor_user_ids ?? [],
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
    const result = await CommentsService.add(supabase, orgId, userId, {
      targetType: "helpdesk.ticket",
      targetId: input.ticket_id,
      bodyPlain: input.body,
      bodyRich: input.body_rich,
      visibility: input.is_internal ? "internal" : "default",
    });

    if (!result.success) return result as { success: false; error: string };

    return { success: true, data: mapAppCommentToHelpdeskComment(result.data) };
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
        creator_avatar_url: null,
        creator_profile_href: null,
        assignees: [],
        requires_acceptance: false,
        accepted_by: null,
        accepted_at: null,
        accepted_by_name: null,
        accepted_by_avatar_url: null,
        branch_id: (data.branch_id as string | null) ?? null,
        closed_at: data.closed_at as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
      },
    };
  }

  // ── Handler saves in one request ──────────────────────────────────────────

  /**
   * A handler save (status, take, close) in one request that also writes the
   * activity entry, returning the ticket as a list row for the client's cache.
   * Undefined when the function is not in the database yet: the caller runs
   * the separate steps below.
   */
  static async saveViaRpc(
    supabase: SupabaseClient,
    name: Exclude<HelpdeskRpcName, "helpdesk_ticket_list" | "helpdesk_ticket_view">,
    args: Record<string, unknown>
  ): Promise<ServiceResult<HelpdeskTicketListRow | null> | undefined> {
    const rpc = await helpdeskRpc(supabase, name, args);
    if (!rpc) return undefined;
    if ("error" in rpc) return { success: false, error: rpc.error };
    return { success: true, data: await savedTicketRow(rpc.data) };
  }

  /** The fields of a card edit that are set, in the shape helpdesk_update_ticket takes. */
  static ticketFieldChanges(fields: {
    title?: string;
    description_plain?: string | null;
    description_rich?: unknown;
    priority?: string;
    ticket_type_id?: string | null;
  }): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    if (fields.title !== undefined) changes.title = fields.title.trim();
    if (fields.priority !== undefined) changes.priority = fields.priority;
    if (fields.ticket_type_id !== undefined) changes.ticket_type_id = fields.ticket_type_id;
    if (fields.description_plain !== undefined || fields.description_rich !== undefined) {
      changes.description_plain = fields.description_plain ?? null;
      changes.description_rich = compactRichInput(
        (fields.description_rich as object | null | undefined) ?? null
      );
    }
    return changes;
  }

  /** A card edit without helpdesk_update_ticket (RLS decides who may update). */
  static async updateFields(
    supabase: SupabaseClient,
    orgId: string,
    ticketId: string,
    changes: Record<string, unknown>
  ): Promise<ServiceResult<void>> {
    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .not("status", "in", "(closed,cancelled)")
      .select("id");
    if (error) return { success: false, error: error.message };
    if (!data?.length) return { success: false, error: "Insufficient permissions" };
    return { success: true, data: undefined };
  }

  // ── Handling (Ambra Zgłoszenia, step 5b) ─────────────────────────────────────

  /**
   * Whether the user may handle tickets of a branch: helpdesk.tickets.manage granted on the
   * organization or on that branch (mirrors has_branch_permission, which RLS enforces).
   */
  static async canManageBranch(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    branchId: string | null
  ): Promise<boolean> {
    let q = supabase
      .from("user_effective_permissions")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .eq("permission_slug_exact", "helpdesk.tickets.manage")
      .limit(1);
    q = branchId ? q.or(`branch_id.is.null,branch_id.eq.${branchId}`) : q.is("branch_id", null);
    const { data } = await q;
    return (data ?? []).length > 0;
  }

  /** Handler changes the status; logged so the requester sees it in the portal thread. */
  static async setStatus(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    ticketId: string,
    status: TicketStatus
  ): Promise<ServiceResult<{ id: string; status: TicketStatus }>> {
    const { data: current, error: readError } = await supabase
      .from("helpdesk_tickets")
      .select("id, status")
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) return { success: false, error: readError.message };
    if (!current) return { success: false, error: "Ticket not found" };
    if (current.status === status) return { success: true, data: { id: ticketId, status } };

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status === "resolved") patch.resolved_at = now;
    if (status === "closed" || status === "cancelled") {
      patch.closed_at = now;
      patch.closed_by = userId;
    } else {
      patch.closed_at = null;
      patch.closed_by = null;
    }

    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .update(patch)
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Insufficient permissions" };

    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: ticketId,
      org_id: orgId,
      actor_id: userId,
      event_type: "status_changed",
      payload: { from: current.status, to: status },
    });
    return { success: true, data: { id: ticketId, status } };
  }

  /** "Biorę": assign the ticket to me and move it to in_progress. */
  static async takeTicket(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    ticketId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const { data: current, error: readError } = await supabase
      .from("helpdesk_tickets")
      .select("id, status")
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) return { success: false, error: readError.message };
    if (!current) return { success: false, error: "Ticket not found" };
    if (current.status === "closed" || current.status === "cancelled") {
      return { success: false, error: "Ticket is closed" };
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .update({ assigned_to: userId, status: "in_progress", updated_at: now })
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Insufficient permissions" };

    await supabase.from("helpdesk_ticket_assignees").upsert(
      {
        org_id: orgId,
        ticket_id: ticketId,
        user_id: userId,
        role: "responder",
        status: "assigned",
        assigned_by: userId,
        deleted_at: null,
      },
      { onConflict: "ticket_id,user_id" }
    );

    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: ticketId,
      org_id: orgId,
      actor_id: userId,
      event_type: "ticket_taken",
      payload: { from: current.status, to: "in_progress" },
    });
    return { success: true, data: { id: ticketId } };
  }

  // ── Accept Ticket ──────────────────────────────────────────────────────────

  static async acceptTicket(
    supabase: SupabaseClient,
    _orgId: string,
    _userId: string,
    input: AcceptTicketInput
  ): Promise<
    ServiceResult<{ id: string; ticket_number: string; accepted_by: string; accepted_at: string }>
  > {
    const { data, error } = await supabase.rpc("helpdesk_accept_ticket", {
      p_ticket_id: input.ticket_id,
    });

    if (error) return { success: false, error: error.message };

    const result = data as {
      id: string;
      ticket_number: string;
      accepted_by: string;
      accepted_at: string;
    };

    return { success: true, data: result };
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
    const result = await CommentsService.listForTarget(supabase, orgId, {
      targetType: "helpdesk.ticket",
      targetId: ticketId,
      pageSize: 100,
    });

    if (!result.success) return result as { success: false; error: string };

    return {
      success: true,
      data: result.data.rows.map(mapAppCommentToHelpdeskComment),
    };
  }

  // ── Calendar ────────────────────────────────────────────────────────────

  static async listForCalendar(
    supabase: SupabaseClient,
    orgId: string,
    params: TicketCalendarListParams
  ): Promise<ServiceResult<TicketCalendarListResult>> {
    const { data: scheduledData, error: scheduledError } = await supabase
      .from("helpdesk_tickets")
      .select("id, ticket_number, title, due_date, status, priority")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .not("due_date", "is", null)
      .gte("due_date", params.rangeStart)
      .lte("due_date", params.rangeEnd)
      .order("due_date", { ascending: true });

    if (scheduledError) return { success: false, error: scheduledError.message };

    let unscheduled: TicketCalendarRow[] = [];
    let hasMoreUnscheduled = false;
    if (params.includeUnscheduled && params.unscheduledLimit > 0) {
      let unscheduledQuery = supabase
        .from("helpdesk_tickets")
        .select("id, ticket_number, title, due_date, status, priority")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .is("due_date", null)
        .neq("status", "cancelled")
        .neq("status", "closed")
        .neq("status", "resolved")
        .order("updated_at", { ascending: false })
        .limit(params.unscheduledLimit + 1);

      if (params.unscheduledSearch) {
        const pattern = ilikeOrValue(params.unscheduledSearch);
        unscheduledQuery = unscheduledQuery.or(
          `title.ilike.${pattern},ticket_number.ilike.${pattern}`
        );
      }

      const { data: unscheduledData, error: unscheduledError } = await unscheduledQuery;
      if (unscheduledError) return { success: false, error: unscheduledError.message };
      const rows = (unscheduledData ?? []) as TicketCalendarRow[];
      hasMoreUnscheduled = rows.length > params.unscheduledLimit;
      unscheduled = rows.slice(0, params.unscheduledLimit);
    }

    return {
      success: true,
      data: {
        scheduled: (scheduledData ?? []) as TicketCalendarRow[],
        unscheduled,
        hasMoreUnscheduled,
      },
    };
  }

  static async updateDueAt(
    supabase: SupabaseClient,
    orgId: string,
    ticketId: string,
    dueAt: string | null,
    dueDate?: string | null
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ due_at: dueAt, due_date: dueDate ?? null, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
