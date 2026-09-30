import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface ContainerContentLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  quantity: number;
  unitCode: string | null;
}

export interface ContainerLocationRef {
  id: string;
  name: string;
  code: string | null;
}

export interface ContainerRepairOrderRef {
  id: string;
  zlNumber: string | null;
  clientName: string | null;
  vehicleBrand: string | null;
  vin: string | null;
}

export interface ContainerDetail {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  type: string;
  status: string;
  currentLocation: ContainerLocationRef | null;
  repairOrder: ContainerRepairOrderRef | null;
  lines: ContainerContentLine[];
  createdAt: string;
  updatedAt: string;
}

export interface RepairOrderContainerSummary {
  id: string;
  code: string;
  status: string;
  currentLocation: ContainerLocationRef | null;
  lineCount: number;
  totalQuantity: number;
}

type ContainerRow = {
  id: string;
  organization_id: string;
  branch_id: string;
  code: string;
  type: string;
  status: string;
  current_location_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
};

type ContainerLineRow = {
  id: string;
  container_id: string;
  variant_id: string;
  unit_id: string;
  quantity: number | string;
};

const CONTAINER_COLUMNS =
  "id, organization_id, branch_id, code, type, status, current_location_id, reference_type, reference_id, created_at, updated_at";

/**
 * Phase 10D: read models for physical containers (Phase 10C tables).
 *
 * Every read runs on the caller's own RLS-enforced client:
 * `inventory_containers_select` / `inventory_container_lines_select` require
 * `warehouse.inventory.read` on the container's own branch, so a caller
 * without access to that branch simply gets "not found" -- never another
 * branch's contents.
 */
