import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type { CreateCrmContactInput, UpdateCrmContactInput } from "@/lib/validations/crm";
import type { ServiceResult } from "./crm-parties.service";

export interface CrmContactListRow {
  id: string;
  organization_id: string;
  linked_user_id: string | null;
  visibility_scope: "private" | "branch" | "organization";
  owner_user_id: string | null;
  branch_id: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContactDetail extends CrmContactListRow {
  avatar_storage_path: string | null;
  notes: string | null;
  parties: Array<{
    id: string;
    party_id: string;
    party_display_name: string | null;
    counterparty_number: number | null;
    relationship_type: string;
    is_primary: boolean;
  }>;
}

type ContactRow = Omit<CrmContactDetail, "parties">;

const SORTABLE_FIELDS = new Set(["display_name", "visibility_scope", "created_at", "updated_at"]);

function resolveSortField(field: string | null | undefined): string {
  return field && SORTABLE_FIELDS.has(field) ? field : "display_name";
}

function mapListRow(row: ContactRow): CrmContactListRow {
  return {
    id: row.id,
    organization_id: row.organization_id,
    linked_user_id: row.linked_user_id,
    visibility_scope: row.visibility_scope,
    owner_user_id: row.owner_user_id,
    branch_id: row.branch_id,
    display_name: row.display_name,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    job_title: row.job_title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const CrmContactsService = {
  async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<CrmContactListRow>>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("crm_contacts")
      .select(
        "id, organization_id, linked_user_id, visibility_scope, owner_user_id, branch_id, display_name, first_name, last_name, email, phone, mobile, job_title, created_at, updated_at",
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    const search = params.search?.trim();
    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const visibility = params.filters?.visibility_scope;
    if (typeof visibility === "string" && visibility) {
      query = query.eq("visibility_scope", visibility);
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
        rows: ((data ?? []) as unknown as ContactRow[]).map(mapListRow),
        totalCount: count ?? 0,
        page,
        pageSize,
      },
    };
  },

  async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    contactId: string
  ): Promise<ServiceResult<CrmContactDetail>> {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select(
        "id, organization_id, linked_user_id, visibility_scope, owner_user_id, branch_id, display_name, first_name, last_name, email, phone, mobile, avatar_storage_path, job_title, notes, created_at, updated_at"
      )
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) return { success: false, error: error.message };

    const partiesResult = await supabase
      .from("crm_party_contacts")
      .select(
        "id, party_id, relationship_type, is_primary, crm_parties(display_name, counterparty_number)"
      )
      .eq("contact_id", contactId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (partiesResult.error) return { success: false, error: partiesResult.error.message };

    const parties = ((partiesResult.data ?? []) as unknown[]).map((item) => {
      const row = item as {
        id: string;
        party_id: string;
        relationship_type: string;
        is_primary: boolean;
        crm_parties?: { display_name?: string | null; counterparty_number?: number | null } | null;
      };
      return {
        id: row.id,
        party_id: row.party_id,
        party_display_name: row.crm_parties?.display_name ?? null,
        counterparty_number: row.crm_parties?.counterparty_number ?? null,
        relationship_type: row.relationship_type,
        is_primary: row.is_primary,
      };
    });

    const contact = data as unknown as ContactRow;
    return {
      success: true,
      data: {
        ...mapListRow(contact),
        avatar_storage_path: contact.avatar_storage_path,
        notes: contact.notes,
        parties,
      },
    };
  },

  async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    activeBranchId: string | null,
    input: CreateCrmContactInput
  ): Promise<ServiceResult<CrmContactDetail>> {
    const ownerUserId =
      input.visibility_scope === "private" ? userId : (input.owner_user_id ?? null);
    const branchId =
      input.visibility_scope === "branch" ? (input.branch_id ?? activeBranchId) : null;

    const { data, error } = await supabase
      .from("crm_contacts")
      .insert({
        organization_id: orgId,
        linked_user_id: input.linked_user_id ?? null,
        visibility_scope: input.visibility_scope,
        owner_user_id: ownerUserId,
        branch_id: branchId,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        display_name: input.display_name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        mobile: input.mobile ?? null,
        avatar_storage_path: input.avatar_storage_path ?? null,
        job_title: input.job_title ?? null,
        notes: input.notes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return CrmContactsService.getDetail(supabase, orgId, (data as { id: string }).id);
  },

  async update(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateCrmContactInput
  ): Promise<ServiceResult<CrmContactDetail>> {
    const { id, ...patch } = input;
    const { error } = await supabase
      .from("crm_contacts")
      .update({ ...patch, updated_by: userId })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return CrmContactsService.getDetail(supabase, orgId, id);
  },

  async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    contactId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("crm_contacts")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  },
};
