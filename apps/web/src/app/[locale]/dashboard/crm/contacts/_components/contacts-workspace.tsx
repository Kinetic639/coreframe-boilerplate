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
import type { ContactDirectoryPage, ContactDirectoryRow } from "@/lib/contacts/types";
import type { CrmContactDetail } from "@/server/services/crm-contacts.service";
import {
  CreateContactDialog,
  CrmContactDetailPanel,
  isMemberDetail,
  MemberContactPanel,
  type ContactOrgMemberOption,
} from "./contact-detail-panel";
import { ContactKind, ContactsTable } from "./contacts-table";
import { contactDetailQuery, contactKeys, contactListQuery } from "./contacts-query";
import { contactHref, contactParsers, CONTACT_KINDS } from "./contacts-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: ContactDirectoryPage = {
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: 50,
  memberCount: 0,
  externalCount: 0,
};

/**
 * The contacts section: employees (from their profiles, read-only) and
 * external contacts in one list, with the open contact in a side panel. The
 * address is the one state; the list answers from its cache (the server put
 * the first page there) or fetches just its rows. A change to a contact drops
 * the section's cache.
 */
export function ContactsWorkspace({
  orgId,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  memberOptions,
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
  memberOptions: ContactOrgMemberOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(contactParsers);
  const list = useQuery({ ...contactListQuery(orgId, state), placeholderData: keepPreviousData });
  const data = list.data ?? EMPTY_LIST;
  const [layout, setLayout] = useState(savedLayout);
  const [createOpen, setCreateOpen] = useState(false);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const preview = useCallback(
    (selected: string | null) => navigate(contactHref(path, state, { selected })),
    [navigate, path, state]
  );
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: contactKeys.all(orgId) }),
    [queryClient, orgId]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", contactHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(contactListQuery(orgId, { ...state, strona: state.strona + 1 }));
  }, [list.data, list.isPlaceholderData, queryClient, orgId, state]);

  // A contact's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (key: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!key) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(contactDetailQuery(orgId, key));
      }, HOVER_INTENT_MS);
    },
    [queryClient, orgId]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // ↓ / ↑ open the next / previous contact, Esc closes the panel.
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
      const at = data.rows.findIndex((row) => row.key === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].key);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].key)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "rodzaj",
      label: labels.column_kind,
      options: CONTACT_KINDS.map((value) => ({ value, label: labels[`filter_${value}`] })),
    },
  ];
  const order = ["contact", ...layout.map((column) => column.id)].map((id) =>
    id === "kind" ? "rodzaj" : id
  );

  const selectedRow = useMemo<ContactDirectoryRow | null>(
    () => data.rows.find((row) => row.key === state.selected) ?? null,
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
              {labels.newContact}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={contactParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            pending={list.isFetching}
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <ContactsTable
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
              aria-labelledby="crm-contact-panel-title"
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
                <span id="crm-contact-panel-title" className="truncate text-sm">
                  {selectedRow?.display_name ?? labels.loading}
                </span>
              </header>
              <ContactCard
                key={state.selected}
                orgId={orgId}
                contactKey={state.selected}
                row={selectedRow}
                labels={labels}
                memberOptions={memberOptions}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onChanged={refresh}
              />
            </aside>
          ) : null}
        </div>
      </section>

      <CreateContactDialog
        open={createOpen}
        memberOptions={memberOptions}
        onOpenChange={setCreateOpen}
        onCreated={(contact: CrmContactDetail) => {
          queryClient.setQueryData(contactKeys.detail(orgId, contact.id), contact);
          refresh();
          preview(contact.id);
        }}
      />
    </TableNavigationProvider>
  );
}

/** A contact's card in the side panel: fetched by its key. */
function ContactCard({
  orgId,
  contactKey,
  row,
  labels,
  memberOptions,
  canUpdate,
  canDelete,
  onChanged,
}: {
  orgId: string;
  contactKey: string;
  /** The list's row of this contact, shown while its card comes. */
  row: ContactDirectoryRow | null;
  labels: Record<string, string>;
  memberOptions: ContactOrgMemberOption[];
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const query = useQuery(contactDetailQuery(orgId, contactKey));
  if (query.isPending) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label={labels.loading}>
        {row ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{row.display_name}</h2>
            <ContactKind row={row} labels={labels} />
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
      {isMemberDetail(query.data) ? (
        <MemberContactPanel member={query.data} />
      ) : (
        <CrmContactDetailPanel
          detail={query.data}
          memberOptions={memberOptions}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
