import React, { useState, useEffect } from "react";
import { fetchRolesWithUserCountsServer, fetchRoleStatisticsServer } from "@/app/actions/roles";
import { useAppStore } from "@/lib/stores/app-store";

export interface RoleWithUserCount {
  id: string;
  name: string;
  is_basic: boolean;
  organization_id: string | null;
  userCount: number;
  users: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  }[];
}

export function useRoles() {
  const [roles, setRoles] = useState<RoleWithUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchRoles = React.useCallback(async () => {
    if (!activeOrg?.organization_id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rolesData = await fetchRolesWithUserCountsServer(activeOrg.organization_id);
      setRoles(rolesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.organization_id]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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

  const fetchStatistics = React.useCallback(async () => {
    if (!activeOrg?.organization_id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const stats = await fetchRoleStatisticsServer(activeOrg.organization_id);
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch statistics");
      console.error("Error fetching role statistics:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.organization_id]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics,
  };
}
