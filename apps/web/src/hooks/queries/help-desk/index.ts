"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  createTicketAction,
  closeTicketAction,
  setTicketStatusAction,
  takeTicketAction,
  acceptTicketAction,
} from "@/app/actions/help-desk";
import type {
  AcceptTicketInput,
  CreateTicketInput,
  CloseTicketInput,
  SetTicketStatusInput,
  TakeTicketInput,
} from "@/lib/validations/helpdesk";
import type {
  HelpdeskTicketDetail,
  HelpdeskTicketListRow,
} from "@/server/services/helpdesk-tickets.service";
import { helpdeskRead } from "@/lib/help-desk/read";
import {
  patchTicket,
  refreshTicket,
  restoreTickets,
  ticketDetailQuery,
  ticketKeys,
  type TicketPatch,
} from "@/lib/help-desk/ticket-queries";
import { markOwnTicketSave } from "./own-saves";

// ---------------------------------------------------------------------------
// Query key factory (ticket keys live in lib/help-desk/ticket-queries.ts)
// ---------------------------------------------------------------------------

export const helpdeskKeys = {
  all: ["helpdesk"] as const,
  ticketTypes: () => [...helpdeskKeys.all, "ticket-types"] as const,
  ticketTypeDefaultResponders: (typeId: string) =>
    [...helpdeskKeys.ticketTypes(), typeId, "default-responders"] as const,
  ticketTypeDefaultAcceptors: (typeId: string) =>
    [...helpdeskKeys.ticketTypes(), typeId, "default-acceptors"] as const,
  ticketsDataView: (orgId: string) => ticketKeys.lists(orgId),
  ticketDetail: (orgId: string, ticketNumber: string) => ticketKeys.detail(orgId, ticketNumber),
  orgMembers: () => [...helpdeskKeys.all, "org-members"] as const,
};

type Result<T> = { success: true; data: T } | { success: false; error: string };

function unwrap<T>(result: Result<T>): T {
  if (!result.success) throw new Error((result as { success: false; error: string }).error);
  return result.data;
}

// ---------------------------------------------------------------------------
// Ticket types and people (reads over GET: they never wait behind a save)
// ---------------------------------------------------------------------------

