import React, { useState, useEffect } from "react";
import {
  fetchOrganizationInvitationsServer,
  fetchInvitationStatisticsServer,
  type InvitationWithDetails,
  type InvitationStats,
} from "@/app/actions/invitations-server";
import { useAppStore } from "@/lib/stores/app-store";

export function useOrganizationInvitations() {
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([]);
  const [stats, setStats] = useState<InvitationStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrgId } = useAppStore();

  const loadInvitations = React.useCallback(async () => {
    if (!activeOrgId) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [invitationsData, statsData] = await Promise.all([
        fetchOrganizationInvitationsServer(activeOrgId),
        fetchInvitationStatisticsServer(activeOrgId),
      ]);

      setInvitations(invitationsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invitations");
      console.error("Error fetching organization invitations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  return {
    invitations,
    stats,
    loading,
    error,
    refetch: loadInvitations,
  };
}
