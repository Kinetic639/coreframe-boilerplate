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

type BranchTransferRow = {
  id: string;
  transfer_number: string;
  source_branch_id: string;
  destination_branch_id: string;
  source_movement_id: string | null;
  destination_movement_id: string | null;
  return_movement_id: string | null;
  status: string;
  notes: string | null;
  decline_reason: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
};

type BranchTransferLineRow = {
  id: string;
  transfer_id: string;
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
const TRANSFER_COLUMNS =
  "id, transfer_number, source_branch_id, destination_branch_id, source_movement_id, destination_movement_id, return_movement_id, status, notes, decline_reason, sent_at, accepted_at, declined_at, created_at" as const;
const TRANSFER_LINE_COLUMNS =
  "id, transfer_id, variant_id, source_location_id, destination_location_id, unit_id, quantity" as const;

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
      .select(HEADER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .or("reference_type.is.null,reference_type.neq.branch_transfer");

    if (params.search) {
      query = query.ilike("movement_number", `%${params.search}%`);
    }

    const status = params.filters.status;
    if (typeof status === "string" && status && status !== "in_transit") {
      query = query.eq("status", status);
    }

    const movementKind = params.filters.movement_kind;
    if (typeof movementKind === "string" && movementKind && movementKind !== "branch_transfer") {
      query = query.eq("movement_kind", movementKind);
    }

    const movementLimit = Math.min(Math.max(params.page * params.pageSize * 2, 100), 500);
    const { data, error } = await applyMovementSort(query, params.sort).limit(movementLimit);
    if (error) return { success: false, error: error.message };

    const movementRows = await InventoryMovementsService.enrichHeaders(
      supabase,
      orgId,
      branchId,
      (data ?? []) as MovementHeaderRow[]
    );
    if (!movementRows.success)
      return {
        success: false,
        error: (movementRows as { success: false; error: string }).error,
      };

    const transferRows = await InventoryMovementsService.listBranchTransferOperationRows(
      supabase,
      orgId,
      branchId,
      params
    );
    if (!transferRows.success)
      return {
        success: false,
        error: (transferRows as { success: false; error: string }).error,
      };

    const mergedRows = [...movementRows.data, ...transferRows.data]
      .filter((row) => {
        if (typeof movementKind === "string" && movementKind && row.movement_kind !== movementKind)
          return false;
        if (typeof status === "string" && status && row.status !== status) return false;
        if (!params.search) return true;
        const search = params.search.toLowerCase();
        return [
          row.movement_number,
          row.reference,
          row.product_names,
          row.source_branch_name,
          row.destination_branch_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((a, b) => {
        const field = params.sort?.field ?? "created_at";
        const direction = params.sort?.direction === "asc" ? 1 : -1;
        const aValue = String((a as unknown as Record<string, unknown>)[field] ?? "");
        const bValue = String((b as unknown as Record<string, unknown>)[field] ?? "");
        return aValue.localeCompare(bValue) * direction;
      });

    const from = (params.page - 1) * params.pageSize;
    const rows = mergedRows.slice(from, from + params.pageSize);

    return {
      success: true,
      data: {
        rows,
        totalCount: mergedRows.length,
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
    if (movementId.startsWith("branch-transfer:")) {
      return InventoryMovementsService.getBranchTransferDetail(
        supabase,
        orgId,
        branchId,
        movementId.replace("branch-transfer:", "")
      );
    }

    const { data, error } = await supabase
      .from("inventory_movement_headers")
      .select(HEADER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("id", movementId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return InventoryMovementsService.getBranchTransferDetail(
        supabase,
        orgId,
        branchId,
        movementId
      );
    }

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
        operation_type: "movement",
        note: (data as MovementHeaderRow).note,
        reason_code: (data as MovementHeaderRow).reason_code,
        related_documents: [],
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
          operation_type: "movement",
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

  private static async listBranchTransferOperationRows(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<InventoryMovementListRow[]>> {
    let query = supabase
      .from("inventory_branch_transfers")
      .select(TRANSFER_COLUMNS)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (params.search) {
      query = query.ilike("transfer_number", `%${params.search}%`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const transfers = (data ?? []) as BranchTransferRow[];
    const transferIds = transfers.map((transfer) => transfer.id);
    const branchIds = [
      ...new Set(
        transfers.flatMap((transfer) => [transfer.source_branch_id, transfer.destination_branch_id])
      ),
    ];

    const { data: branchesData, error: branchesError } = branchIds.length
      ? await supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", branchIds)
      : { data: [], error: null };
    if (branchesError) return { success: false, error: branchesError.message };

    const { data: linesData, error: linesError } = transferIds.length
      ? await supabase
          .from("inventory_branch_transfer_lines")
          .select("transfer_id, variant_id")
          .eq("organization_id", orgId)
          .in("transfer_id", transferIds)
      : { data: [], error: null };
    if (linesError) return { success: false, error: linesError.message };

    const branchesById = new Map(
      ((branchesData ?? []) as Array<{ id: string; name: string }>).map((branch) => [
        branch.id,
        branch.name,
      ])
    );
    const lineCounts = new Map<string, number>();
    const transferProductNames = new Map<string, Set<string>>();
    const transferLines = (linesData ?? []) as Array<{ transfer_id: string; variant_id: string }>;
    const variantIds = [...new Set(transferLines.map((line) => line.variant_id))];
    const { data: variantsData, error: variantsError } = variantIds.length
      ? await supabase
          .from("inventory_variants")
          .select("id, product_id")
          .eq("organization_id", orgId)
          .in("id", variantIds)
      : { data: [], error: null };
    if (variantsError) return { success: false, error: variantsError.message };

    const variants = (variantsData ?? []) as Array<{ id: string; product_id: string }>;
    const productIds = [...new Set(variants.map((variant) => variant.product_id))];
    const { data: productsData, error: productsError } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) return { success: false, error: productsError.message };

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const productsById = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((product) => [
        product.id,
        product,
      ])
    );

    for (const line of transferLines) {
      lineCounts.set(line.transfer_id, (lineCounts.get(line.transfer_id) ?? 0) + 1);
      const product = productsById.get(variantsById.get(line.variant_id)?.product_id ?? "");
      if (product?.name) {
        const names = transferProductNames.get(line.transfer_id) ?? new Set<string>();
        names.add(product.name);
        transferProductNames.set(line.transfer_id, names);
      }
    }

    return {
      success: true,
      data: transfers.map((transfer) => {
        const source = branchesById.get(transfer.source_branch_id) ?? "";
        const destination = branchesById.get(transfer.destination_branch_id) ?? "";
        return {
          id: transfer.id,
          operation_type: "branch_transfer",
          movement_number: transfer.transfer_number,
          movement_kind: "branch_transfer",
          adjustment_direction: null,
          status: transfer.status,
          reference: [source, destination].filter(Boolean).join(" -> "),
          line_count: lineCounts.get(transfer.id) ?? 0,
          product_names: [...(transferProductNames.get(transfer.id) ?? [])].join(", "),
          created_by: null,
          created_at: transfer.created_at,
          posted_at: transfer.accepted_at ?? transfer.declined_at ?? transfer.sent_at,
          source_branch_id: transfer.source_branch_id,
          source_branch_name: source,
          destination_branch_id: transfer.destination_branch_id,
          destination_branch_name: destination,
        };
      }),
    };
  }

  private static async getBranchTransferDetail(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    transferId: string
  ): Promise<ServiceResult<InventoryMovementDetail | null>> {
    const { data, error } = await supabase
      .from("inventory_branch_transfers")
      .select(TRANSFER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("id", transferId)
      .is("deleted_at", null)
      .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    const transfer = data as BranchTransferRow;
    const { data: branchesData, error: branchesError } = await supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", [transfer.source_branch_id, transfer.destination_branch_id]);
    if (branchesError) return { success: false, error: branchesError.message };

    const branchesById = new Map(
      ((branchesData ?? []) as Array<{ id: string; name: string }>).map((branch) => [
        branch.id,
        branch.name,
      ])
    );

    const { data: linesData, error: linesError } = await supabase
      .from("inventory_branch_transfer_lines")
      .select(TRANSFER_LINE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("transfer_id", transferId)
      .order("created_at", { ascending: true });
    if (linesError) return { success: false, error: linesError.message };

    const lines = await InventoryMovementsService.enrichBranchTransferLines(
      supabase,
      orgId,
      (linesData ?? []) as BranchTransferLineRow[]
    );
    if (!lines.success)
      return { success: false, error: (lines as { success: false; error: string }).error };

    const source = branchesById.get(transfer.source_branch_id) ?? "";
    const destination = branchesById.get(transfer.destination_branch_id) ?? "";
    const relatedDocuments = await InventoryMovementsService.listRelatedBranchTransferDocuments(
      supabase,
      orgId,
      branchId,
      transfer
    );
    if (!relatedDocuments.success)
      return {
        success: false,
        error: (relatedDocuments as { success: false; error: string }).error,
      };

    return {
      success: true,
      data: {
        id: transfer.id,
        operation_type: "branch_transfer",
        movement_number: transfer.transfer_number,
        movement_kind: "branch_transfer",
        adjustment_direction: null,
        status: transfer.status,
        reference: [source, destination].filter(Boolean).join(" -> "),
        line_count: lines.data.length,
        product_names: [...new Set(lines.data.map((line) => line.product_name))].join(", "),
        created_by: null,
        created_at: transfer.created_at,
        posted_at: transfer.accepted_at ?? transfer.declined_at ?? transfer.sent_at,
        source_branch_id: transfer.source_branch_id,
        source_branch_name: source,
        destination_branch_id: transfer.destination_branch_id,
        destination_branch_name: destination,
        note: transfer.notes,
        decline_reason: transfer.decline_reason,
        reason_code: null,
        related_documents: relatedDocuments.data,
        lines: lines.data,
      },
    };
  }

  private static async listRelatedBranchTransferDocuments(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    transfer: BranchTransferRow
  ): Promise<ServiceResult<NonNullable<InventoryMovementDetail["related_documents"]>>> {
    const documentIds = [
      { id: transfer.source_movement_id, document_role: "source_issue" as const },
      { id: transfer.destination_movement_id, document_role: "destination_receipt" as const },
      { id: transfer.return_movement_id, document_role: "return_receipt" as const },
    ].filter(
      (
        document
      ): document is {
        id: string;
        document_role: "source_issue" | "destination_receipt" | "return_receipt";
      } => Boolean(document.id)
    );

    if (documentIds.length === 0) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("inventory_movement_headers")
      .select(HEADER_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in(
        "id",
        documentIds.map((document) => document.id)
      )
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };

    const movementRows = await InventoryMovementsService.enrichHeaders(
      supabase,
      orgId,
      branchId,
      (data ?? []) as MovementHeaderRow[]
    );
    if (!movementRows.success)
      return { success: false, error: (movementRows as { success: false; error: string }).error };

    const roleById = new Map(documentIds.map((document) => [document.id, document.document_role]));
    return {
      success: true,
      data: movementRows.data.map((movement) => ({
        ...movement,
        operation_type: "movement" as const,
        document_role: roleById.get(movement.id) ?? "movement",
      })),
    };
  }

  private static async enrichBranchTransferLines(
    supabase: SupabaseClient,
    orgId: string,
    lines: BranchTransferLineRow[]
  ): Promise<ServiceResult<InventoryMovementDetail["lines"]>> {
    if (lines.length === 0) return { success: true, data: [] };

    const variantIds = [...new Set(lines.map((line) => line.variant_id))];
    const unitIds = [...new Set(lines.map((line) => line.unit_id))];
    const locationIds = [
      ...new Set(
        lines
          .flatMap((line) => [line.source_location_id, line.destination_location_id])
          .filter((id): id is string => !!id)
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
          .in("id", locationIds)
      : { data: [], error: null };
    if (locationsError) return { success: false, error: locationsError.message };

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
      data: lines.map((line) => {
        const variant = variantsById.get(line.variant_id);
        const product = variant ? productsById.get(variant.product_id) : undefined;
        return {
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
        };
      }),
    };
  }
}
