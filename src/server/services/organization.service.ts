/**
 * Organization Management Service
 *
 * Covers all org-management domains: profile, members, invitations,
 * roles, billing, positions, and branches.
 *
 * Constraints:
 * - Server-only (never import from client components)
 * - Uses authenticated Supabase client only (no service role)
 * - Never bypasses RLS
 * - Fail-closed: returns structured errors, never throws to callers
 */

import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Shared Types ────────────────────────────────────────────────────────────

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Normalize a Supabase/Postgres error to a user-friendly message.
 * RLS denials (code 42501 or "row-level security" in message) are converted
 * to a human-readable string so raw Postgres text never reaches client toasts.
 */
function normalizeDbError(error: { code?: string; message: string }): string {
  if (
    error.code === "42501" ||
    error.message?.includes("row-level security") ||
    error.message?.includes("violates row-level security policy")
  ) {
    return "You don't have permission to manage roles for this branch.";
  }
  return error.message;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface OrgProfileData {
  organization_id: string;
  name: string | null;
  name_2: string | null;
  slug: string | null;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  theme_color: string | null;
  font_color: string | null;
  created_at: string | null;
}

export interface UpdateOrgProfileInput {
  name?: string | null;
  name_2?: string | null;
  slug?: string | null;
  bio?: string | null;
  website?: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  font_color?: string | null;
}

export class OrgProfileService {
  static async getProfile(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgProfileData>> {
    const { data, error } = await supabase
      .from("organization_profiles")
      .select(
        "organization_id, name, name_2, slug, bio, website, logo_url, theme_color, font_color, created_at"
      )
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Organization profile not found" };
    return { success: true, data };
  }

  static async updateProfile(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateOrgProfileInput
  ): Promise<ServiceResult<OrgProfileData>> {
    const { data, error } = await supabase
      .from("organization_profiles")
      .update(input)
      .eq("organization_id", orgId)
      .select(
        "organization_id, name, name_2, slug, bio, website, logo_url, theme_color, font_color, created_at"
      )
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Update failed or unauthorized" };
    return { success: true, data };
  }

  static async uploadLogo(
    supabase: SupabaseClient,
    orgId: string,
    file: File
  ): Promise<ServiceResult<string>> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${orgId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("org-logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) return { success: false, error: "Failed to get public URL for logo" };

    // Save public URL to profile
    const updateResult = await OrgProfileService.updateProfile(supabase, orgId, {
      logo_url: publicUrl,
    });
    if (!updateResult.success) return updateResult as { success: false; error: string };

    return { success: true, data: publicUrl };
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  joined_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined user info
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_avatar_url: string | null;
  // Joined role info (includes org-scoped and branch-scoped assignments)
  roles: Array<{ id: string; name: string; scope: "org" | "branch"; scope_id: string }>;
}

/** One group in the getMembersGroupedByBranch result. */
export interface BranchMemberGroup {
  /** Branch UUID, or null for the "org-only / unassigned" group. */
  branchId: string | null;
  /** Branch display name, or null for the unassigned group. */
  branchName: string | null;
  /** Members who have at least one branch-scoped role in this branch. */
  members: OrgMember[];
}

export class OrgMembersService {
  static async listMembers(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgMember[]>> {
    // Fetch members, then join user info in a second query to avoid RLS join issues
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("id, organization_id, user_id, status, joined_at, created_at, updated_at")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return { success: true, data: [] };

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, avatar_url")
      .in("id", userIds);

    if (usersError) return { success: false, error: usersError.message };

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));

    // Fetch org-scoped role assignments
    const { data: orgAssignments } = await supabase
      .from("user_role_assignments")
      .select("user_id, role_id, scope, scope_id, roles!inner(id, name)")
      .eq("scope", "org")
      .eq("scope_id", orgId)
      .in("user_id", userIds)
      .is("deleted_at", null);

    // Fetch branch-scoped role assignments (for branches belonging to this org)
    const { data: orgBranchList } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    const memberBranchIds = (orgBranchList ?? []).map((b) => b.id);

    let branchRoleAssignments: NonNullable<typeof orgAssignments> = [];
    if (memberBranchIds.length > 0) {
      const { data: ba } = await supabase
        .from("user_role_assignments")
        .select("user_id, role_id, scope, scope_id, roles!inner(id, name)")
        .eq("scope", "branch")
        .in("scope_id", memberBranchIds)
        .in("user_id", userIds)
        .is("deleted_at", null);
      branchRoleAssignments = ba ?? [];
    }

    const rolesByUser = new Map<
      string,
      Array<{ id: string; name: string; scope: "org" | "branch"; scope_id: string }>
    >();
    for (const a of [...(orgAssignments ?? []), ...branchRoleAssignments]) {
      const rawAssignment = a as unknown as {
        user_id: string;
        role_id: string;
        scope: string;
        scope_id: string;
        roles: { id: string; name: string } | { id: string; name: string }[];
      };
      const rawRole = rawAssignment.roles;
      const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
      if (!role) continue;
      const existing = rolesByUser.get(rawAssignment.user_id) ?? [];
      rolesByUser.set(rawAssignment.user_id, [
        ...existing,
        {
          id: role.id,
          name: role.name,
          scope: rawAssignment.scope as "org" | "branch",
          scope_id: rawAssignment.scope_id,
        },
      ]);
    }

    const result: OrgMember[] = (members ?? []).map((m) => {
      const u = userMap.get(m.user_id);
      return {
        ...m,
        user_email: u?.email ?? null,
        user_first_name: u?.first_name ?? null,
        user_last_name: u?.last_name ?? null,
        user_avatar_url: u?.avatar_url ?? null,
        roles: rolesByUser.get(m.user_id) ?? [],
      };
    });

    return { success: true, data: result };
  }

  static async updateMemberStatus(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    status: "active" | "inactive"
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("organization_members")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async removeMember(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<void>> {
    const now = new Date().toISOString();

    // Step 1: Soft-delete the membership
    const { error } = await supabase
      .from("organization_members")
      .update({ deleted_at: now })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };

    // Step 2: Revoke org-scoped role assignments (prevents stale-role SELECT access)
    await supabase
      .from("user_role_assignments")
      .update({ deleted_at: now })
      .eq("user_id", userId)
      .eq("scope", "org")
      .eq("scope_id", orgId)
      .is("deleted_at", null);

    // Step 3: Revoke branch-scoped role assignments for branches in this org
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (branches && branches.length > 0) {
      const branchIds = branches.map((b) => b.id);
      await supabase
        .from("user_role_assignments")
        .update({ deleted_at: now })
        .eq("user_id", userId)
        .eq("scope", "branch")
        .in("scope_id", branchIds)
        .is("deleted_at", null);
    }

    return { success: true, data: undefined };
  }

  static async getMember(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<OrgMember>> {
    const { data: member, error } = await supabase
      .from("organization_members")
      .select("id, organization_id, user_id, status, joined_at, created_at, updated_at")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!member) return { success: false, error: "Member not found" };

    const { data: user } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    return {
      success: true,
      data: {
        ...member,
        user_email: user?.email ?? null,
        user_first_name: user?.first_name ?? null,
        user_last_name: user?.last_name ?? null,
        user_avatar_url: user?.avatar_url ?? null,
        roles: [],
      },
    };
  }

  /**
   * Returns org members grouped by the branch(es) where they hold at least one
   * branch-scoped role assignment.
   *
   * Derived grouping only — no separate branch_members table.
   * - Members with zero branch assignments go in the "org-only / unassigned" group
   *   (branchId: null, branchName: null).
   * - A member with assignments in multiple branches appears in each relevant group.
   * - Groups are ordered by branch name; the unassigned group is always last.
   */
  static async getMembersGroupedByBranch(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<BranchMemberGroup[]>> {
    const membersResult = await OrgMembersService.listMembers(supabase, orgId);
    if (!membersResult.success) return membersResult as { success: false; error: string };
    const members = membersResult.data;

    const { data: branches, error: branchError } = await supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name");

    if (branchError) return { success: false, error: branchError.message };

    const branchNameMap = new Map(
      (branches ?? []).map((b) => [b.id, (b.name as string | null) ?? null])
    );

    const branchGroups = new Map<string, OrgMember[]>();
    const unassigned: OrgMember[] = [];

    for (const member of members) {
      const branchRoles = member.roles.filter((r) => r.scope === "branch");
      if (branchRoles.length === 0) {
        unassigned.push(member);
        continue;
      }
      const seenBranches = new Set<string>();
      for (const role of branchRoles) {
        if (seenBranches.has(role.scope_id)) continue;
        seenBranches.add(role.scope_id);
        const existing = branchGroups.get(role.scope_id) ?? [];
        existing.push(member);
        branchGroups.set(role.scope_id, existing);
      }
    }

    const result: BranchMemberGroup[] = [];
    for (const [branchId, branchMembers] of branchGroups) {
      result.push({
        branchId,
        branchName: branchNameMap.get(branchId) ?? null,
        members: branchMembers,
      });
    }
    result.sort((a, b) => (a.branchName ?? "").localeCompare(b.branchName ?? ""));

    if (unassigned.length > 0) {
      result.push({ branchId: null, branchName: null, members: unassigned });
    }

    return { success: true, data: result };
  }
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export interface OrgInvitation {
  id: string;
  email: string;
  invited_by: string;
  organization_id: string | null;
  branch_id: string | null;
  role_id: string | null;
  token: string;
  status: string;
  expires_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string | null;
  deleted_at: string | null;
}

export interface CreateInvitationInput {
  email: string;
  role_id?: string | null;
  branch_id?: string | null;
  expires_at?: string | null;
}

export class OrgInvitationsService {
  static async listInvitations(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgInvitation[]>> {
    const { data, error } = await supabase
      .from("invitations")
      .select(
        "id, email, invited_by, organization_id, branch_id, role_id, token, status, expires_at, accepted_at, declined_at, created_at, deleted_at"
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  }

  static async createInvitation(
    supabase: SupabaseClient,
    orgId: string,
    invitedBy: string,
    input: CreateInvitationInput
  ): Promise<ServiceResult<OrgInvitation>> {
    const token = crypto.randomUUID();
    const expiresAt =
      input.expires_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data, error } = await supabase
      .from("invitations")
      .insert({
        email: input.email.toLowerCase().trim(),
        invited_by: invitedBy,
        organization_id: orgId,
        role_id: input.role_id ?? null,
        branch_id: input.branch_id ?? null,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .select(
        "id, email, invited_by, organization_id, branch_id, role_id, token, status, expires_at, accepted_at, declined_at, created_at, deleted_at"
      )
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Failed to create invitation" };
    return { success: true, data };
  }

  static async cancelInvitation(
    supabase: SupabaseClient,
    invitationId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId)
      .eq("status", "pending")
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async resendInvitation(
    supabase: SupabaseClient,
    invitationId: string
  ): Promise<ServiceResult<{ token: string; email: string; organization_id: string }>> {
    // Generate a new token and extend expiry
    const newToken = crypto.randomUUID();
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("invitations")
      .update({ token: newToken, expires_at: newExpiry, status: "pending" })
      .eq("id", invitationId)
      .is("deleted_at", null)
      .select("token, email, organization_id")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Invitation not found or unauthorized" };
    if (!data.organization_id) return { success: false, error: "Invitation has no organization" };
    return {
      success: true,
      data: { token: data.token, email: data.email, organization_id: data.organization_id },
    };
  }

  static async acceptInvitation(
    supabase: SupabaseClient,
    token: string
  ): Promise<ServiceResult<{ organization_id: string }>> {
    const { data, error } = await supabase.rpc("accept_invitation_and_join_org", {
      p_token: token,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; error_code?: string; organization_id?: string };
    if (!result.success) return { success: false, error: result.error_code ?? "Acceptance failed" };
    if (!result.organization_id) return { success: false, error: "No organization returned" };

    return { success: true, data: { organization_id: result.organization_id } };
  }

  static async cleanupExpiredInvitations(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<number>> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .lt("expires_at", now)
      .is("deleted_at", null)
      .select("id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []).length };
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface OrgRole {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  is_basic: boolean;
  scope_type: string;
  deleted_at: string | null;
  permission_slugs: string[];
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  permission_slugs?: string[];
  scope_type?: "org" | "branch";
}

export interface OrgRoleAssignment {
  id: string;
  role_id: string;
  role_name: string;
  role_is_basic: boolean;
  role_scope_type: string;
  scope: string;
  scope_id: string;
  branch_name: string | null;
}

export interface OrgMemberAccess {
  user_id: string;
  assignments: OrgRoleAssignment[];
}

export class OrgRolesService {
  static async listRoles(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgRole[]>> {
    const { data: roles, error } = await supabase
      .from("roles")
      .select("id, organization_id, name, description, is_basic, scope_type, deleted_at")
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .is("deleted_at", null)
      .order("is_basic", { ascending: false });

    if (error) return { success: false, error: error.message };

    // Load permissions for each role
    const roleIds = (roles ?? []).map((r) => r.id);
    if (roleIds.length === 0) return { success: true, data: [] };

    const { data: rolePerm, error: rpErr } = await supabase
      .from("role_permissions")
      .select("role_id, permissions!inner(slug)")
      .in("role_id", roleIds);

    if (rpErr) return { success: false, error: rpErr.message };

    const permMap = new Map<string, string[]>();
    for (const rp of rolePerm ?? []) {
      const slug = (rp.permissions as any)?.slug as string;
      if (!slug) continue;
      const existing = permMap.get(rp.role_id) ?? [];
      permMap.set(rp.role_id, [...existing, slug]);
    }

    const result: OrgRole[] = (roles ?? []).map((r) => ({
      ...r,
      organization_id: r.organization_id ?? null,
      permission_slugs: permMap.get(r.id) ?? [],
    }));

    return { success: true, data: result };
  }

  static async createRole(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateRoleInput
  ): Promise<ServiceResult<OrgRole>> {
    const { data: role, error } = await supabase
      .from("roles")
      .insert({
        organization_id: orgId,
        name: input.name,
        description: input.description ?? null,
        is_basic: false,
        scope_type: input.scope_type ?? "org",
      })
      .select("id, organization_id, name, description, is_basic, scope_type, deleted_at")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!role) return { success: false, error: "Role creation failed" };

    // Assign permissions if provided
    if (input.permission_slugs && input.permission_slugs.length > 0) {
      const setResult = await OrgRolesService.setRolePermissions(
        supabase,
        role.id,
        input.permission_slugs
      );
      if (!setResult.success) return setResult as { success: false; error: string };
    }

    return {
      success: true,
      data: {
        ...role,
        organization_id: role.organization_id ?? null,
        permission_slugs: input.permission_slugs ?? [],
      },
    };
  }

  static async updateRole(
    supabase: SupabaseClient,
    roleId: string,
    input: Partial<CreateRoleInput>
  ): Promise<ServiceResult<void>> {
    if (input.name !== undefined || input.description !== undefined) {
      const { error } = await supabase
        .from("roles")
        .update({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        })
        .eq("id", roleId)
        .eq("is_basic", false); // Cannot edit system roles

      if (error) return { success: false, error: error.message };
    }

    if (input.permission_slugs !== undefined) {
      const setResult = await OrgRolesService.setRolePermissions(
        supabase,
        roleId,
        input.permission_slugs
      );
      if (!setResult.success) return setResult;
    }

    return { success: true, data: undefined };
  }

  static async deleteRole(supabase: SupabaseClient, roleId: string): Promise<ServiceResult<void>> {
    // Uses a SECURITY DEFINER RPC to atomically:
    // 1. Soft-delete all user_role_assignments for this role (unassign members)
    // 2. Soft-delete all role_permissions
    // 3. Soft-delete the role itself
    // This avoids the RLS WITH CHECK issue on direct UPDATE via PostgREST.
    const { error } = await supabase.rpc("delete_org_role", { p_role_id: roleId });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async setRolePermissions(
    supabase: SupabaseClient,
    roleId: string,
    slugs: string[]
  ): Promise<ServiceResult<void>> {
    // Resolve slugs to permission IDs
    const { data: perms, error: permErr } = await supabase
      .from("permissions")
      .select("id, slug")
      .in("slug", slugs);

    if (permErr) return { success: false, error: permErr.message };

    const permIds = (perms ?? []).map((p) => p.id);

    // Delete existing assignments
    const { error: delErr } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (delErr) return { success: false, error: delErr.message };

    // Re-insert
    if (permIds.length > 0) {
      const { error: insErr } = await supabase
        .from("role_permissions")
        .insert(permIds.map((pid) => ({ role_id: roleId, permission_id: pid })));
      if (insErr) return { success: false, error: insErr.message };
    }

    return { success: true, data: undefined };
  }

  static async assignRoleToUser(
    supabase: SupabaseClient,
    userId: string,
    roleId: string,
    orgId: string,
    scope: "org" | "branch" = "org",
    scopeId?: string
  ): Promise<ServiceResult<void>> {
    const effectiveScopeId = scopeId ?? orgId;
    const { error } = await supabase.from("user_role_assignments").upsert(
      {
        user_id: userId,
        role_id: roleId,
        scope,
        scope_id: effectiveScopeId,
        deleted_at: null,
      },
      { onConflict: "user_id,role_id,scope,scope_id" }
    );

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async removeRoleFromUser(
    supabase: SupabaseClient,
    userId: string,
    roleId: string,
    orgId: string,
    scope: "org" | "branch" = "org",
    scopeId?: string
  ): Promise<ServiceResult<void>> {
    const effectiveScopeId = scopeId ?? orgId;
    const { error } = await supabase
      .from("user_role_assignments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("role_id", roleId)
      .eq("scope", scope)
      .eq("scope_id", effectiveScopeId)
      .is("deleted_at", null);

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async getUserRoleAssignments(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<string[]>> {
    // Org-scoped assignments
    const { data: orgData, error: orgErr } = await supabase
      .from("user_role_assignments")
      .select("role_id")
      .eq("scope", "org")
      .eq("scope_id", orgId)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (orgErr) return { success: false, error: orgErr.message };

    // Branch-scoped assignments (branches belonging to this org)
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    const branchIds = (branches ?? []).map((b) => b.id);
    let branchRoleIds: string[] = [];

    if (branchIds.length > 0) {
      const { data: branchData } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("scope", "branch")
        .in("scope_id", branchIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      branchRoleIds = (branchData ?? []).map((r) => r.role_id);
    }

    const allRoleIds = [...new Set([...(orgData ?? []).map((r) => r.role_id), ...branchRoleIds])];
    return { success: true, data: allRoleIds };
  }

  static async getMemberAccess(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<OrgMemberAccess>> {
    // Get branches for this org (for name lookup and branch-scope filtering)
    const { data: branches, error: brErr } = await supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (brErr) return { success: false, error: brErr.message };

    const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name as string]));
    const branchIds = Array.from(branchMap.keys());

    // Org-scoped assignments
    const { data: orgAssign, error: orgErr } = await supabase
      .from("user_role_assignments")
      .select("id, role_id, scope, scope_id, roles!inner(id, name, is_basic, scope_type)")
      .eq("user_id", userId)
      .eq("scope", "org")
      .eq("scope_id", orgId)
      .is("deleted_at", null);

    if (orgErr) return { success: false, error: orgErr.message };

    // Branch-scoped assignments
    let branchAssign: typeof orgAssign = [];
    if (branchIds.length > 0) {
      const { data: ba, error: baErr } = await supabase
        .from("user_role_assignments")
        .select("id, role_id, scope, scope_id, roles!inner(id, name, is_basic, scope_type)")
        .eq("user_id", userId)
        .eq("scope", "branch")
        .in("scope_id", branchIds)
        .is("deleted_at", null);

      if (baErr) return { success: false, error: baErr.message };
      branchAssign = ba ?? [];
    }

    const allAssignments = [...(orgAssign ?? []), ...branchAssign];
    const result: OrgRoleAssignment[] = allAssignments.map((a) => {
      const roleData = (
        a as unknown as {
          roles: { id: string; name: string; is_basic: boolean; scope_type: string };
        }
      ).roles;
      return {
        id: a.id,
        role_id: a.role_id,
        role_name: roleData?.name ?? "Unknown",
        role_is_basic: roleData?.is_basic ?? false,
        role_scope_type: roleData?.scope_type ?? "org",
        scope: a.scope,
        scope_id: a.scope_id,
        branch_name: a.scope === "branch" ? (branchMap.get(a.scope_id) ?? null) : null,
      };
    });

    return { success: true, data: { user_id: userId, assignments: result } };
  }
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingOverview {
  organization_id: string;
  plan_name: string;
  enabled_modules: string[];
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
  updated_at: string;
}

export class OrgBillingService {
  static async getBillingOverview(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<BillingOverview>> {
    const { data, error } = await supabase
      .from("organization_entitlements")
      .select("organization_id, plan_name, enabled_modules, limits, features, updated_at")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Entitlements not found for organization" };

    return {
      success: true,
      data: {
        organization_id: data.organization_id,
        plan_name: data.plan_name,
        enabled_modules: (data.enabled_modules as string[]) ?? [],
        limits: (data.limits as Record<string, unknown>) ?? {},
        features: (data.features as Record<string, unknown>) ?? {},
        updated_at: data.updated_at,
      },
    };
  }
}

// ─── Positions ────────────────────────────────────────────────────────────────

export interface OrgPosition {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface OrgPositionAssignment {
  id: string;
  org_id: string;
  user_id: string;
  position_id: string;
  branch_id: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  // Joined
  position_name: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

export interface CreatePositionInput {
  name: string;
  description?: string | null;
}

export class OrgPositionsService {
  static async listPositions(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgPosition[]>> {
    const { data, error } = await supabase
      .from("org_positions")
      .select("id, org_id, name, description, created_at, updated_at, created_by, deleted_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  }

  static async createPosition(
    supabase: SupabaseClient,
    orgId: string,
    createdBy: string,
    input: CreatePositionInput
  ): Promise<ServiceResult<OrgPosition>> {
    const { data, error } = await supabase
      .from("org_positions")
      .insert({
        org_id: orgId,
        name: input.name,
        description: input.description ?? null,
        created_by: createdBy,
      })
      .select("id, org_id, name, description, created_at, updated_at, created_by, deleted_at")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Position creation failed" };
    return { success: true, data };
  }

  static async updatePosition(
    supabase: SupabaseClient,
    positionId: string,
    orgId: string,
    input: Partial<CreatePositionInput>
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("org_positions")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", positionId)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async deletePosition(
    supabase: SupabaseClient,
    positionId: string,
    orgId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("org_positions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", positionId)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async assignPosition(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    positionId: string,
    createdBy: string,
    branchId?: string | null
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase.from("org_position_assignments").insert({
      org_id: orgId,
      user_id: userId,
      position_id: positionId,
      branch_id: branchId ?? null,
      created_by: createdBy,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async removeAssignment(
    supabase: SupabaseClient,
    assignmentId: string,
    orgId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("org_position_assignments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async listAssignmentsForOrg(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgPositionAssignment[]>> {
    const { data, error } = await supabase
      .from("org_position_assignments")
      .select(
        "id, org_id, user_id, position_id, branch_id, created_at, created_by, deleted_at, org_positions!inner(name)"
      )
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };

    const userIds = Array.from(new Set((data ?? []).map((a) => a.user_id)));
    const { data: users } = await supabase
      .from("users")
      .select("id, email, first_name, last_name")
      .in("id", userIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));

    const result: OrgPositionAssignment[] = (data ?? []).map((a) => {
      const u = userMap.get(a.user_id);
      return {
        ...a,
        position_name: (a.org_positions as any)?.name ?? null,
        user_email: u?.email ?? null,
        user_first_name: u?.first_name ?? null,
        user_last_name: u?.last_name ?? null,
      };
    });

    return { success: true, data: result };
  }
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export interface OrgBranch {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  created_at: string | null;
  deleted_at: string | null;
}

export interface CreateBranchInput {
  name: string;
  slug?: string | null;
}

export class OrgBranchesService {
  static async listBranches(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<OrgBranch[]>> {
    const { data, error } = await supabase
      .from("branches")
      .select("id, organization_id, name, slug, created_at, deleted_at")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  }

  static async createBranch(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateBranchInput
  ): Promise<ServiceResult<OrgBranch>> {
    const { data, error } = await supabase
      .from("branches")
      .insert({
        organization_id: orgId,
        name: input.name,
        slug: input.slug ?? null,
      })
      .select("id, organization_id, name, slug, created_at, deleted_at")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Branch creation failed" };
    return { success: true, data };
  }

  static async updateBranch(
    supabase: SupabaseClient,
    branchId: string,
    orgId: string,
    input: Partial<CreateBranchInput>
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("branches")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      })
      .eq("id", branchId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async deleteBranch(
    supabase: SupabaseClient,
    branchId: string,
    orgId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("branches")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", branchId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
