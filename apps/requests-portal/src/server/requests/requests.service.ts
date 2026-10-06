import type { PortalSupabase } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import {
  requestState,
  type OrderRef,
  type PersonRef,
  type RequestDetail,
  type RequestEvent,
  type RequestFilter,
  type RequestListItem,
  type ServiceResult,
  type TicketStatus,
  type TicketTypeRef,
} from "./types";

export const TICKET_TARGET = "helpdesk.ticket";
export const PAGE_SIZE = 25;

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
} | null;

export function toPerson(u: UserRow): PersonRef | null {
  if (!u) return null;
  const name = [u.first_name?.trim(), u.last_name?.trim()].filter(Boolean).join(" ");
  const initials = `${u.first_name?.trim()[0] ?? ""}${u.last_name?.trim()[0] ?? ""}`.toUpperCase();
  return {
    id: u.id,
    name: name || u.email || "—",
    initials: initials || (u.email ?? "?").slice(0, 2).toUpperCase(),
    avatarUrl: u.avatar_url,
  };
}

const USER_COLS = "id, first_name, last_name, email, avatar_url";
const LIST_COLS = [
  "id, ticket_number, title, status, requires_acceptance, accepted_at, branch_id,",
  "created_by, created_at, updated_at,",
  "ticket_type:helpdesk_ticket_types!ticket_type_id(id, name, color, icon),",
  `creator:users!created_by(${USER_COLS})`,
].join("");

type ReferenceRow = {
  ticket_id: string;
  source_type: string;
  source_id: string;
  context_snapshot: unknown;
};

/** Repair-order references are stored as source_type repair_order (found) or repair_order_number. */
const ORDER_SOURCE_TYPES = ["repair_order", "repair_order_number"];

function toOrder(ref: ReferenceRow | undefined): OrderRef | null {
  if (!ref) return null;
  const snap = (ref.context_snapshot ?? {}) as Record<string, unknown>;
  return {
    orderNumber: String(snap.order_number ?? ""),
    warehouse: String(snap.warehouse ?? ""),
    zlNumber: typeof snap.zl_number === "string" ? snap.zl_number : null,
    repairOrderId: ref.source_type === "repair_order" ? ref.source_id : null,
  };
}

async function loadOrders(supabase: PortalSupabase, ticketIds: string[]) {
  if (ticketIds.length === 0) return new Map<string, OrderRef>();
  const { data } = await supabase
    .from("helpdesk_ticket_references")
    .select("ticket_id, source_type, source_id, context_snapshot")
    .in("ticket_id", ticketIds)
    .in("source_type", ORDER_SOURCE_TYPES);
  const map = new Map<string, OrderRef>();
  for (const ref of (data ?? []) as ReferenceRow[]) {
    const order = toOrder(ref);
    if (order && !map.has(ref.ticket_id)) map.set(ref.ticket_id, order);
  }
  return map;
}

/** Public (non-internal) comment counts; RLS already hides what the user may not read. */
async function loadCommentCounts(supabase: PortalSupabase, orgId: string, ticketIds: string[]) {
  const counts = new Map<string, number>();
  if (ticketIds.length === 0) return counts;
  const { data } = await supabase
    .from("app_comments")
    .select("target_id")
    .eq("org_id", orgId)
    .eq("target_type", TICKET_TARGET)
    .neq("visibility", "internal")
    .is("deleted_at", null)
    .in("target_id", ticketIds);
  for (const row of data ?? []) counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
  return counts;
}

/** Ticket ids whose order reference matches a ZL search ("51481", "3252", "ZL/51481/..."). */
async function ticketIdsByOrder(supabase: PortalSupabase, term: string): Promise<string[]> {
  const digits = term.replace(/[^\d/]/g, "");
  if (!/\d{3,}/.test(digits)) return [];
  const { data } = await supabase
    .from("helpdesk_ticket_references")
    .select("ticket_id, context_snapshot")
    .in("source_type", ORDER_SOURCE_TYPES)
    .or(
      [
        `context_snapshot->>order_number.ilike.%${digits}%`,
        `context_snapshot->>zl_number.ilike.%${digits}%`,
      ].join(",")
    )
    .limit(200);
  return [...new Set((data ?? []).map((r) => r.ticket_id))];
}

