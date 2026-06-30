import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AmbraLocationInventorySnapshot,
  ContainerLine,
  LocationContainer,
  LocationInventoryLine,
  LocationMovementLine,
  LocationPutawayRule,
} from "@/app/[locale]/dashboard/warehouse/ambra-locations/_ambra/types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

type BalanceRow = {
  id: string;
  location_id: string;
  variant_id: string;
  on_hand_quantity: number | string;
  available_quantity: number | string | null;
  reserved_quantity: number | string;
  allocated_quantity: number | string;
  last_movement_id: string | null;
};

type MovementLineRow = {
  id: string;
  movement_id: string;
  variant_id: string;
  source_location_id: string | null;
  destination_location_id: string | null;
  unit_id: string;
  quantity: number | string;
};

type MovementHeaderRow = {
  id: string;
  document_number: string | null;
  draft_number: string | null;
  movement_type_code: string;
  status: string;
  created_at: string;
  posted_at: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message ?? "");
}

export class AmbraLocationInventoryService {
  static async getSnapshot(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<AmbraLocationInventorySnapshot>> {
    const [balances, movements, containers, putawayRules] = await Promise.all([
      AmbraLocationInventoryService.listBalances(supabase, orgId, branchId),
      AmbraLocationInventoryService.listMovements(supabase, orgId, branchId),
      AmbraLocationInventoryService.listContainers(supabase, orgId, branchId),
      AmbraLocationInventoryService.listPutawayRules(supabase, orgId, branchId),
    ]);

    if (balances.success === false) return { success: false, error: balances.error };
    if (movements.success === false) return { success: false, error: movements.error };
    if (containers.success === false) return { success: false, error: containers.error };
    if (putawayRules.success === false) return { success: false, error: putawayRules.error };

    return {
      success: true,
      data: {
        balances: balances.data,
        movements: movements.data,
        containers: containers.data,
        putawayRules: putawayRules.data,
      },
    };
  }

  private static async listBalances(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<LocationInventoryLine[]>> {
    const { data, error } = await supabase
      .from("inventory_balances")
      .select(
        "id, location_id, variant_id, on_hand_quantity, available_quantity, reserved_quantity, allocated_quantity, last_movement_id"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .gt("on_hand_quantity", 0)
      .limit(2000);
    if (error) return { success: false, error: error.message };

    const balances = (data ?? []) as BalanceRow[];
    if (balances.length === 0) return { success: true, data: [] };

    const variantIds = [...new Set(balances.map((balance) => balance.variant_id))];
    const movementIds = [
      ...new Set(
        balances
          .map((balance) => balance.last_movement_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const { data: variantsData, error: variantsError } = await supabase
      .from("inventory_variants")
      .select("id, product_id, sku")
      .eq("organization_id", orgId)
      .in("id", variantIds);
    if (variantsError) return { success: false, error: variantsError.message };

    const variants = (variantsData ?? []) as Array<{ id: string; product_id: string; sku: string }>;
    const productIds = [...new Set(variants.map((variant) => variant.product_id))];
    const { data: productsData, error: productsError } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name, base_unit_id")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) return { success: false, error: productsError.message };

    const products = (productsData ?? []) as Array<{
      id: string;
      name: string;
      base_unit_id: string;
    }>;
    const unitIds = [...new Set(products.map((product) => product.base_unit_id))];
    const { data: unitsData, error: unitsError } = unitIds.length
      ? await supabase
          .from("inventory_units")
          .select("id, code")
          .eq("organization_id", orgId)
          .in("id", unitIds)
      : { data: [], error: null };
    if (unitsError) return { success: false, error: unitsError.message };

    const { data: movementsData, error: movementsError } = movementIds.length
      ? await supabase
          .from("inventory_movement_headers")
          .select("id, document_number, draft_number")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("id", movementIds)
      : { data: [], error: null };
    if (movementsError) return { success: false, error: movementsError.message };

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const unitsById = new Map(
      ((unitsData ?? []) as Array<{ id: string; code: string }>).map((unit) => [unit.id, unit])
    );
    const movementsById = new Map(
      (
        (movementsData ?? []) as Array<{
          id: string;
          document_number: string | null;
          draft_number: string | null;
        }>
      ).map((movement) => [movement.id, movement])
    );

    return {
      success: true,
      data: balances.map((balance) => {
        const variant = variantsById.get(balance.variant_id);
        const product = variant ? productsById.get(variant.product_id) : undefined;
        const unit = product ? unitsById.get(product.base_unit_id) : undefined;
        const movement = balance.last_movement_id
          ? movementsById.get(balance.last_movement_id)
          : undefined;

        return {
          id: balance.id,
          locationId: balance.location_id,
          variantId: balance.variant_id,
          sku: variant?.sku ?? "",
          productName: product?.name ?? "",
          unitCode: unit?.code ?? "",
          onHandQuantity: toNumber(balance.on_hand_quantity),
          availableQuantity: toNumber(balance.available_quantity),
          reservedQuantity: toNumber(balance.reserved_quantity),
          allocatedQuantity: toNumber(balance.allocated_quantity),
          lastMovementNumber: movement?.document_number ?? movement?.draft_number ?? null,
          containerId: null,
          containerCode: null,
        };
      }),
    };
  }

  private static async listMovements(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<LocationMovementLine[]>> {
    const { data, error } = await supabase
      .from("inventory_movement_lines")
      .select(
        "id, movement_id, variant_id, source_location_id, destination_location_id, unit_id, quantity"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { success: false, error: error.message };

    const lines = (data ?? []) as MovementLineRow[];
    if (lines.length === 0) return { success: true, data: [] };

    const movementIds = [...new Set(lines.map((line) => line.movement_id))];
    const variantIds = [...new Set(lines.map((line) => line.variant_id))];
    const unitIds = [...new Set(lines.map((line) => line.unit_id))];
    const locationIds = [
      ...new Set(
        lines
          .flatMap((line) => [line.source_location_id, line.destination_location_id])
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const { data: headersData, error: headersError } = await supabase
      .from("inventory_movement_headers")
      .select(
        "id, document_number, draft_number, movement_type_code, status, created_at, posted_at"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("id", movementIds);
    if (headersError) return { success: false, error: headersError.message };

    const { data: variantsData, error: variantsError } = await supabase
      .from("inventory_variants")
      .select("id, product_id, sku")
      .eq("organization_id", orgId)
      .in("id", variantIds);
    if (variantsError) return { success: false, error: variantsError.message };

    const variants = (variantsData ?? []) as Array<{ id: string; product_id: string; sku: string }>;
    const productIds = [...new Set(variants.map((variant) => variant.product_id))];
    const { data: productsData, error: productsError } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) return { success: false, error: productsError.message };

    const { data: unitsData, error: unitsError } = await supabase
      .from("inventory_units")
      .select("id, code")
      .eq("organization_id", orgId)
      .in("id", unitIds);
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

    const headersById = new Map(
      ((headersData ?? []) as MovementHeaderRow[]).map((row) => [row.id, row])
    );
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const productsById = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((product) => [
        product.id,
        product,
      ])
    );
    const unitsById = new Map(
      ((unitsData ?? []) as Array<{ id: string; code: string }>).map((unit) => [unit.id, unit])
    );
    const locationsById = new Map(
      ((locationsData ?? []) as Array<{ id: string; name: string }>).map((location) => [
        location.id,
        location,
      ])
    );

    return {
      success: true,
      data: lines
        .map((line): LocationMovementLine | null => {
          const header = headersById.get(line.movement_id);
          if (!header) return null;
          const variant = variantsById.get(line.variant_id);
          const product = variant ? productsById.get(variant.product_id) : undefined;
          return {
            id: line.id,
            movementId: line.movement_id,
            movementNumber: header.document_number ?? header.draft_number ?? "",
            movementKind: header.movement_type_code,
            status: header.status,
            variantId: line.variant_id,
            sku: variant?.sku ?? "",
            productName: product?.name ?? "",
            unitCode: unitsById.get(line.unit_id)?.code ?? "",
            quantity: toNumber(line.quantity),
            sourceLocationId: line.source_location_id,
            sourceLocationName: line.source_location_id
              ? (locationsById.get(line.source_location_id)?.name ?? null)
              : null,
            destinationLocationId: line.destination_location_id,
            destinationLocationName: line.destination_location_id
              ? (locationsById.get(line.destination_location_id)?.name ?? null)
              : null,
            containerId: null,
            containerCode: null,
            createdAt: header.created_at,
            postedAt: header.posted_at,
          };
        })
        .filter((line): line is LocationMovementLine => line !== null),
    };
  }

  private static async listContainers(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<LocationContainer[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_containers")
      .select(
        "id, code, type, status, current_location_id, reference_type, reference_id, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (isMissingRelationError(error)) return { success: true, data: [] };
    if (error) return { success: false, error: error.message };

    const containers = (data ?? []) as Array<{
      id: string;
      code: string;
      type: string;
      status: string;
      current_location_id: string;
      reference_type: string | null;
      reference_id: string | null;
      created_at: string;
      updated_at: string;
    }>;

    if (containers.length === 0) return { success: true, data: [] };

    const containerIds = containers.map((c) => c.id);
    const { data: linesData, error: linesError } = await client
      .from("inventory_container_lines")
      .select("id, container_id, variant_id, unit_id, quantity")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .in("container_id", containerIds);

    if (isMissingRelationError(linesError)) {
      return {
        success: true,
        data: containers.map((row) => ({
          id: row.id,
          code: row.code,
          type: row.type,
          status: row.status,
          currentLocationId: row.current_location_id,
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          lines: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      };
    }
    if (linesError) return { success: false, error: linesError.message };

    const rawLines = (linesData ?? []) as Array<{
      id: string;
      container_id: string;
      variant_id: string;
      unit_id: string;
      quantity: number | string;
    }>;

    const variantIds = [...new Set(rawLines.map((l) => l.variant_id))];
    const unitIds = [...new Set(rawLines.map((l) => l.unit_id))];

    const [variantsRes, unitsRes] = await Promise.all([
      variantIds.length
        ? supabase
            .from("inventory_variants")
            .select("id, product_id, sku")
            .eq("organization_id", orgId)
            .in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length
        ? supabase
            .from("inventory_units")
            .select("id, code")
            .eq("organization_id", orgId)
            .in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
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
      : { data: [] };

    const variantsById = new Map(variants.map((v) => [v.id, v]));
    const productsById = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p])
    );
    const unitsById = new Map(
      ((unitsRes.data ?? []) as Array<{ id: string; code: string }>).map((u) => [u.id, u])
    );

    const linesByContainer = new Map<string, ContainerLine[]>();
    for (const line of rawLines) {
      const variant = variantsById.get(line.variant_id);
      const product = variant ? productsById.get(variant.product_id) : undefined;
      const unit = unitsById.get(line.unit_id);
      const bucket = linesByContainer.get(line.container_id) ?? [];
      bucket.push({
        id: line.id,
        containerId: line.container_id,
        variantId: line.variant_id,
        unitId: line.unit_id,
        quantity: toNumber(line.quantity),
        sku: variant?.sku ?? "",
        productName: product?.name ?? "",
        unitCode: unit?.code ?? "",
      });
      linesByContainer.set(line.container_id, bucket);
    }

    return {
      success: true,
      data: containers.map((row) => ({
        id: row.id,
        code: row.code,
        type: row.type,
        status: row.status,
        currentLocationId: row.current_location_id,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        lines: linesByContainer.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  private static async listPutawayRules(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<LocationPutawayRule[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_putaway_rules")
      .select(
        "id, branch_id, product_id, variant_id, product_category, destination_location_id, priority, is_active"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .limit(500);

    if (isMissingRelationError(error)) return { success: true, data: [] };
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (
        (data ?? []) as Array<{
          id: string;
          branch_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_category: string | null;
          destination_location_id: string;
          priority: number;
          is_active: boolean;
        }>
      ).map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        productId: row.product_id,
        variantId: row.variant_id,
        productCategory: row.product_category,
        destinationLocationId: row.destination_location_id,
        priority: row.priority,
        isActive: row.is_active,
      })),
    };
  }
}
