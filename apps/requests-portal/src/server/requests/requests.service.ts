import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalSupabase } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import {
  requestState,
  type OrderRef,
  type PersonRef,
  type RequestDetail,
  type RequestEvent,
  type RequestFilter,
  type PageSize,
  type RequestListItem,
  type RequestListPage,
  type ServiceResult,
  type TicketStatus,
  type TicketTypeRef,
} from "./types";

export const TICKET_TARGET = "helpdesk.ticket";

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

export const people = (rows: UserRow[]) => rows.map(toPerson).filter((p): p is PersonRef => !!p);

const USER_COLS = "id, first_name, last_name, email, avatar_url";

/**
 * Portal RPCs (migration 20261128090000_requests_portal_rpc). Not in the generated types
 * yet, hence the loose signature. Every caller falls back to the separate queries when a
 * function is missing or fails, so the portal works before the migration is applied.
 */
export async function portalRpc<T>(
  supabase: PortalSupabase,
  fn: string,
  args: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: T | null; error: { message: string; code?: string } | null }>;
  return rpc.call(supabase, fn, args);
}

/** A request as portal_request_json returns it. */
export type RpcRequestRow = {
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
  ticket_type: TicketTypeRef | null;
  creator: UserRow;
  order_ref: Omit<ReferenceRow, "ticket_id"> | null;
  /** Since 20261129090000; the card view has them too. */
  responders?: UserRow[];
  comment_count: number;
};

export function rpcRowToListItem(r: RpcRequestRow, ctx: PortalContext): RequestListItem {
  return {
    id: r.id,
    number: r.ticket_number,
    title: r.title,
    state: requestState(r),
    type: r.ticket_type,
    branchId: r.branch_id,
    requester: toPerson(r.creator),
    order: r.order_ref ? toOrder({ ...r.order_ref, ticket_id: r.id }) : null,
    responders: people(r.responders ?? []),
    commentCount: Number(r.comment_count ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isMine: r.created_by === ctx.user.id,
  };
}
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

/** Responders per ticket (helpdesk_ticket_assignees), in assignment order. */
async function loadResponders(supabase: PortalSupabase, ticketIds: string[]) {
  const map = new Map<string, PersonRef[]>();
  if (ticketIds.length === 0) return map;
  const { data } = await supabase
    .from("helpdesk_ticket_assignees")
    .select(`ticket_id, user:users!user_id(${USER_COLS})`)
    .in("ticket_id", ticketIds)
    .eq("role", "responder")
    .is("deleted_at", null)
    .order("assigned_at", { ascending: true });
  for (const row of (data ?? []) as unknown as Array<{ ticket_id: string; user: UserRow }>) {
    const person = toPerson(row.user);
    if (person) map.set(row.ticket_id, [...(map.get(row.ticket_id) ?? []), person]);
  }
  return map;
}

/** Open requests waiting for the user's answer in the list's scope (the filter badge). */
async function countYourTurn(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: ListRequestsInput
): Promise<number> {
  let q = supabase
    .from("helpdesk_tickets")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.org.id)
    .in("branch_id", ctx.scopeBranchIds)
    .is("deleted_at", null)
    .eq("status", "waiting_response");
  if (input.scope === "mine")
    q = q.or(`created_by.eq.${ctx.user.id},requested_by.eq.${ctx.user.id}`);
  const { count } = await q;
  return count ?? 0;
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
  size: PageSize;
};

export async function listRequests(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: ListRequestsInput
): Promise<ServiceResult<RequestListPage>> {
  const { data, error } = await portalRpc<{
    total: number;
    your_turn?: number;
    rows: RpcRequestRow[];
  }>(supabase, "portal_request_list", {
    p_org_id: ctx.org.id,
    p_branch_ids: ctx.scopeBranchIds,
    p_mine: input.scope === "mine",
    p_filter: input.filter,
    p_type_id: input.typeId ?? null,
    p_search: input.search?.trim() || null,
    p_sort: input.sort,
    p_limit: input.size,
    p_offset: Math.max(0, input.page - 1) * input.size,
  });
  if (!error && data) {
    const items = data.rows.map((r) => rpcRowToListItem(r, ctx));
    // Before 20261129090000 the rows have no responders and there is no count.
    const old = data.your_turn === undefined;
    const [responders, yourTurn] = old
      ? await Promise.all([
          loadResponders(
            supabase,
            items.map((i) => i.id)
          ),
          countYourTurn(supabase, ctx, input),
        ])
      : [null, Number(data.your_turn)];
    return {
      ok: true,
      data: {
        total: Number(data.total),
        yourTurn,
        items: responders
          ? items.map((i) => ({ ...i, responders: responders.get(i.id) ?? [] }))
          : items,
      },
    };
  }
  return listRequestsLegacy(supabase, ctx, input);
}

