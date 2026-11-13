"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import type { CrmPartyDetail, CrmPartyListRow } from "@/server/services/crm-parties.service";
import { CreatePartyDialog, CrmPartyDetailPanel } from "./party-detail-panel";
import { PartiesTable, PartyRoles, PartyStatus } from "./parties-table";
import { partyDetailQuery, partyKeys, partyListQuery, type PartyList } from "./parties-query";
import { partyHref, partyParsers, PARTY_ROLES, PARTY_STATUSES } from "./parties-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: PartyList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

/**
 * The counterparties section: the title bar, the filters, and the list with
 * its side panel. The address is the one state: every change only pushes a
 * new address, and the list answers from its cache (the server put the first
 * page there) or fetches just its rows. A change to a counterparty drops the
 * section's cache.
 */
export function PartiesWorkspace({
  orgId,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canCreate,
  canUpdate,
  canDelete,
}: {
  orgId: string;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(partyParsers);
  const list = useQuery({ ...partyListQuery(orgId, state), placeholderData: keepPreviousData });
  const data = list.data ?? EMPTY_LIST;
  const [layout, setLayout] = useState(savedLayout);
  const [createOpen, setCreateOpen] = useState(false);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const preview = useCallback(
    (selected: string | null) => navigate(partyHref(path, state, { selected })),
    [navigate, path, state]
  );
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: partyKeys.all(orgId) }),
    [queryClient, orgId]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", partyHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(partyListQuery(orgId, { ...state, strona: state.strona + 1 }));
  }, [list.data, list.isPlaceholderData, queryClient, orgId, state]);

  // A counterparty's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (id: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!id) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(partyDetailQuery(orgId, id));
      }, HOVER_INTENT_MS);
    },
    [queryClient, orgId]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // ↓ / ↑ open the next / previous counterparty, Esc closes the panel.
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
      const at = data.rows.findIndex((row) => row.id === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].id);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].id)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "rola",
      label: labels.column_roles,
      options: PARTY_ROLES.map((value) => ({ value, label: labels[`role_${value}`] })),
    },
    {
      kind: "list",
      id: "status",
      label: labels.column_status,
      options: PARTY_STATUSES.map((value) => ({ value, label: labels[`status_${value}`] })),
    },
  ];
  // The filter ids that are not columns sit where their column is.
  const order = ["party", ...layout.map((column) => column.id)].map((id) =>
    id === "roles" ? "rola" : id
  );

  const selectedRow = useMemo<CrmPartyListRow | null>(
    () => data.rows.find((row) => row.id === state.selected) ?? null,
    [data.rows, state.selected]
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{data.totalCount}</span>
          </div>
          {canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {labels.newParty}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={partyParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            pending={list.isFetching}
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <PartiesTable
            data={data}
            state={state}
            path={path}
            set={set}
            layout={layout}
            onLayoutChange={setLayout}
            widths={widths}
            cookie={cookie}
            labels={labels}
            loading={list.isPending}
            refreshing={list.isFetching && !list.isPending}
            error={list.isError ? list.error.message : null}
            onRetry={() => void list.refetch()}
            onPreview={preview}
            onPrefetch={prefetchPreview}
          />
          {state.selected ? (
            <aside
              aria-labelledby="crm-party-panel-title"
              className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
            >
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <button
                  type="button"
                  onClick={() => preview(null)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={labels.close}
                >
                  <X className="size-4" />
                  <span className="hidden sm:inline">{labels.title}</span>
                </button>
                <span className="text-muted-foreground/50">/</span>
                <span id="crm-party-panel-title" className="truncate text-sm">
                  {selectedRow?.display_name ?? labels.loading}
                </span>
              </header>
              <PartyCard
                key={state.selected}
                orgId={orgId}
                id={state.selected}
                row={selectedRow}
                labels={labels}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onChanged={refresh}
              />
            </aside>
          ) : null}
        </div>
      </section>

      <CreatePartyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(party: CrmPartyDetail) => {
          queryClient.setQueryData(partyKeys.detail(orgId, party.id), party);
          refresh();
          preview(party.id);
        }}
      />
    </TableNavigationProvider>
  );
}

/** A counterparty's card in the side panel: fetched by its id. */
function PartyCard({
  orgId,
  id,
  row,
  labels,
  canUpdate,
  canDelete,
  onChanged,
}: {
  orgId: string;
  id: string;
  /** The list's row of this counterparty, shown while its card comes. */
  row: CrmPartyListRow | null;
  labels: Record<string, string>;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const query = useQuery(partyDetailQuery(orgId, id));
  if (query.isPending) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label={labels.loading}>
        {row ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{row.display_name}</h2>
              <PartyStatus status={row.status} labels={labels} />
            </div>
            <PartyRoles row={row} labels={labels} />
          </div>
        ) : (
          <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
        )}
        {[0, 1, 2, 3, 4].map((key) => (
          <div key={key} className="h-4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center text-sm">
        <div>
          <p className="text-destructive">{labels.notFound}</p>
          <button className="mt-3 underline" type="button" onClick={() => query.refetch()}>
            {labels.retry}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <CrmPartyDetailPanel
        detail={query.data}
        orgId={orgId}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onChanged={onChanged}
      />
    </div>
  );
}
