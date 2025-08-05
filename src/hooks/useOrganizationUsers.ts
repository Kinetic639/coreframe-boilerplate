import React, { useState, useEffect } from "react";
import {
  fetchOrganizationUsersWithDetails,
  OrganizationUserWithDetails,
} from "@/lib/api/organization-users";
import { useAppStore } from "@/lib/stores/app-store";

export function useOrganizationUsers() {
  const [users, setUsers] = useState<OrganizationUserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchUsers = React.useCallback(async () => {
    if (!activeOrg?.id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const usersData = await fetchOrganizationUsersWithDetails(activeOrg.id);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      console.error("Error fetching organization users:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
  };
}