/** The list in separate queries, used while portal_request_list is missing. */
async function listRequestsLegacy(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: ListRequestsInput
): Promise<ServiceResult<RequestListPage>> {
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

  const from = Math.max(0, input.page - 1) * input.size;
  const { data, error, count } = await q
    .order(input.sort === "newest" ? "created_at" : "updated_at", { ascending: false })
    .range(from, from + input.size - 1);
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
  const [orders, counts, responders, yourTurn] = await Promise.all([
    loadOrders(supabase, ids),
    loadCommentCounts(supabase, ctx.org.id, ids),
    loadResponders(supabase, ids),
    countYourTurn(supabase, ctx, input),
  ]);

  return {
    ok: true,
    data: {
      total: count ?? rows.length,
      yourTurn,
      items: rows.map((r) => ({
        id: r.id,
        number: r.ticket_number,
        title: r.title,
        state: requestState(r),
        type: r.ticket_type,
        branchId: r.branch_id,
        requester: toPerson(r.creator),
        order: orders.get(r.id) ?? null,
        responders: responders.get(r.id) ?? [],
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
  const res = await listTicketTypesByBranch(supabase, ctx, [branchId]);
  return res.ok ? { ok: true, data: res.data[branchId] ?? [] } : res;
}

/** The same per branch for several branches, in one query. */
export async function listTicketTypesByBranch(
  supabase: PortalSupabase,
  ctx: PortalContext,
  branchIds: string[]
): Promise<ServiceResult<Record<string, PortalTicketType[]>>> {
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
  const types = rows.map((t) => ({
    scope: t.scope,
    branchId: t.branch_id,
    type: {
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
    } satisfies PortalTicketType,
  }));
  return {
    ok: true,
    data: Object.fromEntries(
      branchIds.map((branchId) => [
        branchId,
        types.filter((t) => t.scope !== "branch" || t.branchId === branchId).map((t) => t.type),
      ])
    ),
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
  /** Tiptap document from the form's editor; built from `description` when absent. */
  descriptionRich?: unknown | null;
  orderNumber: string | null;
  warehouse: string | null;
};

export async function createRequest(
  supabase: PortalSupabase,
  ctx: PortalContext,
  input: CreateRequestInput
): Promise<ServiceResult<{ id: string; number: string }>> {
  const description = input.description ?? "";
  const { data, error } = await portalRpc<{ id: string; ticket_number: string }>(
    supabase,
    "portal_create_request",
    {
      p_org_id: ctx.org.id,
      p_branch_id: input.branchId,
      p_type_id: input.typeId,
      p_title: input.title,
      p_description_plain: description,
      p_description_rich: input.descriptionRich ?? plainToRichDoc(description),
      p_order_number: input.orderNumber && input.warehouse ? input.orderNumber : null,
      p_warehouse: input.orderNumber && input.warehouse ? input.warehouse : null,
    }
  );
  if (data) return { ok: true, data: { id: data.id, number: data.ticket_number } };
  if (error && !isMissingFunction(error)) {
    return {
      ok: false,
      error: error.message.includes("unknown_type") ? "unknown_type" : error.message,
    };
  }
  return createRequestLegacy(supabase, ctx, input);
}

/** PostgREST reports a function the database does not have yet as PGRST202 (or 42883). */
export function isMissingFunction(error: { code?: string; message: string }) {
  return error.code === "PGRST202" || error.code === "42883";
}

async function createRequestLegacy(
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
    p_description_rich: (input.descriptionRich ??
      plainToRichDoc(input.description ?? "")) as ReturnType<typeof plainToRichDoc>,
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
): Promise<ServiceResult<RequestListItem>> {
  const { data: row, error: rpcError } = await portalRpc<RpcRequestRow>(
    supabase,
    "portal_close_request",
    { p_ticket_id: ticketId, p_outcome: outcome }
  );
  if (row) return { ok: true, data: rpcRowToListItem(row, ctx) };
  if (rpcError && !isMissingFunction(rpcError)) {
    return {
      ok: false,
      error: rpcError.message.includes("not_found") ? "not_found" : rpcError.message,
    };
  }

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
  const fresh = await getRequest(supabase, ctx, ticketId);
  if (!fresh.ok || !fresh.data) return { ok: false, error: "not_found" };
  return { ok: true, data: fresh.data.request };
}

export type PortalWarehouse = { code: string; name: string | null };

/**
 * DMS warehouses (magazyny) of the given branches, e.g. 3112 Volkswagen (Ambra branch settings,
 * table branch_warehouses). Offered as shortcuts next to the warehouse field. Not in the
 * generated types yet, hence the cast.
 */
export async function listBranchWarehouses(
  supabase: PortalSupabase,
  ctx: PortalContext,
  branchIds: string[]
): Promise<Record<string, PortalWarehouse[]>> {
  const out: Record<string, PortalWarehouse[]> = Object.fromEntries(
    branchIds.map((id) => [id, []])
  );
  if (branchIds.length === 0) return out;
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("branch_warehouses")
    .select("branch_id, code, name")
    .eq("organization_id", ctx.org.id)
    .in("branch_id", branchIds)
    .is("deleted_at", null)
    .order("code", { ascending: true });
  for (const r of (data ?? []) as { branch_id: string; code: string; name: string | null }[]) {
    out[r.branch_id]?.push({ code: r.code, name: r.name });
  }
  return out;
}
