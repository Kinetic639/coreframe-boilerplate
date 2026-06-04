"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  listTicketTypesAction,
  getTicketTypeDefaultRespondersAction,
  getTicketTypeDefaultAcceptorsAction,
  listOrgMembersForTicketAssignmentAction,
  createTicketAction,
  getTicketDetailAction,
  closeTicketAction,
  acceptTicketAction,
} from "@/app/actions/help-desk";
import type {
  AcceptTicketInput,
  CreateTicketInput,
  CloseTicketInput,
} from "@/lib/validations/helpdesk";
import type { HelpdeskTicketDetail } from "@/server/services/helpdesk-tickets.service";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const helpdeskKeys = {
  all: ["helpdesk"] as const,
  ticketTypes: () => [...helpdeskKeys.all, "ticket-types"] as const,
  ticketTypeDefaultResponders: (typeId: string) =>
    [...helpdeskKeys.ticketTypes(), typeId, "default-responders"] as const,
  tickets: () => [...helpdeskKeys.all, "tickets"] as const,
  ticketsDataView: () => [...helpdeskKeys.tickets(), "data-view"] as const,
  ticket: (id: string) => [...helpdeskKeys.tickets(), id] as const,
  ticketDetail: (id: string) => [...helpdeskKeys.ticket(id), "detail"] as const,
  orgMembers: () => [...helpdeskKeys.all, "org-members"] as const,
};

// ---------------------------------------------------------------------------
// Ticket Types
// ---------------------------------------------------------------------------

export function useHelpdeskTicketTypesQuery(
  initialData?: Awaited<ReturnType<typeof listTicketTypesAction>> extends { data: infer D }
    ? D
    : never
) {
  return useQuery({
    queryKey: helpdeskKeys.ticketTypes(),
    queryFn: async () => {
      const result = await listTicketTypesAction(false);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    initialData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTicketTypeDefaultRespondersQuery(ticketTypeId: string | null | undefined) {
  return useQuery({
    queryKey: ticketTypeId
      ? helpdeskKeys.ticketTypeDefaultResponders(ticketTypeId)
      : helpdeskKeys.ticketTypes(),
    queryFn: async () => {
      if (!ticketTypeId) return [];
      const result = await getTicketTypeDefaultRespondersAction(ticketTypeId);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    enabled: !!ticketTypeId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTicketTypeDefaultAcceptorsQuery(ticketTypeId: string | null | undefined) {
  return useQuery({
    queryKey: ticketTypeId
      ? [...helpdeskKeys.ticketTypeDefaultResponders(ticketTypeId), "acceptors"]
      : helpdeskKeys.ticketTypes(),
    queryFn: async () => {
      if (!ticketTypeId) return [];
      const result = await getTicketTypeDefaultAcceptorsAction(ticketTypeId);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    enabled: !!ticketTypeId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Org Members (for assignment selector)
// ---------------------------------------------------------------------------

export function useOrgMembersForAssignmentQuery() {
  return useQuery({
    queryKey: helpdeskKeys.orgMembers(),
    queryFn: async () => {
      const result = await listOrgMembersForTicketAssignmentAction();
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Ticket Detail
// ---------------------------------------------------------------------------

export function useTicketDetailQuery(
  ticketNumber: string,
  orgId: string,
  initialData?: HelpdeskTicketDetail
) {
  return useQuery({
    queryKey: helpdeskKeys.ticketDetail(ticketNumber),
    queryFn: async () => {
      const result = await getTicketDetailAction(ticketNumber, orgId);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Create Ticket
// ---------------------------------------------------------------------------

export function useCreateTicketMutation() {
  const t = useTranslations("modules.helpDesk");

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const result = await createTicketAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onError: (err: Error) => {
      toast.error(err.message || t("errors.createFailed"));
    },
  });
}

// ---------------------------------------------------------------------------
// Close Ticket
// ---------------------------------------------------------------------------

export function useCloseTicketMutation(ticketNumber: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.helpDesk");

  return useMutation({
    mutationFn: async (input: CloseTicketInput) => {
      const result = await closeTicketAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: helpdeskKeys.ticketDetail(ticketNumber) });
      queryClient.invalidateQueries({ queryKey: helpdeskKeys.ticketsDataView() });
      toast.success(t("tickets.ticketClosed"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("errors.closeFailed"));
    },
  });
}

// ---------------------------------------------------------------------------
// Accept Ticket
// ---------------------------------------------------------------------------

export function useAcceptTicketMutation(ticketNumber: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.helpDesk");

  return useMutation({
    mutationFn: async (input: AcceptTicketInput) => {
      const result = await acceptTicketAction(input);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: helpdeskKeys.ticketDetail(ticketNumber) });
      queryClient.invalidateQueries({ queryKey: helpdeskKeys.ticketsDataView() });
      toast.success(t("tickets.acceptance.acceptSuccess"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("errors.acceptFailed"));
    },
  });
}
