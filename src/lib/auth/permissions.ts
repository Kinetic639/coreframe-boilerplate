import { createClient } from "@/lib/supabase/server";

export interface Permission {
  id: string;
  slug: string;
  label: string;
}

export interface UserRole {
  role: string;
  role_id: string;
  org_id?: string;
  branch_id?: string;
  scope: "org" | "branch";
  scope_id: string;
}

export interface EffectivePermissions {
  granted: Permission[];
  denied: Permission[];
  overrides: {
    permission_id: string;
    is_granted: boolean;
  }[];
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permissionSlug: string,
  scope: "org" | "branch",
  scopeId: string
): Promise<boolean> {
  const supabase = await createClient();

  try {
    // Get user's roles in the specified scope
    const { data: roleAssignments, error: roleError } = await supabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        roles:role_id (
          id,
          name,
          role_permissions (
            permissions:permission_id (
              id,
              slug
            )
          )
        )
      `
      )
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("scope_id", scopeId)
      .is("deleted_at", null);

    if (roleError) {
      console.error("Error fetching role assignments:", roleError);
      return false;
    }

    // Check if any of the user's roles have the required permission
    const hasRolePermission =
      roleAssignments?.some((assignment) =>
        (assignment.roles as any)?.role_permissions?.some(
          (rp) => (rp.permissions as any)?.slug === permissionSlug
        )
      ) || false;

    // Check for permission overrides
    const { data: override, error: overrideError } = await supabase
      .from("user_permission_overrides")
      .select(
        `
        allowed,
        permissions:permission_id (
          slug
        )
      `
      )
      .eq("user_id", userId)
      .eq("scope_id", scope === "org" ? scopeId : undefined)
      .is("deleted_at", null)
      .single();

    if (overrideError && overrideError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching permission override:", overrideError);
    }

    // If there's an override for this permission, use it
    if (override && (override.permissions as any)?.slug === permissionSlug) {
      return override.allowed;
    }

    // Otherwise, return the role-based permission
    return hasRolePermission;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Get all effective permissions for a user in an organization
 */
export async function getUserEffectivePermissions(
  userId: string,
  organizationId: string
): Promise<EffectivePermissions> {
  const supabase = await createClient();

  try {
    // Get all permissions that user has through roles
    const { data: rolePermissions, error: roleError } = await supabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        scope,
        scope_id,
        roles:role_id (
          id,
          name,
          role_permissions (
            permissions:permission_id (
              id,
              slug,
              label
            )
          )
        )
      `
      )
      .eq("user_id", userId)
      .or(`scope_id.eq.${organizationId}`) // Include both org and branch roles for this org
      .is("deleted_at", null);

    if (roleError) {
      throw new Error(`Failed to fetch role permissions: ${roleError.message}`);
    }

    // Flatten all permissions from roles
    const allRolePermissions = new Map<string, Permission>();
    rolePermissions?.forEach((assignment) => {
      (assignment.roles as any)?.role_permissions?.forEach((rp) => {
        if (rp.permissions) {
          allRolePermissions.set(rp.permissions.id, rp.permissions);
        }
      });
    });

    // Get permission overrides
    const { data: overrides, error: overrideError } = await supabase
      .from("user_permission_overrides")
      .select(
        `
        permission_id,
        allowed,
        permissions:permission_id (
          id,
          slug,
          label
        )
      `
      )
      .eq("user_id", userId)
      .eq("scope_id", organizationId)
      .is("deleted_at", null);

    if (overrideError) {
      throw new Error(`Failed to fetch permission overrides: ${overrideError.message}`);
    }

    // Apply overrides
    const granted: Permission[] = [];
    const denied: Permission[] = [];
    const processedPermissions = new Set<string>();

    // Process overrides first
    overrides?.forEach((override) => {
      if (override.permissions) {
        processedPermissions.add((override.permissions as any).id);
        if (override.allowed) {
          granted.push(override.permissions as any);
        } else {
          denied.push(override.permissions as any);
        }
      }
    });

    // Add remaining role permissions that don't have overrides
    Array.from(allRolePermissions.values()).forEach((permission) => {
      if (!processedPermissions.has((permission as any).id)) {
        granted.push(permission);
      }
    });

    return {
      granted,
      denied,
      overrides:
        overrides?.map((o) => ({
          permission_id: o.permission_id,
          is_granted: o.allowed,
        })) || [],
    };
  } catch (error) {
    console.error("Error getting user effective permissions:", error);
    return {
      granted: [],
      denied: [],
      overrides: [],
    };
  }
}

