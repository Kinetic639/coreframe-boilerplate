import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetectedSearchId } from "@/lib/global-search/id-patterns";
import type { SearchSourceId } from "@/lib/global-search/sources";
import { objectRoute, type ObjectRef } from "@/lib/object-links";

export type { SearchSourceId };

/**
 * Global search over operational data.
 *
 * - findExactHits: identifiers recognized in the query (repair order number,
 *   VIN, HD-/PT- numbers, document numbers, codes) → the object itself.
 * - searchText: fragment search through the search_global() RPC (trigram
 *   indexes, part numbers compared by fingerprint, orders found by their lines).
 *
 * Runs with the user's Supabase client, so RLS applies on top of the source
 * gates decided by the caller. Branch-bound objects are looked up in the active
 * branch only; tickets, tasks and people follow their organization-wide RLS.
 */

export type ExactHitType =
  | "repairOrder"
  | "ticket"
  | "task"
  | "document"
  | "container"
  | "location"
  | "item"
  | "person"
  | "party"
  | "contact"
  | "audit"
  | "matcherSession"
  | "qrCode"
  | "board"
  | "map"
  | "ticketType"
  | "invitation"
  | "comment"
  | "attachment";

export interface SearchExactHit {
  type: ExactHitType;
  id: string;
  /** Main identifier shown in mono (number, code, SKU); null for people */
  code: string | null;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  /** Internal route (next-intl pathname) */
  href: string;
  query?: Record<string, string>;
  /** Raw details formatted by the palette (stock, warehouse, matched part, …) */
  meta?: Record<string, string | number>;
}

/** Sources whose rows belong to one branch (the palette searches the active one) */
const BRANCH_BOUND_SOURCES: SearchSourceId[] = [
  "repairOrders",
  "locations",
  "containers",
  "documents",
  "audits",
  "matcherSessions",
  "maps",
];
const OTHER_BRANCHES_LIMIT = 10;

export interface OtherBranchCount {
  branchId: string;
  /** Matches found (at least; capped per source) */
  count: number;
}

export interface ItemPreviewData {
  name: string | null;
  brand: string | null;
  skus: string[];
  onHand: number;
  committed: number;
  available: number;
  locations: { code: string | null; name: string | null; onHand: number }[];
  orders: {
    id: string;
    code: string | null;
    client: string | null;
    warehouseCode: string | null;
    quantity: number;
  }[];
}

export interface RepairOrderPreviewData {
  code: string | null;
  zlNumber: string | null;
  orderYear: number | null;
  warehouseCode: string | null;
  client: string | null;
  dealer: string | null;
  vehicleBrand: string | null;
  vin: string | null;
  status: string;
  createdAt: string;
  lineCount: number;
  linkedLineCount: number;
  lines: { code: string | null; name: string | null; quantity: number; unit: string | null }[];
}

export type SearchPreview =
  | ({ type: "item" } & ItemPreviewData)
  | ({ type: "repairOrder" } & RepairOrderPreviewData);

/** Shortest fragment search_global() searches (mirrors the SQL function) */
export const MIN_TEXT_QUERY = 3;
const TEXT_SEARCH_TIMEOUT_MS = 3000;

/** Sources searched by search_global() (tasks only have exact hits for now) */
const TEXT_SOURCES: SearchSourceId[] = [
  "repairOrders",
  "items",
  "locations",
  "containers",
  "documents",
  "tickets",
  "people",
  "tasks",
  "parties",
  "contacts",
  "audits",
  "matcherSessions",
  "qrCodes",
  "boards",
  "maps",
  "ticketTypes",
  "invitations",
  "comments",
  "attachments",
];

interface SearchGlobalRow {
  type: ExactHitType;
  id: string;
  code: string | null;
  title: string | null;
  status: string | null;
  meta: Record<string, string | number> | null;
}

/** Route of a hit, from the shared object-link resolver */
function hrefFor(type: ExactHitType, ref: ObjectRef): Pick<SearchExactHit, "href" | "query"> {
  const route = objectRoute(type, ref) ?? { pathname: "/dashboard" };
  return route.query ? { href: route.pathname, query: route.query } : { href: route.pathname };
}

export interface ExactSearchScope {
  orgId: string;
  branchId: string | null;
  /** Sources the user may search (permission + entitlement gates) */
  sources: ReadonlySet<SearchSourceId>;
}

const LIMIT = 5;

/** Escapes LIKE wildcards so `ilike` compares the whole value, case-insensitively */
function exactLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

type Db = SupabaseClient;

