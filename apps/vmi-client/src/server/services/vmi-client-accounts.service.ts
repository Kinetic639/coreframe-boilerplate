import type {
  VmiClientAccountCreateInput,
  VmiClientAccountUpdateInput,
  VmiClientInvitationCreateInput,
  VmiClientLocationCreateInput,
  VmiClientLocationUpdateInput,
} from "@/lib/validations/vmi";
import type { VmiSupabaseClient } from "./supabase-service.types";

export class VmiClientAccountsService {
  static async listClientAccounts(supabase: VmiSupabaseClient, vendorOrganizationId: string) {
    return supabase
      .from("vmi_client_accounts")
      .select("*")
      .eq("vendor_organization_id", vendorOrganizationId)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });
  }

  static async getClientAccount(
    supabase: VmiSupabaseClient,
    vendorOrganizationId: string,
    clientAccountId: string,
  ) {
    return supabase
      .from("vmi_client_accounts")
      .select("*")
      .eq("vendor_organization_id", vendorOrganizationId)
      .eq("id", clientAccountId)
      .is("deleted_at", null)
      .single();
  }

  static async createClientAccount(
    supabase: VmiSupabaseClient,
    input: VmiClientAccountCreateInput,
    actorUserId: string,
  ) {
    return supabase
      .from("vmi_client_accounts")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_party_id: input.clientPartyId ?? null,
        display_name: input.displayName,
        legal_name: input.legalName ?? null,
        tax_id: input.taxId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        notes: input.notes ?? null,
        created_by: actorUserId,
      })
      .select("*")
      .single();
  }

  static async updateClientAccount(
    supabase: VmiSupabaseClient,
    input: VmiClientAccountUpdateInput,
    actorUserId: string,
  ) {
    const { id, ...changes } = input;
    return supabase
      .from("vmi_client_accounts")
      .update({
        client_party_id: changes.clientPartyId,
        display_name: changes.displayName,
        legal_name: changes.legalName,
        tax_id: changes.taxId,
        email: changes.email,
        phone: changes.phone,
        website: changes.website,
        status: changes.status,
        notes: changes.notes,
        updated_by: actorUserId,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();
  }

  static async archiveClientAccount(
    supabase: VmiSupabaseClient,
    vendorOrganizationId: string,
    id: string,
    actorUserId: string,
  ) {
    return supabase
      .from("vmi_client_accounts")
      .update({ status: "archived", deleted_at: new Date().toISOString(), updated_by: actorUserId })
      .eq("vendor_organization_id", vendorOrganizationId)
      .eq("id", id)
      .is("deleted_at", null);
  }

  static async createInvitation(
    supabase: VmiSupabaseClient,
    input: VmiClientInvitationCreateInput,
    tokenHash: string,
    actorUserId: string,
  ) {
    return supabase
      .from("vmi_client_invitations")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        email: input.email,
        role: input.role,
        token_hash: tokenHash,
        expires_at: input.expiresAt,
        created_by: actorUserId,
      })
      .select("*")
      .single();
  }

  static async listLocations(
    supabase: VmiSupabaseClient,
    vendorOrganizationId: string,
    clientAccountId: string,
  ) {
    return supabase
      .from("vmi_client_locations")
      .select("*")
      .eq("vendor_organization_id", vendorOrganizationId)
      .eq("client_account_id", clientAccountId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
  }

  static async createLocation(
    supabase: VmiSupabaseClient,
    input: VmiClientLocationCreateInput,
    actorUserId: string,
  ) {
    return supabase
      .from("vmi_client_locations")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        name: input.name,
        location_code: input.locationCode ?? null,
        address_line1: input.addressLine1 ?? null,
        address_line2: input.addressLine2 ?? null,
        city: input.city ?? null,
        postal_code: input.postalCode ?? null,
        region: input.region ?? null,
        country: input.country,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        created_by: actorUserId,
      })
      .select("*")
      .single();
  }

  static async updateLocation(
    supabase: VmiSupabaseClient,
    input: VmiClientLocationUpdateInput,
    actorUserId: string,
  ) {
    const { id, ...changes } = input;
    return supabase
      .from("vmi_client_locations")
      .update({
        name: changes.name,
        location_code: changes.locationCode,
        address_line1: changes.addressLine1,
        address_line2: changes.addressLine2,
        city: changes.city,
        postal_code: changes.postalCode,
        region: changes.region,
        country: changes.country,
        latitude: changes.latitude,
        longitude: changes.longitude,
        status: changes.status,
        updated_by: actorUserId,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();
  }
}
