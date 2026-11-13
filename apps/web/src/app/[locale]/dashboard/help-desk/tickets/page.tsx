import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  HELPDESK_TICKETS_READ,
  HELPDESK_TICKETS_CREATE,
  HELPDESK_TICKETS_MANAGE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validations/helpdesk";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { Button } from "@/components/ui/button";
import { TicketFilters, TicketQueues, TicketsTotal } from "./_components/tickets-controls";
import { ticketKeys } from "./_components/tickets-query";
import { ticketColumnSet } from "./_components/tickets-table";
import { HelpDeskTicketsWorkspace } from "./_components/tickets-workspace";
import {
  loadTicketState,
  migrateTicketSearchParams,
  ticketHref,
  ticketListParams,
} from "./_components/tickets-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

export default async function HelpDeskTicketsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.helpDesk"),
  ]);

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_tickets_read_required" },
      },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/help-desk/tickets" });
  const migration = migrateTicketSearchParams(searchParams ? await searchParams : {});
  const state = loadTicketState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(ticketHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const orgId = context.app.activeOrgId;
  const supabase = await createClient();
  const [ticketsResult, typesResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketsService.listForDataView(supabase, orgId, ticketListParams(state)),
    HelpdeskTicketTypesService.list(supabase, orgId, false),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  const data = ticketsResult.success
    ? ticketsResult.data
    : { rows: [], totalCount: 0, page: state.strona, pageSize: state.wierszy };
  const lastPage = Math.max(1, Math.ceil(data.totalCount / state.wierszy));
  if (ticketsResult.success && state.strona > lastPage) {
    return redirectUrl(ticketHref(path, state, { strona: lastPage }));
  }

  // The first page goes straight into the list's cache (no request on the
  // client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (ticketsResult.success) {
    queryClient.setQueryData(ticketKeys.list(orgId, state), ticketsResult.data);
  }

  const canCreate = checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_CREATE);
  const canManage = checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE);
  const settings = settingsResult.success ? settingsResult.data : null;
  const statusConfigs = settings?.status_configs ?? null;
  const priorityConfigs = settings?.priority_configs ?? null;
  const pl = locale === "pl";

  const labels: Record<string, string> = {
    locale,
    title: t("pages.tickets.title"),
    ticket: pl ? "Zgłoszenie" : "Ticket",
    number: pl ? "Numer" : "Number",
    type: t("tickets.columns.type"),
    status: t("tickets.columns.status"),
    priority: t("tickets.columns.priority"),
    branch: t("tickets.columns.branch"),
    acceptance: t("tickets.columns.acceptance"),
    createdBy: t("tickets.columns.createdBy"),
    responders: t("tickets.columns.responders"),
    createdAt: t("tickets.columns.createdAt"),
    updatedAt: t("tickets.columns.updatedAt"),
    accepted: t("tickets.acceptance.accepted"),
    acceptancePending: t("tickets.acceptance.pending"),
    assignment: pl ? "Przypisanie" : "Assignment",
    unassigned: pl ? "Nieprzypisane" : "Unassigned",
    queues: t("tickets.queues.label"),
    queue_unassigned: t("tickets.queues.unassigned"),
    queue_mine: t("tickets.queues.mine"),
    queue_waitingRequester: t("tickets.queues.waitingRequester"),
    queue_waitingVendor: t("tickets.queues.waitingVendor"),
    queue_all: t("tickets.queues.all"),
    viewFull: t("tickets.viewFull"),
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij szczegóły" : "Close details",
    search: pl ? "Szukaj tytułu lub numeru…" : "Search title or number…",
    empty: pl
      ? "Brak zgłoszeń pasujących do wyszukiwania i filtrów."
      : "No tickets match the search and filters.",
    loadError: pl ? "Nie udało się wczytać danych." : "Could not load data.",
    notFound: pl
      ? "Zgłoszenie nie istnieje lub nie jest dostępne."
      : "Ticket not found or unavailable.",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "zgłoszeń" : "tickets",
    within_7d: pl ? "Ostatnie 7 dni" : "Last 7 days",
    within_30d: pl ? "Ostatnie 30 dni" : "Last 30 days",
    within_90d: pl ? "Ostatnie 90 dni" : "Last 90 days",
  };
  for (const status of TICKET_STATUSES) {
    labels[`status_${status}`] =
      statusConfigs?.[status]?.label ?? t(`tickets.status.${status}` as Parameters<typeof t>[0]);
  }
  for (const priority of TICKET_PRIORITIES) {
    labels[`priority_${priority}`] =
      priorityConfigs?.[priority]?.label ??
      t(`tickets.priority.${priority}` as Parameters<typeof t>[0]);
  }

  const branches = context.app.availableBranches.map((b) => ({ value: b.id, label: b.name }));
  const branchNames = Object.fromEntries(branches.map((b) => [b.value, b.label]));
  const types = typesResult.success
    ? typesResult.data.map((type) => ({ value: type.id, label: type.name }))
    : [];
  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        value: m.user_id,
        label:
          [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") ||
          m.user_email ||
          m.user_id,
      }))
    : [];

  const set = ticketColumnSet(labels);
  const cookie = `ambra_helpdesk_tickets_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const ticketPathTemplate = getPathname({
    locale,
    href: {
      pathname: "/dashboard/help-desk/tickets/[ticketId]",
      params: { ticketId: "__TICKET__" },
    },
  });
  const userId = context.user.user?.id ?? "";
  const branchId = context.app.activeBranchId ?? null;

  const header = (count: ReactNode) => (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
        {count}
      </div>
      {canCreate ? (
        <Button asChild size="sm">
          <Link href="/dashboard/help-desk/tickets/new">
            <Plus className="mr-1.5 size-3.5" />
            {t("tickets.createTicket")}
          </Link>
        </Button>
      ) : null}
    </header>
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        {header(<TicketsTotal orgId={orgId} initial={data.totalCount} />)}
        {canManage ? <TicketQueues userId={userId} branchId={branchId} labels={labels} /> : null}
        <TicketFilters
          orgId={orgId}
          order={["ticket", ...layout.map((column) => column.id)]}
          types={types}
          members={members}
          branches={branches}
          labels={labels}
        />
        <HelpDeskTicketsWorkspace
          orgId={orgId}
          path={path}
          set={set}
          layout={layout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          configs={{ status: statusConfigs, priority: priorityConfigs }}
          branchNames={branchNames}
          canManage={canManage}
          currentUserId={userId}
          ticketPathTemplate={ticketPathTemplate}
        />
      </section>
    </HydrationBoundary>
  );
}