function statusFilter(filter: RequestFilter) {
  switch (filter) {
    case "yourTurn":
      return { status: ["waiting_response"] as TicketStatus[] };
    case "answered":
      return { status: ["resolved"] as TicketStatus[] };
    case "closed":
      return { status: ["closed", "cancelled"] as TicketStatus[] };
    case "approval":
      return { status: null, approval: true };
    default:
      return { status: null };
  }
}

export type ListRequestsInput = {
  scope: "mine" | "branch";
  filter: RequestFilter;
  typeId?: string | null;
  search?: string | null;
  sort: "activity" | "newest";
  page: number;
};

export async function listRequests(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: ListRequestsInput
): Promise<ServiceResult<{ items: RequestListItem[]; total: number }>> {
  let q = supabase
    .from("helpdesk_tickets")
    .select(LIST_COLS, { count: "exact" })
    .eq("org_id", ctx.org.id)
    .in("branch_id", ctx.scopeBranchIds)
    .is("deleted_at", null);

  if (input.scope === "mine")
    q = q.or(`created_by.eq.${ctx.user.id},requested_by.eq.${ctx.user.id}`);
  if (input.typeId) q = q.eq("ticket_type_id", input.typeId);

  const f = statusFilter(input.filter);
  if (f.status) q = q.in("status", f.status);
  else q = q.not("status", "in", "(closed,cancelled)");
  if (f.approval) q = q.eq("requires_acceptance", true).is("accepted_at", null);

  const term = input.search
    ?.trim()
    .replace(/[%,()]/g, " ")
    .trim();
  if (term) {
    const orderIds = await ticketIdsByOrder(supabase, term);
    const ors = [`title.ilike.%${term}%`, `ticket_number.ilike.%${term}%`];
    if (orderIds.length) ors.push(`id.in.(${orderIds.join(",")})`);
    q = q.or(ors.join(","));
  }

  const from = Math.max(0, input.page - 1) * PAGE_SIZE;
  const { data, error, count } = await q
    .order(input.sort === "newest" ? "created_at" : "updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    ticket_number: string;
    title: string;
    status: string;
    requires_acceptance: boolean | null;
    accepted_at: string | null;
    branch_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    ticket_type: TicketTypeRef | null;
    creator: UserRow;
  }>;
  const ids = rows.map((r) => r.id);
  const [orders, counts] = await Promise.all([
    loadOrders(supabase, ids),
    loadCommentCounts(supabase, ctx.org.id, ids),
  ]);

  return {
    ok: true,
    data: {
      total: count ?? rows.length,
      items: rows.map((r) => ({
        id: r.id,
        number: r.ticket_number,
        title: r.title,
        state: requestState(r),
        type: r.ticket_type,
        branchId: r.branch_id,
        requester: toPerson(r.creator),
        order: orders.get(r.id) ?? null,
        commentCount: counts.get(r.id) ?? 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isMine: r.created_by === ctx.user.id,
      })),
    },
  };
}

