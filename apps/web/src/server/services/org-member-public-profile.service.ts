/**
 * Public organization member profiles.
 *
 * This service is the server-side boundary for social UI surfaces such as
 * comments, messages, mentions, and activity feeds. It exposes only profile
 * fields that are already readable to active org members, and signs private
 * avatar objects only after the authenticated viewer has been authorized.
 */

import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/utils/supabase/service";
import type { ServiceResult } from "./organization.service";
import { getAuthUser } from "@/server/auth/get-auth-user";

const USER_AVATAR_BUCKET = "user-avatars";
const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_PROFILE_LOOKUP_USERS = 100;
const MAX_PROFILE_PAGE_SIZE = 48;
const MAX_AVATAR_LOOKUP_USERS = 300;

type MembershipRow = {
  user_id: string;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
};

interface AuthorizedViewer {
  userId: string;
}

type ProfileDetailsRow = {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  job_title: string | null;
  branch_name: string | null;
  joined_at: string | null;
};

export interface OrgMemberPublicProfile {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  /** Name to show: the member's own display name, else first + last name, else email. */
  display_name: string;
  /** First + last name, when set (shown under a custom display name). */
  full_name: string | null;
  avatar_url: string | null;
  profile_href: string;
  phone: string | null;
  job_title: string | null;
  branch_name: string | null;
  joined_at: string | null;
}

export interface PaginatedOrgMemberPublicProfiles {
  rows: OrgMemberPublicProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function uniqueUserIds(userIds: string[]): string[] {
  return Array.from(new Set(userIds.filter(Boolean))).slice(0, MAX_PROFILE_LOOKUP_USERS);
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 24;
  return Math.min(Math.floor(pageSize), MAX_PROFILE_PAGE_SIZE);
}

function buildFullName(user: UserProfileRow): string | null {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null;
}

function buildDisplayName(user: UserProfileRow, details?: ProfileDetailsRow): string {
  return details?.display_name?.trim() || buildFullName(user) || user.email || "User";
}

/**
 * Display name, phone, position and branch of members. These live in tables only
 * their owner can read (user_preferences), so a definer function returns exactly
 * these approved fields to active members of the same organization.
 */
async function loadProfileDetails(
  supabase: SupabaseClient,
  orgId: string,
  userIds: string[]
): Promise<Map<string, ProfileDetailsRow>> {
  const details = new Map<string, ProfileDetailsRow>();
  if (userIds.length === 0) return details;

  const { data, error } = await supabase.rpc("org_member_profile_details", {
    p_org: orgId,
    p_user_ids: userIds,
  });
  if (error) {
    // Non-fatal: profiles still render with names from the users table
    console.error("[OrgMemberPublicProfileService] Failed to load profile details", error);
    return details;
  }

  for (const row of (data ?? []) as ProfileDetailsRow[]) details.set(row.user_id, row);
  return details;
}

function profileHref(userId: string): string {
  return `/dashboard/organization/users/members/${userId}`;
}

function canSignAvatarPath(user: UserProfileRow): user is UserProfileRow & { avatar_path: string } {
  return Boolean(user.avatar_path && user.avatar_path.startsWith(`${user.id}/`));
}

const createSignedAvatarUrl = cache(async (userId: string, avatarPath: string) => {
  let serviceSupabase: SupabaseClient;
  try {
    serviceSupabase = createServiceClient();
  } catch (error) {
    console.error("[OrgMemberPublicProfileService] Service client unavailable for avatars", error);
    return null;
  }

  const { data, error } = await serviceSupabase.storage
    .from(USER_AVATAR_BUCKET)
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[OrgMemberPublicProfileService] Failed to sign member avatar", {
      userId,
      error,
    });
    return null;
  }

  return data.signedUrl;
});

async function createSignedAvatarUrls(users: UserProfileRow[]): Promise<Map<string, string>> {
  const usersWithPrivateAvatars = users.filter(canSignAvatarPath);
  const signedUrls = new Map<string, string>();

  if (usersWithPrivateAvatars.length === 0) return signedUrls;

  await Promise.all(
    usersWithPrivateAvatars.map(async (user) => {
      const signedUrl = await createSignedAvatarUrl(user.id, user.avatar_path);
      if (signedUrl) signedUrls.set(user.id, signedUrl);
    })
  );

  return signedUrls;
}

async function authorizeViewer(
  supabase: SupabaseClient,
  orgId: string
): Promise<ServiceResult<AuthorizedViewer>> {
  // Verified token claims, no request to Supabase Auth
  const {
    data: { user: viewer },
    error: authError,
  } = await getAuthUser();

  if (authError || !viewer) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: viewerMembership, error: viewerMembershipError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", viewer.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (viewerMembershipError) {
    return { success: false, error: viewerMembershipError.message };
  }

  if (!viewerMembership) {
    return { success: false, error: "Unauthorized" };
  }

  return { success: true, data: { userId: viewer.id } };
}

async function listAuthorizedProfiles(
  supabase: SupabaseClient,
  orgId: string,
  userIds: string[]
): Promise<ServiceResult<OrgMemberPublicProfile[]>> {
  if (userIds.length === 0) return { success: true, data: [] };

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, avatar_url, avatar_path")
    .in("id", userIds);

  if (usersError) {
    return { success: false, error: usersError.message };
  }

  const authorizedUserIds = new Set(userIds);
  const profileRows = ((users ?? []) as UserProfileRow[]).filter((user) =>
    authorizedUserIds.has(user.id)
  );
  const [signedAvatarUrls, details] = await Promise.all([
    createSignedAvatarUrls(profileRows),
    loadProfileDetails(
      supabase,
      orgId,
      profileRows.map((user) => user.id)
    ),
  ]);

  const profiles = profileRows.map((user) => {
    const detail = details.get(user.id);
    return {
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: buildDisplayName(user, detail),
      full_name: buildFullName(user),
      avatar_url: signedAvatarUrls.get(user.id) ?? user.avatar_url,
      profile_href: profileHref(user.id),
      phone: detail?.phone ?? null,
      job_title: detail?.job_title ?? null,
      branch_name: detail?.branch_name ?? null,
      joined_at: detail?.joined_at ?? null,
    };
  });

  return { success: true, data: profiles };
}