export function useHelpdeskTicketTypesQuery(
  initialData?: Awaited<
    ReturnType<typeof import("@/app/actions/help-desk").listTicketTypesAction>
  > extends { data: infer D }
    ? D
    : never
) {
  return useQuery({
    queryKey: helpdeskKeys.ticketTypes(),
    queryFn: async () => unwrap(await helpdeskRead("ticketTypes", false)),
    initialData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTicketTypeDefaultRespondersQuery(ticketTypeId: string | null | undefined) {
  return useQuery({
    queryKey: helpdeskKeys.ticketTypeDefaultResponders(ticketTypeId ?? "none"),
    queryFn: async () =>
      ticketTypeId ? unwrap(await helpdeskRead("ticketTypeDefaultResponders", ticketTypeId)) : [],
    enabled: !!ticketTypeId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTicketTypeDefaultAcceptorsQuery(ticketTypeId: string | null | undefined) {
  return useQuery({
    queryKey: helpdeskKeys.ticketTypeDefaultAcceptors(ticketTypeId ?? "none"),
    queryFn: async () =>
      ticketTypeId ? unwrap(await helpdeskRead("ticketTypeDefaultAcceptors", ticketTypeId)) : [],
    enabled: !!ticketTypeId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useOrgMembersForAssignmentQuery() {
  return useQuery({
    queryKey: helpdeskKeys.orgMembers(),
    queryFn: async () => unwrap(await helpdeskRead("membersForAssignment")),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Ticket card
// ---------------------------------------------------------------------------

/** A ticket's card; the server's copy seeds it, so it renders without a request. */
export function useTicketDetailQuery(
  ticketNumber: string,
  orgId: string,
  initialData?: HelpdeskTicketDetail
) {
  return useQuery({
    ...ticketDetailQuery(orgId, ticketNumber),
    initialData,
    // The server copy is fresh: no request right after the page renders.
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function useCreateTicketMutation(orgId?: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.helpDesk");

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => unwrap(await createTicketAction(input)),
    onSuccess: () => {
      // A new ticket can land on any page: mark them stale, fetch when shown.
      if (orgId) {
        void queryClient.invalidateQueries({
          queryKey: ticketKeys.lists(orgId),
          refetchType: "none",
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("errors.createFailed"));
    },
  });
}

// ---------------------------------------------------------------------------
// Handler saves: shown at once, put back if the server says no
// ---------------------------------------------------------------------------

type TicketSaveOptions<I extends { ticket_id?: string }> = {
  ticketNumber: string;
  orgId: string;
  save: (input: I) => Promise<Result<HelpdeskTicketListRow | null | Record<string, unknown>>>;
  /** The change as it will look once saved, shown before the server answers. */
  preview?: (input: I) => TicketPatch | null;
  success: string;
  failure: string;
};

/**
 * The ticket changes on screen right away; the save returns the ticket as a
 * list row, which goes straight into the cached list pages and the card.
 * Then the card (its activity) and the list (a row may leave a filtered
 * view) are fetched once. Realtime echoes of this save are ignored.
 */
function useTicketSave<I extends { ticket_id?: string }>({
  ticketNumber,
  orgId,
  save,
  preview,
  success,
  failure,
}: TicketSaveOptions<I>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: I) => {
      markOwnTicketSave(input.ticket_id ?? "");
      return unwrap(await save(input));
    },
    onMutate: async (input: I) => {
      const patch = preview?.(input);
      if (!patch) return { snapshot: [] as ReturnType<typeof patchTicket> };
      // A fetch already on its way would bring the old values back.
      await queryClient.cancelQueries({ queryKey: ticketKeys.all(orgId) });
      return { snapshot: patchTicket(queryClient, orgId, input.ticket_id ?? "", patch) };
    },
    onSuccess: (data, input) => {
      markOwnTicketSave(input.ticket_id ?? "");
      if (isTicketRow(data)) writeSavedTicket(queryClient, orgId, data);
      void refreshTicket(queryClient, orgId, ticketNumber);
      toast.success(success);
    },
    onError: (err: Error, _input, context) => {
      if (context?.snapshot) restoreTickets(queryClient, context.snapshot);
      toast.error(err.message || failure);
    },
  });
}

function isTicketRow(value: unknown): value is HelpdeskTicketListRow {
  return Boolean(
    value && typeof value === "object" && "ticket_number" in value && "status" in value
  );
}

/** A saved ticket's row into every cached page and its card. */
export function writeSavedTicket(
  queryClient: QueryClient,
  orgId: string,
  row: HelpdeskTicketListRow
) {
  const { id: _id, org_id: _org, ...fields } = row;
  patchTicket(queryClient, orgId, row.id, fields);
}

export function useCloseTicketMutation(ticketNumber: string, orgId: string) {
  const t = useTranslations("modules.helpDesk");
  return useTicketSave<CloseTicketInput>({
    ticketNumber,
    orgId,
    save: closeTicketAction,
    preview: () => ({ status: "closed", closed_at: new Date().toISOString() }),
    success: t("tickets.ticketClosed"),
    failure: t("errors.closeFailed"),
  });
}

export function useSetTicketStatusMutation(ticketNumber: string, orgId: string) {
  const t = useTranslations("modules.helpDesk");
  return useTicketSave<SetTicketStatusInput>({
    ticketNumber,
    orgId,
    save: setTicketStatusAction,
    preview: (input) => ({ status: input.status }),
    success: t("tickets.handling.statusChanged"),
    failure: t("tickets.handling.failed"),
  });
}

export function useTakeTicketMutation(ticketNumber: string, orgId: string, userId?: string) {
  const t = useTranslations("modules.helpDesk");
  return useTicketSave<TakeTicketInput>({
    ticketNumber,
    orgId,
    save: takeTicketAction,
    preview: () => ({ status: "in_progress", ...(userId ? { assigned_to: userId } : {}) }),
    success: t("tickets.handling.taken"),
    failure: t("tickets.handling.failed"),
  });
}

export function useAcceptTicketMutation(ticketNumber: string, orgId: string, userId?: string) {
  const t = useTranslations("modules.helpDesk");
  return useTicketSave<AcceptTicketInput>({
    ticketNumber,
    orgId,
    save: acceptTicketAction,
    preview: () => ({
      accepted_at: new Date().toISOString(),
      ...(userId ? { accepted_by: userId } : {}),
    }),
    success: t("tickets.acceptance.acceptSuccess"),
    failure: t("errors.acceptFailed"),
  });
}
