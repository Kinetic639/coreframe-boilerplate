import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BranchTransferLineInput,
  CreateCustomFieldInput,
  CreateLotInput,
  CreateOptionGroupInput,
  CreateOptionValueInput,
  CreatePurchaseOrderInput,
  CreateSerialInput,
  GenerateVariantInput,
  InventoryBranchTransferListRow,
  ReceivePurchaseOrderInput,
  StockHoldLineInput,
} from "@/lib/warehouse/inventory-types";
export type {
  BranchTransferLineInput,
  CreateCustomFieldInput,
  CreateLotInput,
  CreateOptionGroupInput,
  CreateOptionValueInput,
  CreatePurchaseOrderInput,
  CreateSerialInput,
  GenerateVariantInput,
  InventoryBranchTransferListRow,
  ReceivePurchaseOrderInput,
  StockHoldLineInput,
} from "@/lib/warehouse/inventory-types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(error: { message?: string } | null | undefined) {
  return error?.message ?? "Unexpected database error";
}

export class InventoryEnterpriseService {
  static async createOptionGroup(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateOptionGroupInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_option_groups")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        display_order: input.display_order ?? 0,
        created_by: input.actor_user_id ?? null,
        updated_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createOptionValue(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateOptionValueInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_option_values")
      .insert({
        organization_id: orgId,
        option_group_id: input.option_group_id,
        value: input.value.trim(),
        display_order: input.display_order ?? 0,
        created_by: input.actor_user_id ?? null,
        updated_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async generateVariants(
    supabase: SupabaseClient,
    orgId: string,
    input: GenerateVariantInput
  ): Promise<ServiceResult<{ variant_ids: string[] }>> {
    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", input.product_id)
      .is("deleted_at", null)
      .single();
    if (productError || !product) return { success: false, error: errorMessage(productError) };

    const valueIds = [...new Set(input.variants.flatMap((variant) => variant.option_value_ids))];
    const { data: values, error: valuesError } = valueIds.length
      ? await supabase
          .from("inventory_option_values")
          .select("id, option_group_id")
          .eq("organization_id", orgId)
          .in("id", valueIds)
      : { data: [], error: null };
    if (valuesError) return { success: false, error: errorMessage(valuesError) };

    const valuesById = new Map(
      ((values ?? []) as Array<{ id: string; option_group_id: string }>).map((value) => [
        value.id,
        value,
      ])
    );

    const createdVariantIds: string[] = [];

    for (const variant of input.variants) {
      const optionRows = variant.option_value_ids.map((optionValueId) => {
        const optionValue = valuesById.get(optionValueId);
        if (!optionValue) return null;
        return optionValue;
      });
      if (optionRows.some((row) => row === null)) {
        return { success: false, error: "Generated variant contains an invalid option value" };
      }

      const validOptionRows = optionRows as Array<{ id: string; option_group_id: string }>;
      const uniqueGroupCount = new Set(validOptionRows.map((row) => row.option_group_id)).size;
      if (uniqueGroupCount !== validOptionRows.length) {
        return {
          success: false,
          error: "Each generated variant can use only one value per option group",
        };
      }

      const { data: created, error: createError } = await supabase
        .from("inventory_variants")
        .insert({
          organization_id: orgId,
          product_id: input.product_id,
          sku: variant.sku.trim(),
          name: variant.name.trim(),
          is_default: false,
          barcode: variant.barcode ?? null,
          purchase_price: variant.purchase_price ?? null,
          sales_price: variant.sales_price ?? null,
          price_currency: variant.price_currency ?? null,
          created_by: input.actor_user_id ?? null,
          updated_by: input.actor_user_id ?? null,
        })
        .select("id")
        .single();

      if (createError) return { success: false, error: errorMessage(createError) };
      const variantId = (created as { id: string }).id;
      createdVariantIds.push(variantId);

      if (validOptionRows.length > 0) {
        const { error: optionInsertError } = await supabase
          .from("inventory_variant_option_values")
          .insert(
            validOptionRows.map((row) => ({
              organization_id: orgId,
              variant_id: variantId,
              option_group_id: row.option_group_id,
              option_value_id: row.id,
            }))
          );

        if (optionInsertError) return { success: false, error: errorMessage(optionInsertError) };
      }
    }

    return { success: true, data: { variant_ids: createdVariantIds } };
  }

  static async updateVariantPricing(
    supabase: SupabaseClient,
    orgId: string,
    variantId: string,
    input: {
      purchase_price?: number | null;
      sales_price?: number | null;
      price_currency?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_variants")
      .update({
        purchase_price: input.purchase_price,
        sales_price: input.sales_price,
        price_currency: input.price_currency,
        updated_by: input.actor_user_id ?? null,
      })
      .eq("organization_id", orgId)
      .eq("id", variantId)
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async updateVariantDetails(
    supabase: SupabaseClient,
    orgId: string,
    variantId: string,
    input: {
      sku: string;
      name: string;
      status?: "active" | "archived" | "discontinued";
      barcode?: string | null;
      purchase_price?: number | null;
      sales_price?: number | null;
      price_currency?: string | null;
      reorder_point?: number | null;
      preferred_supplier_id?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_variants")
      .update({
        sku: input.sku.trim(),
        name: input.name.trim(),
        status: input.status,
        barcode: input.barcode?.trim() || null,
        purchase_price: input.purchase_price,
        sales_price: input.sales_price,
        price_currency: input.price_currency,
        updated_by: input.actor_user_id ?? null,
      })
      .eq("organization_id", orgId)
      .eq("id", variantId)
      .select("id")
      .single();
    if (error) return { success: false, error: errorMessage(error) };

    if (input.reorder_point != null || input.preferred_supplier_id !== undefined) {
      const client = supabase as any;
      const { data: existingRule, error: existingError } = await client
        .from("inventory_reorder_rules")
        .select("id")
        .eq("organization_id", orgId)
        .eq("variant_id", variantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existingError) return { success: false, error: errorMessage(existingError) };

      if (existingRule) {
        const { error: reorderError } = await client
          .from("inventory_reorder_rules")
          .update({
            reorder_point: input.reorder_point ?? 0,
            preferred_supplier_id: input.preferred_supplier_id ?? null,
            updated_by: input.actor_user_id ?? null,
          })
          .eq("id", (existingRule as { id: string }).id);
        if (reorderError) return { success: false, error: errorMessage(reorderError) };
      }
    }

    return { success: true, data: data as { id: string } };
  }

  static async createLot(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateLotInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_lots")
      .insert({
        organization_id: orgId,
        product_id: input.product_id,
        variant_id: input.variant_id,
        lot_number: input.lot_number.trim(),
        manufactured_at: input.manufactured_at ?? null,
        expires_at: input.expires_at ?? null,
        supplier_reference: input.supplier_reference ?? null,
        created_by: input.actor_user_id ?? null,
        updated_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createSerial(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateSerialInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_serials")
      .insert({
        organization_id: orgId,
        product_id: input.product_id,
        variant_id: input.variant_id,
        serial_number: input.serial_number.trim(),
        lot_id: input.lot_id ?? null,
        current_branch_id: input.current_branch_id ?? null,
        current_location_id: input.current_location_id ?? null,
        created_by: input.actor_user_id ?? null,
        updated_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createReservation(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: {
      lines: StockHoldLineInput[];
      reference_type?: string | null;
      reference_id?: string | null;
      reference_number?: string | null;
      expires_at?: string | null;
      notes?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_reservation", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_lines: input.lines,
      p_reference_type: input.reference_type ?? null,
      p_reference_id: input.reference_id ?? null,
      p_reference_number: input.reference_number ?? null,
      p_expires_at: input.expires_at ?? null,
      p_notes: input.notes ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async releaseReservation(
    supabase: SupabaseClient,
    reservationId: string,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_release_reservation", {
      p_reservation_id: reservationId,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async createAllocation(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: {
      lines: StockHoldLineInput[];
      reservation_id?: string | null;
      reference_type?: string | null;
      reference_id?: string | null;
      reference_number?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_allocation", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_lines: input.lines,
      p_reservation_id: input.reservation_id ?? null,
      p_reference_type: input.reference_type ?? null,
      p_reference_id: input.reference_id ?? null,
      p_reference_number: input.reference_number ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async releaseAllocation(
    supabase: SupabaseClient,
    allocationId: string,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_release_allocation", {
      p_allocation_id: allocationId,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async createSupplier(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      name: string;
      email?: string | null;
      phone?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_suppliers")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        email: input.email ?? null,
        phone: input.phone ?? null,
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createPurchaseOrder(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreatePurchaseOrderInput
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_purchase_order", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_supplier_id: input.supplier_id,
      p_lines: input.lines,
      p_expected_delivery_date: input.expected_delivery_date ?? null,
      p_delivery_location_id: input.delivery_location_id ?? null,
      p_currency: input.currency ?? null,
      p_notes: input.notes ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async receivePurchaseOrder(
    supabase: SupabaseClient,
    input: ReceivePurchaseOrderInput
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_receive_purchase_order", {
      p_purchase_order_id: input.purchase_order_id,
      p_lines: input.lines,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async previewSku(
    supabase: SupabaseClient,
    orgId: string,
    input: { product_name: string; product_type?: string }
  ): Promise<ServiceResult<{ sku: string }>> {
    const { data, error } = await supabase.rpc("inventory_preview_sku", {
      p_organization_id: orgId,
      p_product_name: input.product_name,
      p_product_type: input.product_type ?? "stocked",
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: { sku: String(data ?? "") } };
  }

  static async createUnitConversion(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      from_unit_id: string;
      to_unit_id: string;
      factor: number;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_unit_conversions")
      .insert({
        organization_id: orgId,
        from_unit_id: input.from_unit_id,
        to_unit_id: input.to_unit_id,
        factor: input.factor,
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createProductUnitConversion(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      product_id: string;
      from_unit_id: string;
      to_unit_id: string;
      factor: number;
      rounding_mode: "half_up" | "up" | "down";
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_product_unit_conversions")
      .insert({
        organization_id: orgId,
        product_id: input.product_id,
        from_unit_id: input.from_unit_id,
        to_unit_id: input.to_unit_id,
        factor: input.factor,
        rounding_mode: input.rounding_mode,
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createCustomField(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateCustomFieldInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_custom_fields")
      .insert({
        organization_id: orgId,
        entity_type: input.entity_type,
        name: input.name.trim(),
        field_key: input.field_key.trim(),
        field_type: input.field_type,
        is_required: input.is_required ?? false,
        is_filterable: input.is_filterable ?? false,
        options: input.options ?? [],
        display_order: input.display_order ?? 0,
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async archiveCustomField(
    supabase: SupabaseClient,
    orgId: string,
    fieldId: string,
    _userId: string | null
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_custom_fields")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("id", fieldId)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async updateCustomField(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      id: string;
      name: string;
      is_required?: boolean;
      is_filterable?: boolean;
      options?: string[];
      display_order?: number;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_custom_fields")
      .update({
        name: input.name.trim(),
        is_required: input.is_required ?? false,
        is_filterable: input.is_filterable ?? false,
        options: input.options ?? [],
        display_order: input.display_order ?? 0,
      })
      .eq("organization_id", orgId)
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async setCustomFieldValue(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      field_id: string;
      product_id?: string | null;
      variant_id?: string | null;
      lot_id?: string | null;
      serial_id?: string | null;
      value_text?: string | null;
      value_number?: number | null;
      value_date?: string | null;
      value_boolean?: boolean | null;
      value_json?: unknown;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const row = {
      organization_id: orgId,
      field_id: input.field_id,
      product_id: input.product_id ?? null,
      variant_id: input.variant_id ?? null,
      lot_id: input.lot_id ?? null,
      serial_id: input.serial_id ?? null,
      value_text: input.value_text ?? null,
      value_number: input.value_number ?? null,
      value_date: input.value_date ?? null,
      value_boolean: input.value_boolean ?? null,
      value_json: input.value_json ?? null,
      created_by: input.actor_user_id ?? null,
    };

    let existingQuery = supabase
      .from("inventory_custom_field_values")
      .select("id")
      .eq("organization_id", orgId)
      .eq("field_id", input.field_id);

    if (input.product_id) existingQuery = existingQuery.eq("product_id", input.product_id);
    else if (input.variant_id) existingQuery = existingQuery.eq("variant_id", input.variant_id);
    else if (input.lot_id) existingQuery = existingQuery.eq("lot_id", input.lot_id);
    else if (input.serial_id) existingQuery = existingQuery.eq("serial_id", input.serial_id);
    else return { success: false, error: "Custom field value requires exactly one target entity" };

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) return { success: false, error: errorMessage(existingError) };

    const write = existing
      ? supabase
          .from("inventory_custom_field_values")
          .update(row)
          .eq("id", (existing as { id: string }).id)
          .select("id")
          .single()
      : supabase.from("inventory_custom_field_values").insert(row).select("id").single();

    const { data, error } = await write;

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createCollection(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      name: string;
      description?: string | null;
      collection_type?: "manual" | "dynamic";
      filter_json?: Record<string, unknown> | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_collections")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        description: input.description ?? null,
        collection_type: input.collection_type ?? "manual",
        filter_json: input.filter_json ?? null,
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async addCollectionItem(
    supabase: SupabaseClient,
    orgId: string,
    input: { collection_id: string; product_id: string; actor_user_id?: string | null }
  ): Promise<ServiceResult<{ collection_id: string; product_id: string }>> {
    const { data, error } = await supabase
      .from("inventory_collection_items")
      .insert({
        organization_id: orgId,
        collection_id: input.collection_id,
        product_id: input.product_id,
        created_by: input.actor_user_id ?? null,
      })
      .select("collection_id, product_id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { collection_id: string; product_id: string } };
  }

  static async saveView(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: { entity: string; name: string; config: Record<string, unknown>; is_shared?: boolean }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_saved_views")
      .insert({
        organization_id: orgId,
        user_id: userId,
        entity: input.entity,
        name: input.name.trim(),
        config: input.config,
        is_shared: input.is_shared ?? false,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createImportJob(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    input: {
      import_type: "products" | "opening_stock" | "counts";
      file_name?: string | null;
      storage_path?: string | null;
      mapping?: Record<string, unknown>;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_import_jobs")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        import_type: input.import_type,
        file_name: input.file_name ?? null,
        storage_path: input.storage_path ?? null,
        mapping: input.mapping ?? {},
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createExportJob(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    input: {
      export_type: "products" | "inventory" | "movements" | "valuation" | "counts";
      filters?: Record<string, unknown>;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_export_jobs")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        export_type: input.export_type,
        filters: input.filters ?? {},
        created_by: input.actor_user_id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async createValuationSnapshot(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    snapshotDate?: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_valuation_snapshot", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_snapshot_date: snapshotDate ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async createCountSession(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: { scope?: Record<string, unknown>; notes?: string | null; actor_user_id?: string | null }
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_count_session", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_scope: input.scope ?? {},
      p_notes: input.notes ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async updateCountLine(
    supabase: SupabaseClient,
    lineId: string,
    input: { counted_quantity: number; note?: string | null; actor_user_id?: string | null }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_count_lines")
      .update({
        counted_quantity: input.counted_quantity,
        note: input.note ?? null,
        counted_by: input.actor_user_id ?? null,
        counted_at: new Date().toISOString(),
      })
      .eq("id", lineId)
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  static async approveCountSession(
    supabase: SupabaseClient,
    countSessionId: string,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_approve_count_session", {
      p_count_session_id: countSessionId,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async listBranchTransfers(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<InventoryBranchTransferListRow[]>> {
    const { data, error } = await supabase
      .from("inventory_branch_transfers")
      .select(
        "id, transfer_number, source_branch_id, destination_branch_id, status, notes, decline_reason, sent_at, accepted_at, declined_at"
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { success: false, error: errorMessage(error) };
    const transfers = (data ?? []) as Array<{
      id: string;
      transfer_number: string;
      source_branch_id: string;
      destination_branch_id: string;
      status: string;
      notes: string | null;
      decline_reason: string | null;
      sent_at: string | null;
      accepted_at: string | null;
      declined_at: string | null;
    }>;

    const branchIds = [
      ...new Set(
        transfers.flatMap((transfer) => [transfer.source_branch_id, transfer.destination_branch_id])
      ),
    ];
    const transferIds = transfers.map((transfer) => transfer.id);

    const { data: branchesData, error: branchesError } = branchIds.length
      ? await supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", branchIds)
      : { data: [], error: null };
    if (branchesError) return { success: false, error: errorMessage(branchesError) };

    const { data: linesData, error: linesError } = transferIds.length
      ? await supabase
          .from("inventory_branch_transfer_lines")
          .select("transfer_id")
          .eq("organization_id", orgId)
          .in("transfer_id", transferIds)
      : { data: [], error: null };
    if (linesError) return { success: false, error: errorMessage(linesError) };

    const branchesById = new Map(
      ((branchesData ?? []) as Array<{ id: string; name: string }>).map((branch) => [
        branch.id,
        branch.name,
      ])
    );
    const lineCounts = new Map<string, number>();
    for (const line of (linesData ?? []) as Array<{ transfer_id: string }>) {
      lineCounts.set(line.transfer_id, (lineCounts.get(line.transfer_id) ?? 0) + 1);
    }

    return {
      success: true,
      data: transfers.map((transfer) => ({
        ...transfer,
        source_branch_name: branchesById.get(transfer.source_branch_id) ?? "",
        destination_branch_name: branchesById.get(transfer.destination_branch_id) ?? "",
        line_count: lineCounts.get(transfer.id) ?? 0,
      })),
    };
  }

  static async createBranchTransfer(
    supabase: SupabaseClient,
    orgId: string,
    sourceBranchId: string,
    input: {
      destination_branch_id: string;
      lines: BranchTransferLineInput[];
      notes?: string | null;
      actor_user_id?: string | null;
    }
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_create_branch_transfer", {
      p_organization_id: orgId,
      p_source_branch_id: sourceBranchId,
      p_destination_branch_id: input.destination_branch_id,
      p_lines: input.lines,
      p_notes: input.notes ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async acceptBranchTransfer(
    supabase: SupabaseClient,
    transferId: string,
    destinationLocationId: string,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_accept_branch_transfer", {
      p_transfer_id: transferId,
      p_destination_location_id: destinationLocationId,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  static async declineBranchTransfer(
    supabase: SupabaseClient,
    transferId: string,
    declineReason: string | null,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc("inventory_decline_branch_transfer", {
      p_transfer_id: transferId,
      p_decline_reason: declineReason,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }
}