/**
 * Validate if a user can assign a specific role to another user
 */
export async function validateRoleAssignment(
  assignerUserId: string,
  targetUserId: string,
  roleId: string,
  scope: "org" | "branch",
  scopeId: string
): Promise<{ isValid: boolean; reason?: string }> {
  const supabase = await createClient();

  try {
    // Get the role being assigned
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      return { isValid: false, reason: "Role not found" };
    }

    // Get assigner's roles
    const { data: assignerRoles, error: assignerError } = await supabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        scope,
        scope_id,
        roles:role_id (
          name
        )
      `
      )
      .eq("user_id", assignerUserId)
      .is("deleted_at", null);

    if (assignerError) {
      return { isValid: false, reason: "Failed to verify assigner permissions" };
    }

    // Check if assigner is org_owner in the target organization
    const isOrgOwner = assignerRoles?.some(
      (assignment) =>
        (assignment.roles as any)?.name === "org_owner" &&
        assignment.scope === "org" &&
        assignment.scope_id === (scope === "org" ? scopeId : scopeId) // For branch assignments, still need org-level permission
    );

    if (!isOrgOwner) {
      return { isValid: false, reason: "Only organization owners can assign roles" };
    }

    // Check if target user already has this role
    const { data: existingAssignment } = await supabase
      .from("user_role_assignments")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("role_id", roleId)
      .eq("scope", scope)
      .eq("scope_id", scopeId)
      .is("deleted_at", null)
      .single();

    if (existingAssignment) {
      return { isValid: false, reason: "User already has this role" };
    }

    // If we're here, the assignment is valid
    return { isValid: true };
  } catch (error) {
    console.error("Error validating role assignment:", error);
    return { isValid: false, reason: "Internal error during validation" };
  }
}

/**
 * Get user's roles with permission details
 */
export async function getUserRolesWithPermissions(userId: string, organizationId: string) {
  const supabase = await createClient();

  const { data: roleAssignments, error } = await supabase
    .from("user_role_assignments")
    .select(
      `
      id,
      scope,
      scope_id,
      roles:role_id (
        id,
        name,
        is_basic,
        role_permissions (
          permissions:permission_id (
            id,
            slug,
            label
          )
        )
      )
    `
    )
    .eq("user_id", userId)
    .or(`scope_id.eq.${organizationId}`)
    .is("deleted_at", null)
    .order("scope", { ascending: false }); // org roles first

  if (error) {
    throw new Error(`Failed to fetch user roles: ${error.message}`);
  }

  return roleAssignments || [];
}

/**
 * Check if user has any of the specified roles in the given scope
 */
export async function hasAnyRole(
  userId: string,
  roleNames: string[],
  scope: "org" | "branch",
  scopeId: string
): Promise<boolean> {
  const supabase = await createClient();

  try {
    const { data: roleAssignments, error } = await supabase
      .from("user_role_assignments")
      .select(
        `
        roles:role_id (
          name
        )
      `
      )
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("scope_id", scopeId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error checking user roles:", error);
      return false;
    }

    return (
      roleAssignments?.some((assignment) =>
        roleNames.includes((assignment.roles as any)?.name || "")
      ) || false
    );
  } catch (error) {
    console.error("Error in hasAnyRole:", error);
    return false;
  }
}

/**
 * Middleware helper to check permissions in server actions
 */
export async function requirePermission(
  permissionSlug: string,
  scope: "org" | "branch",
  scopeId: string
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  const hasAccess = await hasPermission(session.user.id, permissionSlug, scope, scopeId);

  if (!hasAccess) {
    throw new Error(`Permission denied: ${permissionSlug}`);
  }

  return session.user.id;
}

/**
 * Middleware helper to check roles in server actions
 */
export async function requireRole(
  roleNames: string[],
  scope: "org" | "branch",
  scopeId: string
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  const hasAccess = await hasAnyRole(session.user.id, roleNames, scope, scopeId);

  if (!hasAccess) {
    throw new Error(`Role required: ${roleNames.join(" or ")}`);
  }

  return session.user.id;
}
