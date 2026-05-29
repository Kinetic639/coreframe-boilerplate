/**
 * Organization public profile read model.
 *
 * This is the server-side API for internal public profile surfaces. It exposes
 * approved organization, branch, and member fields for the active organization.
 */

import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./organization.service";
import {
  OrgMemberPublicProfileService,
  type OrgMemberPublicProfile,
  type PaginatedOrgMemberPublicProfiles,
} from "./org-member-public-profile.service";

export interface PublicOrganizationProfile {
  organization_id: string;
  name: string;
  name_2: string | null;
  slug: string | null;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  theme_color: string | null;
  font_color: string | null;
}

export interface PublicBranchProfile {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  public_warehouse_maps_enabled: boolean;
  description: string | null;
  image_url: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
}

export interface PublicMemberProfile extends OrgMemberPublicProfile {
  bio: string | null;
  portrait_url: string | null;
}

export interface OrganizationPublicProfileBundle {
  organization: PublicOrganizationProfile;
  branches: PublicBranchProfile[];
  members: PublicMemberProfile[];
}

export interface PaginatedPublicMemberProfiles extends Omit<
  PaginatedOrgMemberPublicProfiles,
  "rows"
> {
  rows: PublicMemberProfile[];
}

type OrganizationProfileRow = {
  organization_id: string;
  name: string | null;
  name_2: string | null;
  slug: string | null;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  theme_color: string | null;
  font_color: string | null;
};

type BranchRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  public_warehouse_maps_enabled: boolean | null;
};

function mapOrganization(row: OrganizationProfileRow): PublicOrganizationProfile {
  return {
    organization_id: row.organization_id,
    name: row.name || "Organization",
    name_2: row.name_2,
    slug: row.slug,
    bio: row.bio,
    website: row.website,
    logo_url: row.logo_url,
    theme_color: row.theme_color,
    font_color: row.font_color,
  };
}

function mapBranch(row: BranchRow): PublicBranchProfile {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    slug: row.slug,
    public_warehouse_maps_enabled: row.public_warehouse_maps_enabled ?? false,
    description: null,
    image_url: null,
    address: null,
    website: null,
    phone: null,
    email: null,
  };
}

function mapMember(profile: OrgMemberPublicProfile): PublicMemberProfile {
  return {
    ...profile,
    profile_href: `/dashboard/organization/public-profile/members/${profile.user_id}`,
    bio: null,
    portrait_url: null,
  };
}

const getOrganizationProfile = cache(async (supabase: SupabaseClient, orgId: string) => {
  const { data: organizationProfile, error: organizationError } = await supabase
    .from("organization_profiles")
    .select("organization_id, name, name_2, slug, bio, website, logo_url, theme_color, font_color")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (organizationError) return { success: false, error: organizationError.message } as const;
  if (!organizationProfile) {
    return { success: false, error: "Organization profile not found" } as const;
  }

  return {
    success: true,
    data: mapOrganization(organizationProfile as OrganizationProfileRow),
  } as const;
});

const listBranchProfiles = cache(async (supabase: SupabaseClient, orgId: string) => {
  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .select("id, organization_id, name, slug, public_warehouse_maps_enabled")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (branchesError) return { success: false, error: branchesError.message } as const;

  return {
    success: true,
    data: ((branches ?? []) as BranchRow[]).map(mapBranch),
  } as const;
});

export class OrganizationPublicProfileService {
  static async getOrganization(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<PublicOrganizationProfile>> {
    return getOrganizationProfile(supabase, orgId);
  }

  static async listBranches(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<PublicBranchProfile[]>> {
    return listBranchProfiles(supabase, orgId);
  }

  static async countMembers(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<number>> {
    return OrgMemberPublicProfileService.countProfilesForOrg(supabase, orgId);
  }

  static async listMembers(
    supabase: SupabaseClient,
    orgId: string,
    page = 1,
    pageSize = 24
  ): Promise<ServiceResult<PaginatedPublicMemberProfiles>> {
    const result = await OrgMemberPublicProfileService.listProfilesForOrgPage(
      supabase,
      orgId,
      page,
      pageSize
    );
    if (!result.success) return result as { success: false; error: string };

    return {
      success: true,
      data: {
        ...result.data,
        rows: result.data.rows.map(mapMember),
      },
    };
  }

  static async getBundle(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrganizationPublicProfileBundle>> {
    const organizationResult = await OrganizationPublicProfileService.getOrganization(
      supabase,
      orgId
    );
    if (!organizationResult.success) return organizationResult as { success: false; error: string };

    const [branchesResult, membersResult] = await Promise.all([
      OrganizationPublicProfileService.listBranches(supabase, orgId),
      OrgMemberPublicProfileService.listProfilesForOrg(supabase, orgId),
    ]);

    if (!branchesResult.success) return branchesResult as { success: false; error: string };
    if (!membersResult.success) return membersResult as { success: false; error: string };

    return {
      success: true,
      data: {
        organization: organizationResult.data,
        branches: branchesResult.data,
        members: membersResult.data.map(mapMember),
      },
    };
  }

  static async getMemberProfile(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<PublicMemberProfile>> {
    const result = await OrgMemberPublicProfileService.getProfile(supabase, orgId, userId);
    if (!result.success) return result as { success: false; error: string };

    return { success: true, data: mapMember(result.data) };
  }
}
