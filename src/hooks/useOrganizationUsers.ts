import React, { useState, useEffect } from "react";
import { fetchOrganizationUsersWithRpc } from "@/app/actions/users/fetch-organization-users-with-rpc";
import { useAppStore } from "@/lib/stores/app-store";

export interface OrganizationUserWithDetails {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status_id: string | null;
  created_at: string | null;
  default_branch_id: string | null;
  avatar_url: string | null;
  role: {
    id: string;
    name: string;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
}

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
      const usersData = await fetchOrganizationUsersWithRpc(activeOrg.organization_id);
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
