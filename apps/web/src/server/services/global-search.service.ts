import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetectedSearchId } from "@/lib/global-search/id-patterns";

/**
 * Global search — exact hits for identifiers recognized in the query
 * (repair order number, VIN, HD-/PT- numbers, document numbers, codes).
 *
 * Runs with the user's Supabase client, so RLS applies on top of the source
 * gates decided by the caller. Branch-bound objects are looked up in the active
 * branch only; tickets and tasks follow their organization-wide RLS.
 */

export type SearchSourceId =
  | "repairOrders"
  | "tickets"
  | "tasks"
  | "documents"
  | "containers"
  | "locations"
  | "items";

export type ExactHitType =
  | "repairOrder"
  | "ticket"
  | "task"
  | "document"
  | "container"
  | "location"
  | "item";

export interface SearchExactHit {
  type: ExactHitType;
  id: string;
  /** Main identifier shown in mono (number, code, SKU) */
  code: string;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  /** Internal route (next-intl pathname) */
  href: string;
  query?: Record<string, string>;
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
        href: `/dashboard/workshop/${row.id}`,
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
      href: `/dashboard/help-desk/tickets/${row.id}`,
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
      href: `/dashboard/planning/tasks/${row.id}`,
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
      href: `/dashboard/warehouse/inventory/movements/${row.id}`,
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
      href: `/dashboard/warehouse/containers/${row.id}`,
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
      href: "/dashboard/warehouse/locations",
      query: { selected: row.id, view: "tree" },
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
      href: `/dashboard/warehouse/items/${row.product_id}`,
    });
  }
  return hits;
}

export class GlobalSearchService {
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