async function repairOrders(db: Db, scope: ExactSearchScope, ids: DetectedSearchId[]) {
  const hits: SearchExactHit[] = [];
  for (const id of ids) {
    let query = db
      .from("repair_orders")
      .select("id, zl_number, order_no, warehouse_code, client_name, vehicle_brand, vin, status")
      .eq("organization_id", scope.orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (scope.branchId) query = query.eq("branch_id", scope.branchId);

    if (id.kind === "repairOrderFull") {
      query = query
        .eq("order_no", id.orderNo)
        .eq("order_year", id.year)
        .eq("warehouse_code", id.warehouseCode);
    } else if (id.kind === "repairOrderNumber") {
      query = query.or(`order_no.eq.${id.value},zl_number.eq.${id.value}`);
    } else if (id.kind === "vin") {
      query = query.eq("vin", id.value);
    } else {
      continue;
    }

    const { data } = await query;
    for (const row of data ?? []) {
      hits.push({
        type: "repairOrder",
        id: row.id,
        code: row.order_no ?? row.zl_number ?? "—",
        title: [row.client_name, row.vehicle_brand].filter(Boolean).join(" · ") || null,
        subtitle:
          [row.warehouse_code ? `mag ${row.warehouse_code}` : null, row.vin]
            .filter(Boolean)
            .join(" · ") || null,
        status: row.status,
        ...hrefFor("repairOrder", { id: row.id }),
      });
    }
  }
  return hits;
}

async function tickets(db: Db, scope: ExactSearchScope, value: string) {
  const { data } = await db
    .from("helpdesk_tickets")
    .select("id, ticket_number, title, status")
    .eq("org_id", scope.orgId)
    .eq("ticket_number", value)
    .is("deleted_at", null)
    .limit(1);
  return (data ?? []).map(
    (row): SearchExactHit => ({
      type: "ticket",
      id: row.id,
      code: row.ticket_number,
      title: row.title,
      subtitle: null,
      status: row.status,
      ...hrefFor("ticket", { id: row.id, code: row.ticket_number }),
    })
  );
}

async function tasks(db: Db, scope: ExactSearchScope, value: string) {
  const { data } = await db
    .from("planning_tasks")
    .select("id, task_number, title, status")
    .eq("organization_id", scope.orgId)
    .eq("task_number", value)
    .is("deleted_at", null)
    .limit(1);
  return (data ?? []).map(
    (row): SearchExactHit => ({
      type: "task",
      id: row.id,
      code: row.task_number,
      title: row.title,
      subtitle: null,
      status: row.status,
      ...hrefFor("task", { id: row.id, code: row.task_number }),
    })
  );
}

async function documents(db: Db, scope: ExactSearchScope, value: string) {
  let query = db
    .from("inventory_movement_headers")
    .select("id, document_number, document_date, counterparty_name, status")
    .eq("organization_id", scope.orgId)
    .eq("document_number", value)
    .is("deleted_at", null)
    .limit(LIMIT);
  if (scope.branchId) query = query.eq("branch_id", scope.branchId);
  const { data } = await query;
  return (data ?? []).map(
    (row): SearchExactHit => ({
      type: "document",
      id: row.id,
      code: row.document_number ?? value,
      title: row.counterparty_name,
      subtitle: row.document_date,
      status: row.status,
      ...hrefFor("document", { id: row.id }),
    })
  );
}

async function containers(db: Db, scope: ExactSearchScope, value: string) {
  let query = db
    .from("inventory_containers")
    .select("id, code, type, status")
    .eq("organization_id", scope.orgId)
    .ilike("code", exactLike(value))
    .is("deleted_at", null)
    .limit(LIMIT);
  if (scope.branchId) query = query.eq("branch_id", scope.branchId);
  const { data } = await query;
  return (data ?? []).map(
    (row): SearchExactHit => ({
      type: "container",
      id: row.id,
      code: row.code,
      title: null,
      subtitle: row.type,
      status: row.status,
      ...hrefFor("container", { id: row.id }),
    })
  );
}

async function locations(db: Db, scope: ExactSearchScope, value: string) {
  let query = db
    .from("warehouse_locations")
    .select("id, code, name")
    .eq("organization_id", scope.orgId)
    .ilike("code", exactLike(value))
    .is("deleted_at", null)
    .limit(LIMIT);
  if (scope.branchId) query = query.eq("branch_id", scope.branchId);
  const { data } = await query;
  return (data ?? []).map(
    (row): SearchExactHit => ({
      type: "location",
      id: row.id,
      code: row.code ?? value,
      title: row.name,
      subtitle: null,
      status: null,
      ...hrefFor("location", { id: row.id }),
    })
  );
}

async function items(db: Db, scope: ExactSearchScope, value: string) {
  const variants = () =>
    db
      .from("inventory_variants")
      .select("id, product_id, sku, barcode, name")
      .eq("organization_id", scope.orgId)
      .is("deleted_at", null)
      .limit(LIMIT);
  // Two queries instead of .or(): the value never goes into a PostgREST filter string
  const [bySku, byBarcode] = await Promise.all([
    variants().ilike("sku", exactLike(value)),
    variants().eq("barcode", value),
  ]);
  const seen = new Set<string>();
  const hits: SearchExactHit[] = [];
  for (const row of [...(bySku.data ?? []), ...(byBarcode.data ?? [])]) {
    if (seen.has(row.product_id)) continue;
    seen.add(row.product_id);
    hits.push({
      type: "item",
      id: row.product_id,
      code: row.sku ?? row.barcode ?? value,
      title: row.name,
      subtitle: null,
      status: null,
      ...hrefFor("item", { id: row.product_id }),
    });
  }
  return hits;
}

export class GlobalSearchService {
  /**
   * How many fragment matches of branch-bound sources live in OTHER branches
   * the user can see (RLS decides), per branch. Capped: at most
   * OTHER_BRANCHES_LIMIT rows per source are looked at, so counts are "at least".
   */
  static async countOtherBranches(
    supabase: SupabaseClient,
    scope: ExactSearchScope,
    query: string
  ): Promise<OtherBranchCount[]> {
    const sources = BRANCH_BOUND_SOURCES.filter((source) => scope.sources.has(source));
    if (!scope.branchId || sources.length === 0 || query.trim().length < MIN_TEXT_QUERY) {
      return [];
    }

    const { data, error } = await supabase
      .rpc("search_global", {
        p_org: scope.orgId,
        p_branch: null,
        p_query: query,
        p_sources: sources,
        p_limit: OTHER_BRANCHES_LIMIT,
      })
      .abortSignal(AbortSignal.timeout(TEXT_SEARCH_TIMEOUT_MS));
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as SearchGlobalRow[]) {
      const branchId = row.meta?.branchId;
      if (typeof branchId !== "string" || branchId === scope.branchId) continue;
      counts.set(branchId, (counts.get(branchId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([branchId, count]) => ({ branchId, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Preview pane data for an item or a repair order. Read under RLS through
   * SECURITY INVOKER functions; null when the row is not visible.
   */
  static async getPreview(
    supabase: SupabaseClient,
    branchId: string | null,
    type: "item" | "repairOrder",
    id: string
  ): Promise<SearchPreview | null> {
    const { data, error } =
      type === "item"
        ? await supabase.rpc("search_preview_item", { p_product: id, p_branch: branchId })
        : await supabase.rpc("search_preview_repair_order", { p_order: id });
    if (error) throw new Error(error.message);
    if (!data) return null;
    return type === "item"
      ? { type: "item", ...(data as ItemPreviewData) }
      : { type: "repairOrder", ...(data as RepairOrderPreviewData) };
  }

  /**
   * Fragment search across every allowed source, `limit` rows per source.
   * Needs MIN_TEXT_QUERY characters (trigram indexes cannot serve shorter
   * patterns). Gives up after TEXT_SEARCH_TIMEOUT_MS: a palette that waits
   * longer is useless, and exact hits are returned independently.
   */
  static async searchText(
    supabase: SupabaseClient,
    scope: ExactSearchScope,
    query: string,
    limit = 5
  ): Promise<SearchExactHit[]> {
    const sources = TEXT_SOURCES.filter((source) => scope.sources.has(source));
    if (sources.length === 0 || query.trim().length < MIN_TEXT_QUERY) return [];

    const { data, error } = await supabase
      .rpc("search_global", {
        p_org: scope.orgId,
        p_branch: scope.branchId,
        p_query: query,
        p_sources: sources,
        p_limit: limit,
      })
      .abortSignal(AbortSignal.timeout(TEXT_SEARCH_TIMEOUT_MS));
    if (error) throw new Error(error.message);

    return ((data ?? []) as SearchGlobalRow[]).map((row) => ({
      type: row.type,
      id: row.id,
      code: row.code,
      title: row.title,
      subtitle: null,
      status: row.status,
      meta: row.meta ?? undefined,
      ...hrefFor(row.type, row),
    }));
  }

  static async findExactHits(
    supabase: SupabaseClient,
    scope: ExactSearchScope,
    detected: DetectedSearchId[]
  ): Promise<SearchExactHit[]> {
    const can = (source: SearchSourceId) => scope.sources.has(source);
    const jobs: Promise<SearchExactHit[]>[] = [];

    const orderIds = detected.filter(
      (id) => id.kind === "repairOrderFull" || id.kind === "repairOrderNumber" || id.kind === "vin"
    );
    if (orderIds.length && can("repairOrders")) jobs.push(repairOrders(supabase, scope, orderIds));

    for (const id of detected) {
      if (id.kind === "ticket" && can("tickets")) jobs.push(tickets(supabase, scope, id.value));
      if (id.kind === "task" && can("tasks")) jobs.push(tasks(supabase, scope, id.value));
      if (id.kind === "document" && can("documents"))
        jobs.push(documents(supabase, scope, id.value));
      if (id.kind === "code") {
        if (can("containers")) jobs.push(containers(supabase, scope, id.value));
        if (can("locations")) jobs.push(locations(supabase, scope, id.value));
        if (can("items")) jobs.push(items(supabase, scope, id.value));
      }
    }

    const results = await Promise.all(jobs);
    const seen = new Set<string>();
    return results.flat().filter((hit) => {
      const key = `${hit.type}:${hit.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