export async function getRequest(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string
): Promise<ServiceResult<{ request: RequestDetail; events: RequestEvent[] } | null>> {
  const { data, error } = await supabase
    .from("helpdesk_tickets")
    .select(
      [
        LIST_COLS,
        ", description_plain, description_rich, closed_at,",
        `assignees:helpdesk_ticket_assignees(role, deleted_at, user:users!user_id(${USER_COLS})),`,
        `acceptors:helpdesk_ticket_acceptors(user:users!user_id(${USER_COLS}))`,
      ].join("")
    )
    .eq("id", ticketId)
    .eq("org_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: null };

  const r = data as unknown as {
    id: string;
    ticket_number: string;
    title: string;
    status: TicketStatus;
    requires_acceptance: boolean | null;
    accepted_at: string | null;
    branch_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    description_plain: string | null;
    description_rich: unknown | null;
    ticket_type: TicketTypeRef | null;
    creator: UserRow;
    assignees: Array<{ role: string; deleted_at: string | null; user: UserRow }>;
    acceptors: Array<{ user: UserRow }>;
  };
  if (!r.branch_id || !ctx.branches.some((b) => b.id === r.branch_id)) {
    return { ok: true, data: null };
  }

  const [orders, counts, { data: activity }] = await Promise.all([
    loadOrders(supabase, [r.id]),
    loadCommentCounts(supabase, ctx.org.id, [r.id]),
    supabase
      .from("helpdesk_ticket_activity")
      .select(`id, event_type, payload, created_at, actor:users!actor_id(${USER_COLS})`)
      .eq("ticket_id", r.id)
      .order("created_at", { ascending: true }),
  ]);

  const isMine = r.created_by === ctx.user.id;
  const open = r.status !== "closed" && r.status !== "cancelled";
  return {
    ok: true,
    data: {
      request: {
        id: r.id,
        number: r.ticket_number,
        title: r.title,
        state: requestState(r),
        status: r.status,
        type: r.ticket_type,
        branchId: r.branch_id,
        requester: toPerson(r.creator),
        order: orders.get(r.id) ?? null,
        commentCount: counts.get(r.id) ?? 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isMine,
        descriptionPlain: r.description_plain,
        descriptionRich: r.description_rich,
        responders: r.assignees
          .filter((a) => !a.deleted_at && a.role === "responder")
          .map((a) => toPerson(a.user))
          .filter((p): p is PersonRef => !!p),
        acceptors: r.acceptors.map((a) => toPerson(a.user)).filter((p): p is PersonRef => !!p),
        acceptedAt: r.accepted_at,
        closedAt: r.closed_at,
        canClose: isMine && open,
      },
      events: (
        (activity ?? []) as unknown as Array<{
          id: string;
          event_type: string;
          payload: Record<string, unknown> | null;
          created_at: string;
          actor: UserRow;
        }>
      ).map((e) => ({
        id: e.id,
        type: e.event_type,
        actor: toPerson(e.actor),
        payload: e.payload ?? {},
        createdAt: e.created_at,
      })),
    },
  };
}

/** Active types of the org, for the list filter. */
export async function listTypeOptions(
  supabase: PortalSupabase,
  ctx: PortalContext
): Promise<TicketTypeRef[]> {
  const { data } = await supabase
    .from("helpdesk_ticket_types")
    .select("id, name, color, icon")
    .eq("org_id", ctx.org.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export type PortalTicketType = TicketTypeRef & {
  description: string | null;
  requiresAcceptance: boolean;
  responders: PersonRef[];
  acceptors: PersonRef[];
};

/** Active types the user may file in `branchId`: org-wide ones plus that branch's own. */
export async function listTicketTypes(
  supabase: PortalSupabase,
  ctx: PortalContext,
  branchId: string
): Promise<ServiceResult<PortalTicketType[]>> {
  const { data, error } = await supabase
    .from("helpdesk_ticket_types")
    .select(
      [
        "id, name, color, icon, description, requires_acceptance, scope, branch_id,",
        `responders:helpdesk_ticket_type_default_responders(deleted_at, user:users!responder_user_id(${USER_COLS})),`,
        `acceptors:helpdesk_ticket_type_acceptors(user:users!user_id(${USER_COLS}))`,
      ].join("")
    )
    .eq("org_id", ctx.org.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    description: string | null;
    requires_acceptance: boolean;
    scope: string;
    branch_id: string | null;
    responders: Array<{ deleted_at: string | null; user: UserRow }>;
    acceptors: Array<{ user: UserRow }>;
  }>;
  return {
    ok: true,
    data: rows
      .filter((t) => t.scope !== "branch" || t.branch_id === branchId)
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        icon: t.icon,
        description: t.description,
        requiresAcceptance: t.requires_acceptance,
        responders: t.responders
          .filter((r) => !r.deleted_at)
          .map((r) => toPerson(r.user))
          .filter((p): p is PersonRef => !!p),
        acceptors: t.acceptors.map((a) => toPerson(a.user)).filter((p): p is PersonRef => !!p),
      })),
  };
}

export type OrderLookup =
  | { found: true; order: OrderRef & { branchName: string | null } }
  | { found: false };

/**
 * Finds the repair order behind "nr zlecenia + magazyn". The DMS prefix (ZL / ZLEC) depends
 * on the warehouse, so the full number is looked up, never composed.
 */
