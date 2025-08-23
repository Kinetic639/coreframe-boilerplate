import React, { useState, useEffect } from "react";
import {
  fetchUserDetailServer,
  type UserDetailWithAssignments,
} from "@/app/actions/users/fetch-user-detail";
import { useAppStore } from "@/lib/stores/app-store";

export function useUserDetail(userId: string) {
  const [user, setUser] = useState<UserDetailWithAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrg } = useAppStore();

  const fetchUser = React.useCallback(async () => {
    if (!activeOrg?.id || !userId) {
      setError("No active organization or user ID");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userData = await fetchUserDetailServer(userId, activeOrg.id);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user details");
      console.error("Error fetching user details:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id, userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    error,
    refetch: fetchUser,
  };
}
