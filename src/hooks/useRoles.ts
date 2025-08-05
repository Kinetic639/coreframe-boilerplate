import { useState, useEffect } from "react";
import { fetchRolesWithUserCounts, fetchRoleStatistics, RoleWithUserCount } from "@/lib/api/roles";
import { useAppStore } from "@/lib/stores/app-store";

export function useRoles() {
  const [roles, setRoles] = useState<RoleWithUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchRoles = async () => {
    if (!activeOrg?.id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rolesData = await fetchRolesWithUserCounts(activeOrg.id);
      setRoles(rolesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [activeOrg?.id, fetchRoles]);

  return {
    roles,
    loading,
    error,
    refetch: fetchRoles,
  };
}

export function useRoleStatistics() {
  const [statistics, setStatistics] = useState({
    totalRoles: 0,
    totalAssignments: 0,
    orgOwnersCount: 0,
    totalPermissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchStatistics = async () => {
    if (!activeOrg?.id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const stats = await fetchRoleStatistics(activeOrg.id);
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch statistics");
      console.error("Error fetching role statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [activeOrg?.id, fetchStatistics]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics,
  };
}
