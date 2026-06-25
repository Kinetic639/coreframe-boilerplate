import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type {
  CreateDraftMovementInput,
  InventoryMovementDetail,
  InventoryMovementListRow,
  InventoryMovementType,
  InventoryMovementAuditEntry,
  InventoryPickerItem,
  LocationVariantStock,
} from "@/lib/warehouse/inventory-types";
export type {
  CreateDraftMovementInput,
  InventoryMovementDetail,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export class InventoryMovementsService {
  private static async _saveCounterpartyDetails(
    supabase: SupabaseClient,
    movementId: string,
    details: Record<string, unknown> | null | undefined
  ) {
    if (!details) return;
    await supabase
      .from("inventory_movement_headers")
      .update({ counterparty_details: details } as any)
      .eq("id", movementId);
  }

  static async createDraft(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateDraftMovementInput,
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; draft_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_create_draft", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_movement_type_code: input.movement_type_code,
      p_lines: input.lines,
      p_operation_date: input.operation_date ?? null,
      p_document_date: input.document_date ?? null,
      p_counterparty_name: input.counterparty_name ?? null,
      p_external_reference: input.external_reference ?? null,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotency_key ?? null,
      p_actor_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    const result = data as any;
    await this._saveCounterpartyDetails(supabase, result.movement_id, input.counterparty_details);
    return { success: true, data: result };
  }

  static async finalizePosting(
    supabase: SupabaseClient,
    movementId: string,
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; document_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_finalize_posting", {
      p_movement_id: movementId,
      p_actor_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as any };
  }

  static async createAndFinalize(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateDraftMovementInput,
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; document_number: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_create_and_finalize", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_movement_type_code: input.movement_type_code,
      p_lines: input.lines,
      p_operation_date: input.operation_date ?? null,
      p_document_date: input.document_date ?? null,
      p_counterparty_name: input.counterparty_name ?? null,
      p_external_reference: input.external_reference ?? null,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotency_key ?? null,
      p_actor_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    const result = data as any;
    await this._saveCounterpartyDetails(supabase, result.movement_id, input.counterparty_details);
    return { success: true, data: result };
  }

  static async saveDraft(
    supabase: SupabaseClient,
    movementId: string,
    opts: {
      document_date?: string | null;
      operation_date?: string | null;
      counterparty_name?: string | null;
      counterparty_details?: Record<string, unknown> | null;
      external_reference?: string | null;
      note?: string | null;
      lines: Array<{
        variant_id: string;
        unit_id: string;
        quantity: number;
        source_location_id?: string | null;
        destination_location_id?: string | null;
        note?: string | null;
      }>;
    },
    userId: string
  ): Promise<ServiceResult<{ movement_id: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_save_draft", {
      p_movement_id: movementId,
      p_document_date: opts.document_date ?? null,
      p_operation_date: opts.operation_date ?? null,
      p_counterparty_name: opts.counterparty_name ?? null,
      p_external_reference: opts.external_reference ?? null,
      p_note: opts.note ?? null,
      p_lines: opts.lines,
      p_actor_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    await this._saveCounterpartyDetails(supabase, movementId, opts.counterparty_details);
    return { success: true, data: data as any };
  }

  static async cancelMovement(
    supabase: SupabaseClient,
    movementId: string,
    userId: string,
    reason?: string
  ): Promise<ServiceResult<{ movement_id: string; status: string }>> {
    const { data, error } = await supabase.rpc("inventory_cancel_movement", {
      p_movement_id: movementId,
      p_actor_user_id: userId,
      p_reason: reason ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as any };
  }

  static async listMovements(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<InventoryMovementListRow>>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("inventory_movement_headers")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (params.search) {
      query = query.or(
        `draft_number.ilike.%${params.search}%,document_number.ilike.%${params.search}%,counterparty_name.ilike.%${params.search}%`
      );
    }

    const statusFilter = params.filters?.status;
    if (statusFilter && typeof statusFilter === "string") {
      query = query.eq("status", statusFilter);
    }

    const { data, error, count } = await query;
    if (error) return { success: false, error: error.message };

    const headers = (data ?? []) as any[];
    if (headers.length === 0) {
      return { success: true, data: { rows: [], totalCount: count ?? 0, page, pageSize } };
    }

    const movementIds = headers.map((h: any) => h.id);
    const typeIds = [...new Set(headers.map((h: any) => h.movement_type_id).filter(Boolean))];

    const [linesRes, typesRes] = await Promise.all([
      supabase
        .from("inventory_movement_lines")
        .select("movement_id, variant_id")
        .in("movement_id", movementIds)
        .is("deleted_at", null),
      typeIds.length
        ? supabase
            .from("inventory_movement_types")
            .select("id, code, name, name_pl")
            .in("id", typeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const lineCountByMovement = new Map<string, number>();
    for (const line of (linesRes.data ?? []) as any[]) {
      lineCountByMovement.set(
        line.movement_id,
        (lineCountByMovement.get(line.movement_id) ?? 0) + 1
      );
    }

    const typesById = new Map(((typesRes.data ?? []) as any[]).map((t: any) => [t.id, t]));

    const items: InventoryMovementListRow[] = headers.map((h: any) => {
      const mvtType = typesById.get(h.movement_type_id);
      return {
        id: h.id,
        draft_number: h.draft_number,
        document_number: h.document_number,
        document_type_code: h.document_type_code,
        movement_type_code: h.movement_type_code ?? "",
        movement_type_name: mvtType?.name_pl ?? mvtType?.name ?? h.movement_type_code ?? "",
        status: h.status,
        line_count: lineCountByMovement.get(h.id) ?? 0,
        product_names: "",
        counterparty_name: h.counterparty_name,
        external_reference: h.external_reference,
        created_by: h.created_by,
        created_at: h.created_at,
        posted_at: h.posted_at,
      };
    });

    return { success: true, data: { rows: items, totalCount: count ?? 0, page, pageSize } };
  }

  static async getMovementDetail(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementIdentifier: string
  ): Promise<ServiceResult<InventoryMovementDetail>> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      movementIdentifier
    );
    let query = supabase
      .from("inventory_movement_headers")
      .select("*")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);
    if (isUuid) {
      query = query.eq("id", movementIdentifier);
    } else {
      query = query.or(
        `draft_number.eq.${movementIdentifier},document_number.eq.${movementIdentifier}`
      );
    }
    const { data: header, error: headerError } = await query.maybeSingle();

    if (headerError) return { success: false, error: headerError.message };
    if (!header) return { success: false, error: "Movement not found" };

    const h = header as any;

    // Resolve branch name and created_by user name
    const [branchRes, creatorRes] = await Promise.all([
      supabase.from("branches").select("id, name").eq("id", h.branch_id).maybeSingle(),
      h.created_by
        ? supabase
            .from("users")
            .select("id, first_name, last_name, email")
            .eq("id", h.created_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const branchName = (branchRes.data as any)?.name ?? null;
    const creatorData = creatorRes.data as any;
    const createdByName = creatorData
      ? [creatorData.first_name, creatorData.last_name].filter(Boolean).join(" ") ||
        creatorData.email ||
        null
      : null;

    const [linesRes, typeRes, auditRes] = await Promise.all([
      supabase
        .from("inventory_movement_lines")
        .select(
          "id, line_number, variant_id, unit_id, quantity, unit_cost, source_location_id, destination_location_id, snapshot_product_name, snapshot_sku, snapshot_unit_code, snapshot_source_location_name, snapshot_destination_location_name"
        )
        .eq("movement_id", h.id)
        .is("deleted_at", null)
        .order("line_number"),
      h.movement_type_id
        ? supabase
            .from("inventory_movement_types")
            .select("id, code, name, name_pl")
            .eq("id", h.movement_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      (supabase as any)
        .from("inventory_movement_audit_log")
        .select("id, action, old_status, new_status, actor_user_id, actor_user_name, created_at")
        .eq("movement_id", h.id)
        .order("created_at", { ascending: true }),
    ]);

    const lines = (linesRes.data ?? []) as any[];
    const mvtType = typeRes.data as any;
    const auditEntries = (auditRes.data ?? []) as any[];

    const variantIds = [...new Set(lines.map((l: any) => l.variant_id))];
    const unitIds = [...new Set(lines.map((l: any) => l.unit_id))];
    const locationIds = [
      ...new Set(
        lines.flatMap((l: any) => [l.source_location_id, l.destination_location_id]).filter(Boolean)
      ),
    ];

    const [variantsRes, unitsRes, locationsRes] = await Promise.all([
      variantIds.length
        ? supabase
            .from("inventory_variants")
            .select("id, sku, product_id")
            .eq("organization_id", orgId)
            .in("id", variantIds)
        : Promise.resolve({ data: [] }),
      unitIds.length
        ? supabase
            .from("inventory_units")
            .select("id, code")
            .eq("organization_id", orgId)
            .in("id", unitIds)
        : Promise.resolve({ data: [] }),
      locationIds.length
        ? supabase.from("warehouse_locations").select("id, name").in("id", locationIds)
        : Promise.resolve({ data: [] }),
    ]);

    const auditActorIds = [
      ...new Set(auditEntries.map((e: any) => e.actor_user_id).filter(Boolean)),
    ] as string[];
    const auditActorsRes = auditActorIds.length
      ? await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", auditActorIds)
      : { data: [] };
    const auditActorsById = new Map(
      ((auditActorsRes.data ?? []) as any[]).map((u: any) => [u.id, u])
    );

    const variants = (variantsRes.data ?? []) as any[];
    const productIds = [...new Set(variants.map((v: any) => v.product_id))];
    const productsRes = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [] };

    const variantsById = new Map(variants.map((v: any) => [v.id, v]));
    const productsById = new Map(((productsRes.data ?? []) as any[]).map((p: any) => [p.id, p]));
    const unitsById = new Map(((unitsRes.data ?? []) as any[]).map((u: any) => [u.id, u]));
    const locationsById = new Map(((locationsRes.data ?? []) as any[]).map((l: any) => [l.id, l]));

    const enrichedLines = lines.map((l: any) => {
      const variant = variantsById.get(l.variant_id);
      const product = variant ? productsById.get(variant.product_id) : null;
      const unit = unitsById.get(l.unit_id);
      const isPosted = h.status === "posted" || h.status === "reversed";
      return {
        id: l.id,
        line_number: l.line_number,
        variant_id: l.variant_id,
        sku: isPosted ? (l.snapshot_sku ?? variant?.sku ?? "") : (variant?.sku ?? ""),
        product_name: isPosted
          ? (l.snapshot_product_name ?? product?.name ?? "")
          : (product?.name ?? ""),
        quantity: Number(l.quantity),
        unit_code: isPosted ? (l.snapshot_unit_code ?? unit?.code ?? "") : (unit?.code ?? ""),
        unit_cost: l.unit_cost ? Number(l.unit_cost) : null,
        source_location_id: l.source_location_id,
        source_location_name: isPosted
          ? (l.snapshot_source_location_name ??
            locationsById.get(l.source_location_id)?.name ??
            null)
          : (locationsById.get(l.source_location_id)?.name ?? null),
        destination_location_id: l.destination_location_id,
        destination_location_name: isPosted
          ? (l.snapshot_destination_location_name ??
            locationsById.get(l.destination_location_id)?.name ??
            null)
          : (locationsById.get(l.destination_location_id)?.name ?? null),
      };
    });

    return {
      success: true,
      data: {
        id: h.id,
        draft_number: h.draft_number,
        document_number: h.document_number,
        document_type_code: h.document_type_code,
        movement_type_code: h.movement_type_code ?? "",
        movement_type_name: mvtType?.name_pl ?? mvtType?.name ?? h.movement_type_code ?? "",
        status: h.status,
        line_count: enrichedLines.length,
        product_names: enrichedLines
          .map((l) => l.product_name)
          .filter(Boolean)
          .join(", "),
        counterparty_name: h.counterparty_name,
        counterparty_details: (h as any).counterparty_details ?? null,
        external_reference: h.external_reference,
        created_by: h.created_by,
        created_at: h.created_at,
        posted_at: h.posted_at,
        note: h.note,
        operation_date: h.operation_date,
        document_date: h.document_date,
        branch_name: branchName,
        created_by_name: createdByName,
        lines: enrichedLines,
        audit_log: auditEntries.map((e: any) => {
          const actor = e.actor_user_id ? auditActorsById.get(e.actor_user_id) : null;
          const actorName = actor
            ? [actor.first_name, actor.last_name].filter(Boolean).join(" ") || actor.email
            : e.actor_user_name;
          return {
            id: e.id,
            action: e.action,
            old_status: e.old_status,
            new_status: e.new_status,
            actor_user_id: e.actor_user_id ?? null,
            actor_user_name: actorName ?? null,
            created_at: e.created_at,
          };
        }),
      },
    };
  }

  static async listMovementTypes(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryMovementType[]>> {
    const { data, error } = await supabase
      .from("inventory_movement_types")
      .select(
        "id, code, name, name_pl, name_en, category, document_type_id, requires_source_location, requires_destination_location, requires_reference, requires_note, cost_impact"
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("code");

    if (error) return { success: false, error: error.message };

    const types = (data ?? []) as any[];
    if (types.length === 0) return { success: true, data: [] };

    const docTypeIds = [...new Set(types.map((t: any) => t.document_type_id))];
    const { data: docTypes } = await supabase
      .from("inventory_document_types")
      .select("id, code")
      .in("id", docTypeIds);

    const docTypesById = new Map(((docTypes ?? []) as any[]).map((dt: any) => [dt.id, dt]));

    return {
      success: true,
      data: types.map((t: any) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        name_pl: t.name_pl,
        name_en: t.name_en,
        document_type_code: docTypesById.get(t.document_type_id)?.code ?? "",
        category: t.category,
        requires_source_location: t.requires_source_location,
        requires_destination_location: t.requires_destination_location,
        requires_reference: t.requires_reference,
        requires_note: t.requires_note,
        cost_impact: t.cost_impact,
      })),
    };
  }

  static async listVariantsInLocation(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    locationId: string,
    search?: string
  ): Promise<ServiceResult<LocationVariantStock[]>> {
    const { data: balances, error: balError } = await supabase
      .from("inventory_balances")
      .select("variant_id, on_hand_quantity")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("location_id", locationId)
      .gt("on_hand_quantity", 0);

    if (balError) return { success: false, error: balError.message };
    if (!balances || balances.length === 0) return { success: true, data: [] };

    const variantIds = (balances as any[]).map((b) => b.variant_id);
    const onHandByVariant = new Map(
      (balances as any[]).map((b) => [b.variant_id, Number(b.on_hand_quantity)])
    );

    const variantQuery = supabase
      .from("inventory_variants")
      .select("id, sku, product_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("id", variantIds);

    const { data: variants, error: varError } = await variantQuery;
    if (varError) return { success: false, error: varError.message };

    const productIds = [...new Set((variants as any[]).map((v) => v.product_id))];
    const [productsRes, unitsRes] = await Promise.all([
      productIds.length
        ? supabase
            .from("inventory_products")
            .select("id, name, base_unit_id")
            .eq("organization_id", orgId)
            .in("id", productIds)
        : Promise.resolve({ data: [] }),
      supabase.from("inventory_units").select("id, code").eq("organization_id", orgId),
    ]);

    const productsById = new Map(((productsRes.data ?? []) as any[]).map((p) => [p.id, p]));
    const unitsById = new Map(((unitsRes.data ?? []) as any[]).map((u) => [u.id, u]));

    let results: LocationVariantStock[] = (variants as any[])
      .map((v) => {
        const product = productsById.get(v.product_id);
        if (!product) return null;
        const unit = unitsById.get(product.base_unit_id);
        return {
          variant_id: v.id,
          product_name: product.name as string,
          sku: v.sku as string,
          unit_id: product.base_unit_id as string,
          unit_code: (unit?.code ?? "") as string,
          on_hand_quantity: onHandByVariant.get(v.id) ?? 0,
        };
      })
      .filter((r): r is LocationVariantStock => r !== null);

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (r) => r.sku.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q)
      );
    }

    return { success: true, data: results };
  }

  static async searchPickerItems(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    opts: {
      query?: string;
      sourceLocationId?: string | null;
      limit?: number;
    }
  ): Promise<ServiceResult<InventoryPickerItem[]>> {
    const limit = opts.limit ?? 50;
    const isLocationMode = !!opts.sourceLocationId;

    let variantIds: string[] | null = null;
    const locationOnHand = new Map<string, number>();

    if (isLocationMode) {
      const { data: balances, error: balError } = await supabase
        .from("inventory_balances")
        .select("variant_id, on_hand_quantity")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("location_id", opts.sourceLocationId!)
        .gt("on_hand_quantity", 0);

      if (balError) return { success: false, error: balError.message };
      if (!balances || balances.length === 0) return { success: true, data: [] };

      variantIds = (balances as any[]).map((b) => b.variant_id);
      for (const b of balances as any[]) {
        locationOnHand.set(b.variant_id, Number(b.on_hand_quantity));
      }
    }

    let vQuery = supabase
      .from("inventory_variants")
      .select("id, sku, barcode, product_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("sku")
      .limit(limit);

    if (variantIds) {
      vQuery = vQuery.in("id", variantIds);
    }

    if (opts.query) {
      vQuery = vQuery.or(`sku.ilike.%${opts.query}%,barcode.ilike.%${opts.query}%`);
    }

    const { data: variantsRaw, error: vError } = await vQuery;
    if (vError) return { success: false, error: vError.message };

    const variants = (variantsRaw ?? []) as any[];
    if (variants.length === 0) return { success: true, data: [] };

    const productIds = [...new Set(variants.map((v: any) => v.product_id))];

    const { data: productsRaw, error: pError } = await supabase
      .from("inventory_products")
      .select("id, name, base_unit_id, brand_name, manufacturer_name")
      .eq("organization_id", orgId)
      .in("id", productIds);

    if (pError) return { success: false, error: pError.message };
    const products = (productsRaw ?? []) as any[];

    if (opts.query) {
      const q = opts.query.toLowerCase();
      const nameMatchProductIds = new Set(
        products
          .filter((p: any) => (p.name as string).toLowerCase().includes(q))
          .map((p: any) => p.id)
      );
      const skuMatchVariantIds = new Set(variants.map((v: any) => v.id));
      const allMatchVariantIds = new Set([
        ...skuMatchVariantIds,
        ...variants.filter((v: any) => nameMatchProductIds.has(v.product_id)).map((v: any) => v.id),
      ]);
      // re-filter to include product name matches too
      // Already have all needed data, just include them all since DB filtered by SKU
    }

    const productsById = new Map(products.map((p: any) => [p.id, p]));
    const unitIds = [...new Set(products.map((p: any) => p.base_unit_id))];

    const { data: unitsRaw } = unitIds.length
      ? await supabase
          .from("inventory_units")
          .select("id, code")
          .eq("organization_id", orgId)
          .in("id", unitIds)
      : { data: [] };
    const unitsById = new Map(((unitsRaw ?? []) as any[]).map((u: any) => [u.id, u]));

    const totalOnHandMap = new Map<string, number>();
    if (!isLocationMode) {
      const vIds = variants.map((v: any) => v.id);
      const { data: totals } = await supabase
        .from("inventory_balances")
        .select("variant_id, on_hand_quantity")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .in("variant_id", vIds)
        .gt("on_hand_quantity", 0);

      for (const t of (totals ?? []) as any[]) {
        totalOnHandMap.set(
          t.variant_id,
          (totalOnHandMap.get(t.variant_id) ?? 0) + Number(t.on_hand_quantity)
        );
      }
    }

    let items: InventoryPickerItem[] = variants.map((v: any) => {
      const product = productsById.get(v.product_id);
      const unit = product ? unitsById.get(product.base_unit_id) : null;
      return {
        variant_id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        barcode: v.barcode ?? null,
        product_name: product?.name ?? "",
        brand_name: product?.brand_name ?? null,
        manufacturer_name: product?.manufacturer_name ?? null,
        unit_id: product?.base_unit_id ?? "",
        unit_code: unit?.code ?? "",
        total_on_hand: totalOnHandMap.get(v.id) ?? null,
        source_location_on_hand: locationOnHand.get(v.id) ?? null,
      };
    });

    if (opts.query) {
      const q = opts.query.toLowerCase();
      items = items.filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.product_name.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q)) ||
          (item.brand_name && item.brand_name.toLowerCase().includes(q))
      );

      items.sort((a, b) => {
        const aExact = a.sku.toLowerCase() === q ? -1 : 0;
        const bExact = b.sku.toLowerCase() === q ? -1 : 0;
        return aExact - bExact;
      });
    }

    return { success: true, data: items.slice(0, limit) };
  }
}
