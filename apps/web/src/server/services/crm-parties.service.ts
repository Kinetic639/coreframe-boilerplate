import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type {
  CreateCrmPartyAddressInput,
  CreateCrmPartyInput,
  CrmPartyRole,
  LinkCrmPartyContactInput,
  UpdateCrmPartyInput,
  UnlinkCrmPartyContactInput,
  DeleteCrmPartyAddressInput,
} from "@/lib/validations/crm";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CrmPartyListRow {
  id: string;
  organization_id: string;
  counterparty_number: number;
  party_kind: "organization" | "individual";
  display_name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive" | "archived";
  roles: CrmPartyRole[];
  created_at: string;
  updated_at: string;
}

export interface CrmPartyContactLink {
  id: string;
  party_id: string;
  contact_id: string;
  relationship_type: string;
  is_primary: boolean;
  contact_display_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface CrmPartyAddress {
  id: string;
  party_id: string;
  address_type: string;
  is_default: boolean;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  street: string | null;
  building_number: string | null;
  unit_number: string | null;
  region: string | null;
}

export interface CrmPartyDetail extends CrmPartyListRow {
  vat_id: string | null;
  regon: string | null;
  krs: string | null;
  website: string | null;
  logo_storage_path: string | null;
  notes: string | null;
  contacts: CrmPartyContactLink[];
  addresses: CrmPartyAddress[];
}

export interface CrmSupplierOption {
  id: string;
  counterparty_number: number;
  display_name: string;
  email: string | null;
  phone: string | null;
}

export interface CrmCounterpartyLookup {
  id: string;
  counterparty_number: number;
  display_name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  address: CrmPartyAddress | null;
}

type RoleRow = { role: CrmPartyRole };
type PartyRow = Omit<CrmPartyDetail, "roles" | "contacts" | "addresses"> & {
  crm_party_roles?: RoleRow[] | RoleRow | null;
};

const SORTABLE_FIELDS = new Set([
  "counterparty_number",
  "display_name",
  "party_kind",
  "status",
  "created_at",
  "updated_at",
]);

function resolveSortField(field: string | null | undefined): string {
  return field && SORTABLE_FIELDS.has(field) ? field : "counterparty_number";
}

function rolesFromRow(row: { crm_party_roles?: RoleRow[] | RoleRow | null }): CrmPartyRole[] {
  const roles = row.crm_party_roles;
  if (!roles) return [];
  return (Array.isArray(roles) ? roles : [roles]).map((item) => item.role);
}

function mapListRow(row: PartyRow): CrmPartyListRow {
  return {
    id: row.id,
    organization_id: row.organization_id,
    counterparty_number: row.counterparty_number,
    party_kind: row.party_kind,
    display_name: row.display_name,
    legal_name: row.legal_name,
    tax_id: row.tax_id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    roles: rolesFromRow(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const CrmPartiesService = {
  async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<CrmPartyListRow>>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("crm_parties")
      .select(
        "id, organization_id, counterparty_number, party_kind, display_name, legal_name, tax_id, email, phone, status, created_at, updated_at, crm_party_roles(role)",
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    const search = params.search?.trim();
    if (search) {
      const numeric = Number(search);
      const clauses = [
        `display_name.ilike.%${search}%`,
        `legal_name.ilike.%${search}%`,
        `tax_id.ilike.%${search}%`,
      ];
      if (Number.isInteger(numeric) && numeric > 0)
        clauses.push(`counterparty_number.eq.${numeric}`);
      query = query.or(clauses.join(","));
    }

    const roleFilter = params.filters?.role;
    if (typeof roleFilter === "string" && roleFilter) {
      query = query.eq("crm_party_roles.role", roleFilter);
    }

    const statusFilter = params.filters?.status;
    if (typeof statusFilter === "string" && statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const sortField = resolveSortField(params.sort?.field);
    const ascending = params.sort?.direction === "asc";
    const { data, error, count } = await query
      .order(sortField, { ascending })
      .range(offset, offset + pageSize - 1);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        rows: ((data ?? []) as unknown as PartyRow[]).map(mapListRow),
        totalCount: count ?? 0,
        page,
        pageSize,
      },
    };
  },

  async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    partyId: string
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { data, error } = await supabase
      .from("crm_parties")
      .select(
        "id, organization_id, counterparty_number, party_kind, display_name, legal_name, tax_id, vat_id, regon, krs, email, phone, website, logo_storage_path, status, notes, created_at, updated_at, crm_party_roles(role)"
      )
      .eq("id", partyId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) return { success: false, error: error.message };
    const row = data as unknown as PartyRow;

    const [contactsResult, addressesResult] = await Promise.all([
      supabase
        .from("crm_party_contacts")
        .select(
          "id, party_id, contact_id, relationship_type, is_primary, crm_contacts(display_name, email, phone)"
        )
        .eq("party_id", partyId)
        .eq("organization_id", orgId)
        .is("deleted_at", null),
      supabase
        .from("crm_party_addresses")
        .select(
          "id, party_id, address_type, is_default, country, city, postal_code, street, building_number, unit_number, region"
        )
        .eq("party_id", partyId)
        .eq("organization_id", orgId)
        .is("deleted_at", null),
    ]);

    if (contactsResult.error) return { success: false, error: contactsResult.error.message };
    if (addressesResult.error) return { success: false, error: addressesResult.error.message };

    const contacts = ((contactsResult.data ?? []) as unknown[]).map((item) => {
      const link = item as {
        id: string;
        party_id: string;
        contact_id: string;
        relationship_type: string;
        is_primary: boolean;
        crm_contacts?: {
          display_name?: string;
          email?: string | null;
          phone?: string | null;
        } | null;
      };
      return {
        id: link.id,
        party_id: link.party_id,
        contact_id: link.contact_id,
        relationship_type: link.relationship_type,
        is_primary: link.is_primary,
        contact_display_name: link.crm_contacts?.display_name ?? null,
        contact_email: link.crm_contacts?.email ?? null,
        contact_phone: link.crm_contacts?.phone ?? null,
      };
    });

    return {
      success: true,
      data: {
        ...mapListRow(row),
        vat_id: row.vat_id,
        regon: row.regon,
        krs: row.krs,
        website: row.website,
        logo_storage_path: row.logo_storage_path,
        notes: row.notes,
        contacts,
        addresses: (addressesResult.data ?? []) as unknown as CrmPartyAddress[],
      },
    };
  },

  async searchSuppliers(
    supabase: SupabaseClient,
    orgId: string,
    search: string | null | undefined,
    limit = 20
  ): Promise<ServiceResult<CrmSupplierOption[]>> {
    let query = supabase
      .from("crm_parties")
      .select("id, counterparty_number, display_name, email, phone, crm_party_roles!inner(role)")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .eq("crm_party_roles.role", "supplier")
      .is("deleted_at", null)
      .order("display_name", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 50));

    const trimmed = search?.trim();
    if (trimmed) {
      const numeric = Number(trimmed);
      const clauses = [`display_name.ilike.%${trimmed}%`, `tax_id.ilike.%${trimmed}%`];
      if (Number.isInteger(numeric) && numeric > 0) {
        clauses.push(`counterparty_number.eq.${numeric}`);
      }
      query = query.or(clauses.join(","));
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: ((data ?? []) as unknown as CrmSupplierOption[]).map((row) => ({
        id: row.id,
        counterparty_number: row.counterparty_number,
        display_name: row.display_name,
        email: row.email,
        phone: row.phone,
      })),
    };
  },

  async lookupByCounterpartyNumber(
    supabase: SupabaseClient,
    orgId: string,
    counterpartyNumber: number
  ): Promise<ServiceResult<CrmCounterpartyLookup>> {
    const { data, error } = await supabase
      .from("crm_parties")
      .select("id")
      .eq("organization_id", orgId)
      .eq("counterparty_number", counterpartyNumber)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Counterparty not found" };

    const detail = await CrmPartiesService.getDetail(supabase, orgId, (data as { id: string }).id);
    if ("error" in detail) return { success: false, error: detail.error };

    const address =
      detail.data.addresses.find((item) => item.is_default) ??
      detail.data.addresses.find((item) => item.address_type === "registered") ??
      detail.data.addresses.find((item) => item.address_type === "billing") ??
      detail.data.addresses[0] ??
      null;

    return {
      success: true,
      data: {
        id: detail.data.id,
        counterparty_number: detail.data.counterparty_number,
        display_name: detail.data.display_name,
        legal_name: detail.data.legal_name,
        tax_id: detail.data.tax_id,
        email: detail.data.email,
        phone: detail.data.phone,
        status: detail.data.status,
        address,
      },
    };
  },

  async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateCrmPartyInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const partyId = crypto.randomUUID();
    const { data: numberData, error: numberError } = await supabase.rpc(
      "reserve_organization_entity_number",
      { org_id: orgId, entity_type: "crm_party", entity_id: partyId }
    );
    if (numberError) return { success: false, error: numberError.message };

    const { data, error } = await supabase
      .from("crm_parties")
      .insert({
        id: partyId,
        organization_id: orgId,
        counterparty_number: numberData as number,
        party_kind: input.party_kind,
        display_name: input.display_name,
        legal_name: input.legal_name ?? null,
        tax_id: input.tax_id ?? null,
        vat_id: input.vat_id ?? null,
        regon: input.regon ?? null,
        krs: input.krs ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        logo_storage_path: input.logo_storage_path ?? null,
        status: input.status,
        notes: input.notes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      await supabase.rpc("release_organization_entity_number", {
        org_id: orgId,
        entity_type: "crm_party",
        entity_id: partyId,
      });
      return { success: false, error: error.message };
    }
    const createdPartyId = (data as { id: string }).id;

    const roles = Array.from(new Set(input.roles));
    const { error: rolesError } = await supabase.from("crm_party_roles").insert(
      roles.map((role) => ({
        organization_id: orgId,
        party_id: createdPartyId,
        role,
      }))
    );
    if (rolesError) return { success: false, error: rolesError.message };

    return CrmPartiesService.getDetail(supabase, orgId, createdPartyId);
  },

  async update(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateCrmPartyInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { roles, id, ...patch } = input;
    const { error } = await supabase
      .from("crm_parties")
      .update({ ...patch, updated_by: userId })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };

    if (roles) {
      const { error: deleteError } = await supabase
        .from("crm_party_roles")
        .delete()
        .eq("party_id", id)
        .eq("organization_id", orgId);
      if (deleteError) return { success: false, error: deleteError.message };

      const { error: insertError } = await supabase.from("crm_party_roles").insert(
        Array.from(new Set(roles)).map((role) => ({
          organization_id: orgId,
          party_id: id,
          role,
        }))
      );
      if (insertError) return { success: false, error: insertError.message };
    }

    return CrmPartiesService.getDetail(supabase, orgId, id);
  },

