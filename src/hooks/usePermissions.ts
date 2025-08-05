import { useState, useEffect } from "react";
import {
  fetchAllPermissions,
  fetchUserPermissionOverrides,
  PermissionOverride,
} from "@/lib/api/roles";
import { Database } from "../../../supabase/types/types";
import { useAppStore } from "@/lib/stores/app-store";

type Permission = Database["public"]["Tables"]["permissions"]["Row"];

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const permissionsData = await fetchAllPermissions();
      setPermissions(permissionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch permissions");
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  return {
    permissions,
    loading,
    error,
    refetch: fetchPermissions,
  };
}

export function useUserPermissionOverrides(userId: string | null) {
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchOverrides = async () => {
    if (!userId || !activeOrg?.id) {
      setOverrides([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const overridesData = await fetchUserPermissionOverrides(userId, activeOrg.id);
      setOverrides(overridesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch permission overrides");
      console.error("Error fetching permission overrides:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, [userId, activeOrg?.id, fetchOverrides]);

  return {
    overrides,
    loading,
    error,
    refetch: fetchOverrides,
  };
}

export function useUserPermissions(userId: string | null) {
  const { permissions: allPermissions } = usePermissions();
  const { overrides } = useUserPermissionOverrides(userId);

  // Combine permissions with overrides to get effective permissions
  const effectivePermissions = allPermissions.map((permission) => {
    const override = overrides.find((o) => o.permission_id === permission.id);
    return {
      ...permission,
      isGranted: override ? override.is_granted : false, // Default to false unless explicitly granted
      hasOverride: !!override,
    };
  });

  return {
    effectivePermissions,
    grantedPermissions: effectivePermissions.filter((p) => p.isGranted),
    deniedPermissions: effectivePermissions.filter((p) => !p.isGranted),
    overriddenPermissions: effectivePermissions.filter((p) => p.hasOverride),
  };
}
