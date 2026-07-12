import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateWarehouseItemSupplierInput,
  UpdateWarehouseItemSupplierInput,
} from "@/lib/validations/crm";
import type { ServiceResult } from "./crm-parties.service";

export interface WarehouseItemSupplierRow {
  id: string;
  organization_id: string;
  item_id: string;
  party_id: string;
  counterparty_number: number | null;
  supplier_name: string | null;
  is_primary: boolean;
  supplier_sku: string | null;
  lead_time_days: number | null;
  minimum_order_quantity: number | null;
  purchase_price: number | null;
  currency_code: string | null;
  created_at: string;
  updated_at: string;
}

export const WarehouseItemSuppliersService = {
  async listByItem(
    supabase: SupabaseClient,
    orgId: string,
    itemId: string
  ): Promise<ServiceResult<WarehouseItemSupplierRow[]>> {
    const { data, error } = await supabase
      .from("warehouse_item_suppliers")
      .select(
        "id, organization_id, item_id, party_id, is_primary, supplier_sku, lead_time_days, minimum_order_quantity, purchase_price, currency_code, created_at, updated_at, crm_parties(counterparty_number, display_name)"
      )
      .eq("organization_id", orgId)
      .eq("item_id", itemId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    const rows = ((data ?? []) as unknown[]).map((item) => {
      const row = item as {
        id: string;
        organization_id: string;
        item_id: string;
        party_id: string;
        is_primary: boolean;
        supplier_sku: string | null;
        lead_time_days: number | null;
        minimum_order_quantity: number | null;
        purchase_price: number | null;
        currency_code: string | null;
        created_at: string;
        updated_at: string;
        crm_parties?: { counterparty_number?: number | null; display_name?: string | null } | null;
      };
      return {
        id: row.id,
        organization_id: row.organization_id,
        item_id: row.item_id,
        party_id: row.party_id,
        counterparty_number: row.crm_parties?.counterparty_number ?? null,
        supplier_name: row.crm_parties?.display_name ?? null,
        is_primary: row.is_primary,
        supplier_sku: row.supplier_sku,
        lead_time_days: row.lead_time_days,
        minimum_order_quantity: row.minimum_order_quantity,
        purchase_price: row.purchase_price,
        currency_code: row.currency_code,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return { success: true, data: rows };
  },

  async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateWarehouseItemSupplierInput
  ): Promise<ServiceResult<WarehouseItemSupplierRow[]>> {
    if (input.is_primary) {
      const clearPrimary = await supabase
        .from("warehouse_item_suppliers")
        .update({ is_primary: false })
        .eq("organization_id", orgId)
        .eq("item_id", input.item_id)
        .is("deleted_at", null);
      if (clearPrimary.error) return { success: false, error: clearPrimary.error.message };
    }

    const { error } = await supabase.from("warehouse_item_suppliers").insert({
      organization_id: orgId,
      item_id: input.item_id,
      party_id: input.party_id,
      is_primary: input.is_primary,
      supplier_sku: input.supplier_sku ?? null,
      lead_time_days: input.lead_time_days ?? null,
      minimum_order_quantity: input.minimum_order_quantity ?? null,
      purchase_price: input.purchase_price ?? null,
      currency_code: input.currency_code ?? null,
      created_by: userId,
    });

    if (error) return { success: false, error: error.message };
    return WarehouseItemSuppliersService.listByItem(supabase, orgId, input.item_id);
  },

  async update(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateWarehouseItemSupplierInput
  ): Promise<ServiceResult<WarehouseItemSupplierRow[]>> {
    if (input.is_primary) {
      const clearPrimary = await supabase
        .from("warehouse_item_suppliers")
        .update({ is_primary: false })
        .eq("organization_id", orgId)
        .eq("item_id", input.item_id)
        .is("deleted_at", null);
      if (clearPrimary.error) return { success: false, error: clearPrimary.error.message };
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.is_primary !== undefined) patch.is_primary = input.is_primary;
    if (input.supplier_sku !== undefined) patch.supplier_sku = input.supplier_sku ?? null;
    if (input.lead_time_days !== undefined) patch.lead_time_days = input.lead_time_days ?? null;
    if (input.minimum_order_quantity !== undefined) {
      patch.minimum_order_quantity = input.minimum_order_quantity ?? null;
    }
    if (input.purchase_price !== undefined) patch.purchase_price = input.purchase_price ?? null;
    if (input.currency_code !== undefined) patch.currency_code = input.currency_code ?? null;

    const { error } = await supabase
      .from("warehouse_item_suppliers")
      .update(patch)
      .eq("organization_id", orgId)
      .eq("item_id", input.item_id)
      .eq("id", input.id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return WarehouseItemSuppliersService.listByItem(supabase, orgId, input.item_id);
  },

  async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("warehouse_item_suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  },
};