  async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    partyId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("crm_parties")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId, status: "archived" })
      .eq("id", partyId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  },

  async linkContact(
    supabase: SupabaseClient,
    orgId: string,
    input: LinkCrmPartyContactInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { error } = await supabase.from("crm_party_contacts").insert({
      organization_id: orgId,
      party_id: input.party_id,
      contact_id: input.contact_id,
      relationship_type: input.relationship_type,
      is_primary: input.is_primary,
      notes: input.notes ?? null,
    });

    if (error) return { success: false, error: error.message };
    return CrmPartiesService.getDetail(supabase, orgId, input.party_id);
  },

  async unlinkContact(
    supabase: SupabaseClient,
    orgId: string,
    input: UnlinkCrmPartyContactInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { error } = await supabase
      .from("crm_party_contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("party_id", input.party_id)
      .eq("id", input.link_id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return CrmPartiesService.getDetail(supabase, orgId, input.party_id);
  },

  async addAddress(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateCrmPartyAddressInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { error } = await supabase.from("crm_party_addresses").insert({
      organization_id: orgId,
      party_id: input.party_id,
      address_type: input.address_type,
      is_default: input.is_default,
      country: input.country ?? null,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      street: input.street ?? null,
      building_number: input.building_number ?? null,
      unit_number: input.unit_number ?? null,
      region: input.region ?? null,
    });

    if (error) return { success: false, error: error.message };
    return CrmPartiesService.getDetail(supabase, orgId, input.party_id);
  },

  async deleteAddress(
    supabase: SupabaseClient,
    orgId: string,
    input: DeleteCrmPartyAddressInput
  ): Promise<ServiceResult<CrmPartyDetail>> {
    const { error } = await supabase
      .from("crm_party_addresses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("party_id", input.party_id)
      .eq("id", input.address_id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return CrmPartiesService.getDetail(supabase, orgId, input.party_id);
  },
};
