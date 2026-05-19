import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type {
  CreateDraftMovementInput,
  InventoryMovementDetail,
  InventoryMovementLineInput,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";
export type {
  CreateDraftMovementInput,
  InventoryMovementDetail,
  InventoryMovementLineInput,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

type MovementHeaderRow = {
  id: string;
  movement_number: string;
  movement_kind: string;
  adjustment_direction: string | null;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
  posted_at: string | null;
  note: string | null;
  reason_code: string | null;
};

type MovementLineRow = {
  id: string;
  movement_id: string;
  variant_id: string;
  source_location_id: string | null;
  destination_location_id: string | null;
  unit_id: string;
  quantity: number;
};

const HEADER_COLUMNS =
  "id, movement_number, movement_kind, adjustment_direction, status, reference_type, reference_id, created_by, created_at, posted_at, note, reason_code" as const;
const LINE_COLUMNS =
  "id, movement_id, variant_id, source_location_id, destination_location_id, unit_id, quantity" as const;

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function applyMovementSort(query: any, sort: DataViewListParams["sort"]) {
  const sortMap: Record<string, string> = {
    movement_number: "movement_number",
    movement_kind: "movement_kind",
    status: "status",
    created_at: "created_at",
    posted_at: "posted_at",
  };
  const field = sort?.field ? sortMap[sort.field] : "created_at";
  return query.order(field ?? "created_at", { ascending: sort?.direction === "asc" });
}

export class InventoryMovementsService {
  static async listMovements(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<InventoryMovementListRow>>> {
    let query = supabase
      .from("inventory_movement_headers")
      .select(HEADER_COLUMNS, { count: "exact" })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);

    if (params.search) {
      query = query.ilike("movement_number", `%${params.search}%`);
    }

    const status = params.filters.status;
    if (typeof status === "string" && status) query = query.eq("status", status);

    const movementKind = params.filters.movement_kind;
    if (typeof movementKind === "string" && movementKind) {
      query = query.eq("movement_kind", movementKind);
    }

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    const { data, error, count } = await applyMovementSort(query, params.sort).range(from, to);
    if (error) return { success: false, error: error.message };

    const rows = await InventoryMovementsService.enrichHeaders(
      supabase,
      orgId,
      branchId,
      (data ?? []) as MovementHeaderRow[]
    );
    if (!rows.success)
      return { success: false, error: (rows as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        rows: rows.data,
        totalCount: count ?? rows.data.length,
        page: params.page,
        pageSize: params.pageSize,
      },
    };
  }

  static async getMovementDetail(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementId: string
  ): Promise<ServiceResult<InventoryMovementDetail | null>> {
    const { data, error } = await supabase
      .from("inventory_movement_headers")
      .select(HEADER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("id", movementId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    const enriched = await InventoryMovementsService.enrichHeaders(supabase, orgId, branchId, [
      data as MovementHeaderRow,
    ]);
    if (!enriched.success)
      return { success: false, error: (enriched as { success: false; error: string }).error };

    const linesResult = await InventoryMovementsService.enrichLines(supabase, orgId, branchId, [
      movementId,
    ]);
    if (!linesResult.success)
      return { success: false, error: (linesResult as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        ...enriched.data[0],
        note: (data as MovementHeaderRow).note,
        reason_code: (data as MovementHeaderRow).reason_code,
        lines: linesResult.data.get(movementId) ?? [],
      },
    };
  }

  static async createDraftMovement(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateDraftMovementInput,
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; movement_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_create_draft_movement", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_movement_kind: input.movement_kind,
      p_adjustment_direction: input.adjustment_direction ?? null,
      p_lines: input.lines,
      p_reason_id: input.reason_id ?? null,
      p_note: input.note ?? null,
      p_reference_type: input.reference_type ?? null,
      p_reference_id: input.reference_id ?? null,
      p_idempotency_key: input.idempotency_key ?? null,
      p_actor_user_id: userId,
    });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: data as { movement_id: string; movement_number: string; status: string },
    };
  }

  static async postMovement(
    supabase: SupabaseClient,
    movementId: string,
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; movement_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_post_movement", {
      p_movement_id: movementId,
      p_actor_user_id: userId,
    });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: data as { movement_id: string; movement_number: string; status: string },
    };
  }

  static async reverseMovement(
    supabase: SupabaseClient,
    movementId: string,
    userId: string,
    note?: string | null
  ): Promise<ServiceResult<{ movement_id: string; movement_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_reverse_movement", {
      p_movement_id: movementId,
      p_actor_user_id: userId,
      p_note: note ?? null,
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: data as { movement_id: string; movement_number: string; status: string },
    };
  }

  private static async enrichHeaders(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    headers: MovementHeaderRow[]
  ): Promise<ServiceResult<InventoryMovementListRow[]>> {
    if (headers.length === 0) return { success: true, data: [] };

    const linesResult = await InventoryMovementsService.enrichLines(
      supabase,
      orgId,
      branchId,
      headers.map((h) => h.id)
    );
    if (!linesResult.success)
      return { success: false, error: (linesResult as { success: false; error: string }).error };

    return {
      success: true,
      data: headers.map((header) => {
        const lines = linesResult.data.get(header.id) ?? [];
        const productNames = [...new Set(lines.map((l) => l.product_name).filter(Boolean))];
        return {
          id: header.id,
          movement_number: header.movement_number,
          movement_kind: header.movement_kind,
          adjustment_direction: header.adjustment_direction,
          status: header.status,
          reference:
            header.reference_type && header.reference_id
              ? `${header.reference_type}:${header.reference_id}`
              : null,
          line_count: lines.length,
          product_names: productNames.join(", "),
          created_by: header.created_by,
          created_at: header.created_at,
          posted_at: header.posted_at,
        };
      }),
    };
  }

  private static async enrichLines(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementIds: string[]
  ): Promise<ServiceResult<Map<string, InventoryMovementDetail["lines"]>>> {
    if (movementIds.length === 0) return { success: true, data: new Map() };

    const { data: linesData, error: linesError } = await supabase
      .from("inventory_movement_lines")
      .select(LINE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("movement_id", movementIds)
      .is("deleted_at", null)
      .order("line_number", { ascending: true });
    if (linesError) return { success: false, error: linesError.message };

    const lines = (linesData ?? []) as MovementLineRow[];
    const variantIds = [...new Set(lines.map((l) => l.variant_id))];
    const unitIds = [...new Set(lines.map((l) => l.unit_id))];
    const locationIds = [
      ...new Set(
        lines
          .flatMap((l) => [l.source_location_id, l.destination_location_id])
          .filter((id): id is string => !!id)
      ),
    ];

    const { data: variantsData, error: variantsError } = variantIds.length
      ? await supabase
          .from("inventory_variants")
          .select("id, product_id, sku")
          .eq("organization_id", orgId)
          .in("id", variantIds)
      : { data: [], error: null };
    if (variantsError) return { success: false, error: variantsError.message };

    const variants = (variantsData ?? []) as Array<{ id: string; product_id: string; sku: string }>;
    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const { data: productsData, error: productsError } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) return { success: false, error: productsError.message };

    const { data: unitsData, error: unitsError } = unitIds.length
      ? await supabase
          .from("inventory_units")
          .select("id, code")
          .eq("organization_id", orgId)
          .in("id", unitIds)
      : { data: [], error: null };
    if (unitsError) return { success: false, error: unitsError.message };

    const { data: locationsData, error: locationsError } = locationIds.length
      ? await supabase
          .from("warehouse_locations")
          .select("id, name")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("id", locationIds)
      : { data: [], error: null };
    if (locationsError) return { success: false, error: locationsError.message };

    const variantsById = new Map(variants.map((v) => [v.id, v]));
    const productsById = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p])
    );
    const unitsById = new Map(
      ((unitsData ?? []) as Array<{ id: string; code: string }>).map((u) => [u.id, u])
    );
    const locationsById = new Map(
      ((locationsData ?? []) as Array<{ id: string; name: string }>).map((l) => [l.id, l])
    );
    const byMovement = new Map<string, InventoryMovementDetail["lines"]>();

    for (const line of lines) {
      const variant = variantsById.get(line.variant_id);
      const product = variant ? productsById.get(variant.product_id) : undefined;
      const list = byMovement.get(line.movement_id) ?? [];
      list.push({
        id: line.id,
        sku: variant?.sku ?? "",
        product_name: product?.name ?? "",
        quantity: toNumber(line.quantity),
        unit_code: unitsById.get(line.unit_id)?.code ?? "",
        source_location_name: line.source_location_id
          ? (locationsById.get(line.source_location_id)?.name ?? null)
          : null,
        destination_location_name: line.destination_location_id
          ? (locationsById.get(line.destination_location_id)?.name ?? null)
          : null,
      });
      byMovement.set(line.movement_id, list);
    }

    return { success: true, data: byMovement };
  }
}
