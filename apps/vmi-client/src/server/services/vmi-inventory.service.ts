import type {
  VmiCatalogExposureCreateInput,
  VmiInventoryItemCreateInput,
  VmiInventoryItemUpdateInput,
} from "@/lib/validations/vmi";
import type { VmiSupabaseClient } from "./supabase-service.types";

export class VmiInventoryService {
  static async listCatalogExposures(
    supabase: VmiSupabaseClient,
    vendorOrganizationId: string,
    clientAccountId?: string,
  ) {
    let query = supabase
      .from("vmi_catalog_exposures")
      .select("*")
      .eq("vendor_organization_id", vendorOrganizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (clientAccountId) query = query.eq("client_account_id", clientAccountId);
    return query;
  }

  static async createCatalogExposure(
    supabase: VmiSupabaseClient,
    input: VmiCatalogExposureCreateInput,
    actorUserId: string,
  ) {
    return supabase
      .from("vmi_catalog_exposures")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId ?? null,
        item_id: input.itemId,
        supplier_party_id: input.supplierPartyId ?? null,
        item_supplier_id: input.itemSupplierId ?? null,
        visibility_scope: input.visibilityScope,
        price_mode: input.priceMode,
        created_by: actorUserId,
      })
      .select("*")
      .single();
  }

  static async listInventoryItems(
    supabase: VmiSupabaseClient,
    vendorOrganizationId: string,
    clientAccountId: string,
  ) {
    return supabase
      .from("vmi_inventory_items")
      .select("*")
      .eq("vendor_organization_id", vendorOrganizationId)
      .eq("client_account_id", clientAccountId)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });
  }

  static async createInventoryItem(supabase: VmiSupabaseClient, input: VmiInventoryItemCreateInput) {
    return supabase
      .from("vmi_inventory_items")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        client_location_id: input.clientLocationId,
        catalog_exposure_id: input.catalogExposureId ?? null,
        item_id: input.itemId ?? null,
        client_sku: input.clientSku ?? null,
        display_name: input.displayName,
        unit: input.unit ?? null,
        current_quantity: input.currentQuantity,
        minimum_quantity: input.minimumQuantity ?? null,
        maximum_quantity: input.maximumQuantity ?? null,
        reorder_quantity: input.reorderQuantity ?? null,
      })
      .select("*")
      .single();
  }

  static async updateInventoryItem(supabase: VmiSupabaseClient, input: VmiInventoryItemUpdateInput) {
    const { id, ...changes } = input;
    return supabase
      .from("vmi_inventory_items")
      .update({
        catalog_exposure_id: changes.catalogExposureId,
        item_id: changes.itemId,
        client_sku: changes.clientSku,
        display_name: changes.displayName,
        unit: changes.unit,
        current_quantity: changes.currentQuantity,
        minimum_quantity: changes.minimumQuantity,
        maximum_quantity: changes.maximumQuantity,
        reorder_quantity: changes.reorderQuantity,
        status: changes.status,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();
  }

  static async archiveInventoryItem(supabase: VmiSupabaseClient, vendorOrganizationId: string, id: string) {
    return supabase
      .from("vmi_inventory_items")
      .update({ status: "archived", deleted_at: new Date().toISOString() })
      .eq("vendor_organization_id", vendorOrganizationId)
      .eq("id", id)
      .is("deleted_at", null);
  }
}
