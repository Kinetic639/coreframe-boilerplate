import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContactDirectoryFilter,
  ContactDirectoryPage,
  ContactDirectoryRow,
} from "@/lib/contacts/types";
import { OrgMemberPublicProfileService } from "./org-member-public-profile.service";
import type { ServiceResult } from "./organization.service";

type RpcRow = ContactDirectoryRow & { avatar_path: string | null; created_at: string | null };
type RpcResult = { rows: RpcRow[]; total: number; member_count: number; external_count: number };

export interface ContactDirectoryListInput {
  kind?: ContactDirectoryFilter;
  search?: string | null;
  descending?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Employees + external contacts in one list. Employees come live from their
 * profiles (every member of the organization may see them); external contacts
 * come through the RLS of crm_contacts (crm.contacts.read). Avatars of
 * employees are signed here, after the viewer was authorized.
 */
export class ContactsDirectoryService {
  static async list(
    supabase: SupabaseClient,
    orgId: string,
    input: ContactDirectoryListInput = {}
  ): Promise<ServiceResult<ContactDirectoryPage>> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
    const { data, error } = await supabase.rpc("contacts_directory", {
      p_org: orgId,
      p_kind: input.kind ?? "all",
      p_search: input.search?.trim() || null,
      p_desc: input.descending ?? false,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (error) return { success: false, error: error.message };

    const result = (data ?? {
      rows: [],
      total: 0,
      member_count: 0,
      external_count: 0,
    }) as RpcResult;
    return {
      success: true,
      data: {
        rows: await this.withAvatars(supabase, orgId, result.rows ?? []),
        totalCount: result.total ?? 0,
        page,
        pageSize,
        memberCount: result.member_count ?? 0,
        externalCount: result.external_count ?? 0,
      },
    };
  }

  /** One row by its key (`member:<user id>` or a contact id); null when not visible */
  static async getByKey(
    supabase: SupabaseClient,
    orgId: string,
    key: string
  ): Promise<ServiceResult<ContactDirectoryRow | null>> {
    const { data, error } = await supabase.rpc("contacts_directory", {
      p_org: orgId,
      p_key: key,
      p_limit: 1,
    });
    if (error) return { success: false, error: error.message };
    const rows = await this.withAvatars(
      supabase,
      orgId,
      ((data as RpcResult)?.rows ?? []).slice(0, 1)
    );
    return { success: true, data: rows[0] ?? null };
  }

  private static async withAvatars(
    supabase: SupabaseClient,
    orgId: string,
    rows: RpcRow[]
  ): Promise<ContactDirectoryRow[]> {
    const memberIds = rows.flatMap((row) =>
      row.kind === "member" && row.user_id ? [row.user_id] : []
    );
    const profiles = memberIds.length
      ? await OrgMemberPublicProfileService.listProfiles(supabase, orgId, memberIds)
      : null;
    const avatarByUser = new Map(
      (profiles?.success ? profiles.data : []).map((profile) => [
        profile.user_id,
        profile.avatar_url,
      ])
    );

    return rows.map(({ avatar_path: _path, created_at: _created, ...row }) => ({
      ...row,
      // Names typed with stray spaces ("Marcin  Kowalski")
      display_name: row.display_name.replace(/\s+/g, " ").trim(),
      avatar_url:
        row.kind === "member" && row.user_id ? (avatarByUser.get(row.user_id) ?? null) : null,
    }));
  }
}