export class InventoryContainersService {
  static async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    containerId: string
  ): Promise<ServiceResult<ContainerDetail | null>> {
    const { data, error } = await supabase
      .from("inventory_containers")
      .select(CONTAINER_COLUMNS)
      .eq("id", containerId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: "Failed to load container" };
    if (!data) return { success: true, data: null };

    const row = data as ContainerRow;

    const [linesResult, locations, repairOrder] = await Promise.all([
      InventoryContainersService.loadLines(supabase, orgId, [row.id]),
      InventoryContainersService.loadLocations(
        supabase,
        orgId,
        row.current_location_id ? [row.current_location_id] : []
      ),
      InventoryContainersService.loadRepairOrder(supabase, orgId, row),
    ]);

    if (!linesResult.success) {
      return { success: false, error: (linesResult as { success: false; error: string }).error };
    }

    return {
      success: true,
      data: {
        id: row.id,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        code: row.code,
        type: row.type,
        status: row.status,
        currentLocation: row.current_location_id
          ? (locations.get(row.current_location_id) ?? null)
          : null,
        repairOrder,
        lines: linesResult.data.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  }

  static async listForRepairOrder(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    repairOrderId: string
  ): Promise<ServiceResult<RepairOrderContainerSummary[]>> {
    let query = supabase
      .from("inventory_containers")
      .select(CONTAINER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("reference_type", "repair_order")
      .eq("reference_id", repairOrderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load containers" };

    const rows = (data ?? []) as ContainerRow[];
    if (rows.length === 0) return { success: true, data: [] };

    const [linesResult, locations] = await Promise.all([
      InventoryContainersService.loadLines(
        supabase,
        orgId,
        rows.map((r) => r.id)
      ),
      InventoryContainersService.loadLocations(
        supabase,
        orgId,
        rows.map((r) => r.current_location_id).filter((id): id is string => !!id)
      ),
    ]);
    if (!linesResult.success) {
      return { success: false, error: (linesResult as { success: false; error: string }).error };
    }

    return {
      success: true,
      data: rows.map((row) => {
        const lines = linesResult.data.get(row.id) ?? [];
        return {
          id: row.id,
          code: row.code,
          status: row.status,
          currentLocation: row.current_location_id
            ? (locations.get(row.current_location_id) ?? null)
            : null,
          lineCount: lines.length,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        };
      }),
    };
  }

  /**
   * Next free container code for a RepairOrder: `K-<ZL>-NN`, NN counting
   * this RepairOrder's existing containers (in any branch the caller can
   * read). Only a suggestion -- the user may edit it before creating.
   */
  static suggestCode(zlNumber: string | null, existingCodes: string[]): string {
    const base = `K-${zlNumber ?? "ZL"}-`;
    let n = existingCodes.length + 1;
    const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
    while (taken.has(`${base}${String(n).padStart(2, "0")}`.toUpperCase())) n += 1;
    return `${base}${String(n).padStart(2, "0")}`;
  }

  private static async loadLines(
    supabase: SupabaseClient,
    orgId: string,
    containerIds: string[]
  ): Promise<ServiceResult<Map<string, ContainerContentLine[]>>> {
    const result = new Map<string, ContainerContentLine[]>();
    if (containerIds.length === 0) return { success: true, data: result };

    const { data, error } = await supabase
      .from("inventory_container_lines")
      .select("id, container_id, variant_id, unit_id, quantity")
      .eq("organization_id", orgId)
      .in("container_id", containerIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: "Failed to load container contents" };

    const lines = (data ?? []) as ContainerLineRow[];
    const variantIds = [...new Set(lines.map((l) => l.variant_id))];
    const unitIds = [...new Set(lines.map((l) => l.unit_id))];

    const [variantsRes, unitsRes] = await Promise.all([
      variantIds.length
        ? supabase
            .from("inventory_variants")
            .select("id, product_id, sku")
            .eq("organization_id", orgId)
            .in("id", variantIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      unitIds.length
        ? supabase
            .from("inventory_units")
            .select("id, code")
            .eq("organization_id", orgId)
            .in("id", unitIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    const variants = (variantsRes.data ?? []) as Array<{
      id: string;
      product_id: string;
      sku: string;
    }>;
    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const { data: productsData } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [] as unknown[] };

    const productName = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name])
    );
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const unitCode = new Map(
      ((unitsRes.data ?? []) as Array<{ id: string; code: string }>).map((u) => [u.id, u.code])
    );

    for (const line of lines) {
      const variant = variantById.get(line.variant_id);
      const entry: ContainerContentLine = {
        id: line.id,
        variantId: line.variant_id,
        sku: variant?.sku ?? null,
        productName: variant ? (productName.get(variant.product_id) ?? null) : null,
        quantity: Number(line.quantity),
        unitCode: unitCode.get(line.unit_id) ?? null,
      };
      const bucket = result.get(line.container_id);
      if (bucket) bucket.push(entry);
      else result.set(line.container_id, [entry]);
    }

    return { success: true, data: result };
  }

  private static async loadLocations(
    supabase: SupabaseClient,
    orgId: string,
    locationIds: string[]
  ): Promise<Map<string, ContainerLocationRef>> {
    const result = new Map<string, ContainerLocationRef>();
    const ids = [...new Set(locationIds)];
    if (ids.length === 0) return result;

    const { data } = await supabase
      .from("warehouse_locations")
      .select("id, name, code")
      .eq("organization_id", orgId)
      .in("id", ids);

    for (const loc of (data ?? []) as Array<{ id: string; name: string; code: string | null }>) {
      result.set(loc.id, { id: loc.id, name: loc.name, code: loc.code });
    }
    return result;
  }

  private static async loadRepairOrder(
    supabase: SupabaseClient,
    orgId: string,
    row: ContainerRow
  ): Promise<ContainerRepairOrderRef | null> {
    if (row.reference_type !== "repair_order" || !row.reference_id) return null;

    const { data } = await supabase
      .from("repair_orders")
      .select("id, zl_number, client_name, vehicle_brand, vin")
      .eq("id", row.reference_id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    const ro = data as {
      id: string;
      zl_number: string | null;
      client_name: string | null;
      vehicle_brand: string | null;
      vin: string | null;
    } | null;
    if (!ro) return null;

    return {
      id: ro.id,
      zlNumber: ro.zl_number,
      clientName: ro.client_name,
      vehicleBrand: ro.vehicle_brand,
      vin: ro.vin,
    };
  }
}