export async function lookupOrder(
  supabase: PortalSupabase,
  ctx: PortalContext,
  orderNumber: string,
  warehouse: string
): Promise<OrderLookup> {
  // portal_find_repair_order (migration 20261006104839, D8) returns only id, full number and
  // branch, for branches where the caller may file tickets -- advisors lack workshop read.
  // Not in the generated types yet, hence the narrowed rpc signature.
  const rpc = supabase.rpc as unknown as (
    fn: "portal_find_repair_order",
    args: { p_org_id: string; p_order_number: string; p_warehouse: string }
  ) => Promise<{ data: Array<{ id: string; zl_number: string | null; branch_id: string }> | null }>;
  const { data } = await rpc.call(supabase, "portal_find_repair_order", {
    p_org_id: ctx.org.id,
    p_order_number: orderNumber,
    p_warehouse: warehouse,
  });
  const ro = data?.[0];
  if (!ro?.zl_number) return { found: false };
  return {
    found: true,
    order: {
      orderNumber,
      warehouse,
      zlNumber: ro.zl_number,
      repairOrderId: ro.id,
      branchName: ctx.branches.find((b) => b.id === ro.branch_id)?.name ?? null,
    },
  };
}

/** Plain text as the Tiptap document Ambra renders descriptions from (one paragraph per line). */
export function plainToRichDoc(text: string) {
  return {
    type: "doc",
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line
          ? { type: "paragraph", content: [{ type: "text", text: line }] }
          : { type: "paragraph" }
      ),
  };
}

export type CreateRequestInput = {
  branchId: string;
  typeId: string;
  title: string;
  description: string | null;
  orderNumber: string | null;
  warehouse: string | null;
};

export async function createRequest(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: CreateRequestInput
): Promise<ServiceResult<{ id: string; number: string }>> {
  const types = await listTicketTypes(supabase, ctx, input.branchId);
  if (!types.ok) return types;
  const type = types.data.find((t) => t.id === input.typeId);
  if (!type) return { ok: false, error: "unknown_type" };

  const { data: typeRow } = await supabase
    .from("helpdesk_ticket_types")
    .select("default_priority")
    .eq("id", type.id)
    .maybeSingle();

  // Responders and acceptors always come from the type's configuration, never the client.
  const { data, error } = await supabase.rpc("helpdesk_create_ticket", {
    p_org_id: ctx.org.id,
    p_title: input.title,
    p_description_plain: input.description ?? "",
    p_description_rich: plainToRichDoc(input.description ?? ""),
    p_status: "open",
    p_priority: typeRow?.default_priority ?? "medium",
    p_ticket_type_id: type.id,
    p_branch_id: input.branchId,
    p_assignee_ids: type.responders.map((p) => p.id),
    p_requires_acceptance: type.requiresAcceptance && type.acceptors.length > 0,
    p_acceptor_ids: type.acceptors.map((p) => p.id),
  });
  if (error) return { ok: false, error: error.message };
  const created = data as { id: string; ticket_number: string };

  if (input.orderNumber && input.warehouse) {
    const lookup = await lookupOrder(supabase, ctx, input.orderNumber, input.warehouse);
    const { error: refError } = await supabase.from("helpdesk_ticket_references").insert({
      ticket_id: created.id,
      source_module: "workshop",
      source_type: lookup.found ? "repair_order" : "repair_order_number",
      source_id: lookup.found
        ? lookup.order.repairOrderId!
        : `${input.orderNumber}/${input.warehouse}`,
      context_snapshot: {
        order_number: input.orderNumber,
        warehouse: input.warehouse,
        zl_number: lookup.found ? lookup.order.zlNumber : null,
      },
      created_by: ctx.user.id,
    });
    if (refError) console.error("[createRequest] order reference failed:", refError.message);
  }

  return { ok: true, data: { id: created.id, number: created.ticket_number } };
}

/** Requester closes ("Sprawa załatwiona") or withdraws their own open request. */
export async function closeOwnRequest(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string,
  outcome: "closed" | "cancelled"
): Promise<ServiceResult<null>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("helpdesk_tickets")
    .update({ status: outcome, closed_at: now, closed_by: ctx.user.id, updated_at: now })
    .eq("id", ticketId)
    .eq("org_id", ctx.org.id)
    .eq("created_by", ctx.user.id)
    .not("status", "in", "(closed,cancelled)")
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "not_found" };

  await supabase.from("helpdesk_ticket_activity").insert({
    ticket_id: ticketId,
    org_id: ctx.org.id,
    actor_id: ctx.user.id,
    event_type: "ticket_closed",
    payload: { resolution_note: null, status: outcome, source: "requests-portal" },
  });
  return { ok: true, data: null };
}