export class OrgMemberPublicProfileService {
  static async countProfilesForOrg(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<number>> {
    const authResult = await authorizeViewer(supabase, orgId);
    if (!authResult.success) return authResult as { success: false; error: string };

    const { error, count } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };

    return { success: true, data: count ?? 0 };
  }

  static async listProfilesForOrg(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgMemberPublicProfile[]>> {
    const authResult = await authorizeViewer(supabase, orgId);
    if (!authResult.success) return authResult as { success: false; error: string };

    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (membershipError) {
      return { success: false, error: membershipError.message };
    }

    const userIds = ((memberships ?? []) as MembershipRow[]).map(
      (membership) => membership.user_id
    );

    return listAuthorizedProfiles(supabase, orgId, userIds);
  }

  static async listProfilesForOrgPage(
    supabase: SupabaseClient,
    orgId: string,
    pageInput = 1,
    pageSizeInput = 24
  ): Promise<ServiceResult<PaginatedOrgMemberPublicProfiles>> {
    const authResult = await authorizeViewer(supabase, orgId);
    if (!authResult.success) return authResult as { success: false; error: string };

    const page = normalizePage(pageInput);
    const pageSize = normalizePageSize(pageSizeInput);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const {
      data: memberships,
      error: membershipError,
      count,
    } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact" })
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (membershipError) {
      return { success: false, error: membershipError.message };
    }

    const userIds = ((memberships ?? []) as MembershipRow[]).map(
      (membership) => membership.user_id
    );
    const profilesResult = await listAuthorizedProfiles(supabase, orgId, userIds);
    if (!profilesResult.success) return profilesResult as { success: false; error: string };

    const totalCount = count ?? profilesResult.data.length;

    return {
      success: true,
      data: {
        rows: profilesResult.data,
        totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    };
  }

  /**
   * Avatar URLs of active members of the organization, by user id — for lists
   * that already have the names (conversations, chat members) and only miss the
   * picture. Private avatars are signed in one storage call; users without an
   * avatar are absent from the map.
   */
  static async avatarUrls(
    supabase: SupabaseClient,
    orgId: string,
    userIds: string[]
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    const targetUserIds = Array.from(new Set(userIds.filter(Boolean))).slice(
      0,
      MAX_AVATAR_LOOKUP_USERS
    );
    if (targetUserIds.length === 0) return urls;

    const authResult = await authorizeViewer(supabase, orgId);
    if (!authResult.success) return urls;

    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("user_id", targetUserIds);
    if (membershipError) return urls;
    const memberIds = ((memberships ?? []) as MembershipRow[]).map((row) => row.user_id);
    if (memberIds.length === 0) return urls;

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, avatar_url, avatar_path")
      .in("id", memberIds);
    if (usersError) return urls;
    const rows = (users ?? []) as UserProfileRow[];

    for (const user of rows) {
      if (user.avatar_url) urls.set(user.id, user.avatar_url);
    }
    const privateAvatars = rows.filter(canSignAvatarPath);
    if (privateAvatars.length === 0) return urls;

    try {
      const { data: signed, error } = await createServiceClient()
        .storage.from(USER_AVATAR_BUCKET)
        .createSignedUrls(
          privateAvatars.map((user) => user.avatar_path),
          AVATAR_SIGNED_URL_TTL_SECONDS
        );
      if (error) {
        console.error("[OrgMemberPublicProfileService] Failed to sign avatars", error);
        return urls;
      }
      (signed ?? []).forEach((item, index) => {
        const user = privateAvatars[index];
        if (user && item.signedUrl) urls.set(user.id, item.signedUrl);
      });
    } catch (error) {
      console.error(
        "[OrgMemberPublicProfileService] Service client unavailable for avatars",
        error
      );
    }
    return urls;
  }

  static async listProfiles(
    supabase: SupabaseClient,
    orgId: string,
    userIds: string[]
  ): Promise<ServiceResult<OrgMemberPublicProfile[]>> {
    const targetUserIds = uniqueUserIds(userIds);
    if (targetUserIds.length === 0) return { success: true, data: [] };

    const authResult = await authorizeViewer(supabase, orgId);
    if (!authResult.success) return authResult as { success: false; error: string };

    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("user_id", targetUserIds);

    if (membershipError) {
      return { success: false, error: membershipError.message };
    }

    const authorizedUserIds = new Set(
      ((memberships ?? []) as MembershipRow[]).map((membership) => membership.user_id)
    );
    if (authorizedUserIds.size === 0) return { success: true, data: [] };

    return listAuthorizedProfiles(supabase, orgId, Array.from(authorizedUserIds));
  }

  static async getProfile(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<OrgMemberPublicProfile>> {
    const result = await OrgMemberPublicProfileService.listProfiles(supabase, orgId, [userId]);
    if (!result.success) return result as { success: false; error: string };

    const profile = result.data[0];
    if (!profile) return { success: false, error: "Member profile not found" };

    return { success: true, data: profile };
  }
}
