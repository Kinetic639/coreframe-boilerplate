"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { ExternalLink, X } from "lucide-react";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { useHelpdeskRealtime } from "@/hooks/queries/help-desk/use-helpdesk-realtime";
import type { HelpdeskTicketListRow } from "@/server/services/helpdesk-tickets.service";
import { TicketDetailPanel } from "./ticket-detail-panel";
import { HelpDeskTicketsTable, TicketStatus, type TicketBadgeConfigs } from "./tickets-table";
import { ticketDetailQuery, ticketListQuery, type TicketList } from "./tickets-query";
import { ticketHref, ticketParsers } from "./tickets-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: TicketList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

/**
 * The tickets list and its side panel, as the movements list: the address
 * is the one state, every change only pushes a new address, and the list
 * answers from its cache (the server put the first page there) or fetches
 * just its rows. Realtime and the ticket's own actions invalidate the cache.
 */
export function HelpDeskTicketsWorkspace({
  orgId,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  configs,
  branchNames,
  canManage,
  currentUserId,
  ticketPathTemplate,
}: {
  orgId: string;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  configs: TicketBadgeConfigs;
  branchNames: Record<string, string>;
  canManage: boolean;
  currentUserId: string;
  ticketPathTemplate: string;
}) {
  const queryClient = useQueryClient();
  useHelpdeskRealtime(orgId);
  const [state] = useQueryStates(ticketParsers);
  const list = useQuery({ ...ticketListQuery(orgId, state), placeholderData: keepPreviousData });
  const data = list.data ?? EMPTY_LIST;

  // The columns follow the menu at once; the cookie keeps them for the server.
  const [layout, setLayout] = useState(savedLayout);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);

  const ticketPath = useCallback(
    (ticketNumber: string) =>
      ticketPathTemplate.replace("__TICKET__", encodeURIComponent(ticketNumber)),
    [ticketPathTemplate]
  );

  const preview = useCallback(
    (selected: string | null) => navigate(ticketHref(path, state, { selected })),
    [navigate, path, state]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", ticketHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(ticketListQuery(orgId, { ...state, strona: state.strona + 1 }));
  }, [list.data, list.isPlaceholderData, queryClient, orgId, state]);

  // A ticket's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (ticketNumber: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!ticketNumber) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(ticketDetailQuery(orgId, ticketNumber));
      }, HOVER_INTENT_MS);
    },
    [queryClient, orgId]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  const selectedRow = useMemo<HelpdeskTicketListRow | null>(
    () => data.rows.find((row) => row.ticket_number === state.selected) ?? null,
    [data.rows, state.selected]
  );

  // ↓ / ↑ open the next / previous ticket, Esc closes the panel. Keys typed
  // into a field, or with a modifier, stay the field's.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!data.rows.length) return;
      const at = data.rows.findIndex((row) => row.ticket_number === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].ticket_number);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].ticket_number)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  return (
    <TableNavigationProvider navigate={navigate}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <HelpDeskTicketsTable
          data={data}
          state={state}
          path={path}
          set={set}
          layout={layout}
          onLayoutChange={setLayout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          configs={configs}
          branchNames={branchNames}
          ticketPath={ticketPath}
          loading={list.isPending}
          refreshing={list.isFetching && !list.isPending}
          error={list.isError ? list.error.message : null}
          onRetry={() => void list.refetch()}
          onPreview={preview}
          onPrefetch={prefetchPreview}
        />
        {state.selected ? (
          <TicketRecordPanel
            key={state.selected}
            ticketNumber={state.selected}
            row={selectedRow}
            orgId={orgId}
            labels={labels}
            configs={configs}
            canManage={canManage}
            currentUserId={currentUserId}
            fullPath={ticketPath(state.selected)}
            onClose={() => preview(null)}
          />
        ) : null}
      </div>
    </TableNavigationProvider>
  );
}

function TicketRecordPanel({
  ticketNumber,
  row,
  orgId,
  labels,
  configs,
  canManage,
  currentUserId,
  fullPath,
  onClose,
}: {
  ticketNumber: string;
  /** The list's row of this ticket, shown while its card comes. */
  row: HelpdeskTicketListRow | null;
  orgId: string;
  labels: Record<string, string>;
  configs: TicketBadgeConfigs;
  canManage: boolean;
  currentUserId: string;
  fullPath: string;
  onClose: () => void;
}) {
  const query = useQuery(ticketDetailQuery(orgId, ticketNumber));
  return (
    <aside
      aria-labelledby="helpdesk-ticket-panel-title"
      className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={labels.close}
        >
          <X className="size-4" />
          <span className="hidden sm:inline">{labels.title}</span>
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span id="helpdesk-ticket-panel-title" className="truncate font-mono text-sm">
          {ticketNumber}
        </span>
        <Link
          href={fullPath}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
          {labels.viewFull}
        </Link>
      </header>
      {query.isPending ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label={labels.loading}>
          {row ? (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{row.title}</h2>
              <TicketStatus row={row} configs={configs} label={labels[`status_${row.status}`]} />
            </div>
          ) : (
            <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
          )}
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center p-8 text-center text-sm">
          <div>
            <p className="text-destructive">
              {query.error.message === "Ticket not found" ? labels.notFound : query.error.message}
            </p>
            <button className="mt-3 underline" type="button" onClick={() => query.refetch()}>
              {labels.retry}
            </button>
          </div>
        </div>
      ) : null}
      {query.data ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <TicketDetailPanel
            key={query.data.id}
            detail={query.data}
            canManage={canManage}
            currentUserId={currentUserId}
            statusConfigs={configs.status}
            priorityConfigs={configs.priority}
          />
        </div>
      ) : null}
    </aside>
  );
}
