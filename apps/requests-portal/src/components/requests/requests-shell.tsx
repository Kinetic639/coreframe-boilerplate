"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import type { ColumnLayout, ColumnWidths } from "@/components/data-table/columns";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { TableNavigationProvider } from "@/components/data-table/table-navigation";
import { useListKeys } from "@/components/data-table/use-list-keys";
import { Button } from "@/components/ui/button";
import { getPathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listKey, parseListParams, toQuery } from "@/server/requests/list-params";
import { REQUEST_FILTERS, type TicketTypeRef } from "@/server/requests/types";
import type { ListRequestsInput } from "@/server/requests/requests.service";
import {
  detailQuery,
  listQuery,
  requestKeys,
  useRequestsScope,
  type ListData,
} from "@/lib/requests-query";
import { NewRequestDialog, usePrefetchNewRequest } from "./new-request-dialog";
import { requestColumnSet } from "./request-columns";
import { RequestsTable } from "./requests-table";

const parseAsUuid = createParser({
  parse: (value) => (/^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});

/**
 * The list's address (shallow: a change never re-renders the server tree). The keys are
 * the ERP tickets list's where they mean the same: `q`, `typ`, `strona`, `wierszy`.
 */
const listParsers = {
  scope: parseAsStringLiteral(["mine", "branch"] as const).withDefault("mine"),
  f: parseAsStringLiteral(REQUEST_FILTERS).withDefault("open"),
  typ: parseAsArrayOf(parseAsUuid).withDefault([]),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(["activity", "newest"] as const).withDefault("activity"),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral([20, 50, 100] as const).withDefault(50),
};

/** How long the pointer rests on a row before its request is fetched. */
const HOVER_INTENT_MS = 300;

/** Sortable columns and the list order each gives (newest first). */
const SORT_OF_COLUMN: Record<string, ListRequestsInput["sort"]> = {
  updated_at: "activity",
  created_at: "newest",
};

const LABEL_KEYS = [
  "title",
  "ticket",
  "type",
  "status",
  "branch",
  "order",
  "acceptance",
  "requester",
  "responders",
  "createdAt",
  "updatedAt",
  "acceptancePending",
  "queue",
  "viewFull",
  "preview",
  "close",
  "search",
  "empty",
  "emptyAll",
  "loadError",
  "retry",
  "loading",
  "countSuffix",
  "queues",
  "comments",
] as const;

/**
 * The requests screen, built as the ERP Help Desk tickets list: a bordered list view with
 * its title and "New request", the status tabs, the filter bar, the data table and the
 * request's panel beside it (a sheet on narrower screens). Lives in the (requests) layout,
 * so opening another request renders only the panel; the list is a cache entry per address.
 */
export function RequestsShell({
  initial,
  initialKey,
  renderedAt,
  types,
  branches,
  layout: savedLayout,
  widths,
  cookie,
  canCreate,
  children,
}: {
  initial: ListData;
  initialKey: string;
  /** When the server loaded `initial`, so the cache knows how fresh it is. */
  renderedAt: number;
  types: TicketTypeRef[];
  branches: { id: string; name: string }[];
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  canCreate: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("requests");
  const tl = useTranslations("requests.list");
  const locale = useLocale();
  const router = useRouter();
  const { ticketId } = useParams<{ ticketId?: string }>();
  const fullPage = useSearchParams().get("view") === "page";
  const [qs, setQs] = useQueryStates(listParsers, { shallow: true, history: "push" });

  const labels = useMemo(
    () => Object.fromEntries(LABEL_KEYS.map((key) => [key, tl(key)])) as Record<string, string>,
    [tl]
  );
  const set = useMemo(() => requestColumnSet(labels), [labels]);
  const [layout, setLayout] = useState(savedLayout);

  const input = useMemo(
    () =>
      parseListParams({
        scope: qs.scope,
        f: qs.f,
        typ: qs.typ[0],
        q: qs.q || undefined,
        sort: qs.sort,
        strona: String(qs.strona),
        wierszy: String(qs.wierszy),
      }),
    [qs]
  );
  const query = useMemo(() => toQuery(input), [input]);
  const key = listKey(query);

  const scope = useRequestsScope();
  const qc = useQueryClient();
  const list = useQuery({
    ...listQuery(scope, key, query),
    initialData: key === initialKey ? initial : undefined,
    initialDataUpdatedAt: renderedAt,
    placeholderData: keepPreviousData,
  });
  const data = list.data ?? initial;

  // A server re-render (branch switch, a new request) brings fresh data for its query.
  useEffect(() => {
    qc.setQueryData(requestKeys.list(scope, initialKey), initial, { updatedAt: renderedAt });
  }, [qc, scope, initialKey, initial, renderedAt]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (input.page * input.size >= list.data.total) return;
    const next = toQuery(input, { page: input.page + 1 });
    void qc.prefetchQuery(listQuery(scope, listKey(next), next));
  }, [list.data, list.isPlaceholderData, qc, scope, input]);

  // A request's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetch = useCallback(
    (id: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!id) return;
      hover.current = setTimeout(
        () => void qc.prefetchQuery(detailQuery(scope, id)),
        HOVER_INTENT_MS
      );
    },
    [qc, scope]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // Addresses: the list's own, a request beside it, a request on its full page.
  const withQuery = (path: string, q: Record<string, string>) => {
    const search = new URLSearchParams(q).toString();
    return search ? `${path}?${search}` : path;
  };
  const listPath = getPathname({ locale, href: "/" });
  const requestPath = (id: string) =>
    getPathname({ locale, href: { pathname: "/[ticketId]", params: { ticketId: id } } });
  const listHref = (patch: Partial<ListRequestsInput> = {}) =>
    withQuery(listPath, toQuery(input, patch));
  const requestHref = (id: string) => withQuery(requestPath(id), query);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => window.history.pushState(null, "", href), []);
  const open = useCallback(
    (id: string | null) => router.push(id ? requestHref(id) : listHref(), { scroll: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, query, locale]
  );
  const keys = useMemo(() => data.items.map((item) => item.id), [data.items]);
  useListKeys(keys, ticketId ?? null, open);

  const [creating, setCreating] = useState(false);
  const prefetchForm = usePrefetchNewRequest(scope);
  // Sending the form opens the new request: the dialog has done its job.
  useEffect(() => setCreating(false), [ticketId]);

  const branchNames = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );
  const filtered = !!(qs.q || qs.typ.length || qs.f !== "open");
  const fields: FilterField[] = types.length
    ? [
        {
          kind: "list",
          id: "typ",
          label: labels.type ?? "",
          single: true,
          options: types.map((type) => ({ value: type.id, label: type.name })),
        },
      ]
    : [];

  const header = (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
        <span className="text-xs tabular-nums text-muted-foreground">{data.total}</span>
      </div>
      {canCreate ? (
        <Button
          size="sm"
          className="h-8 px-3 text-sm"
          onClick={() => setCreating(true)}
          onPointerEnter={prefetchForm}
          onFocus={prefetchForm}
        >
          <Plus className="h-4 w-4" />
          {t("newLabel")}
        </Button>
      ) : null}
    </header>
  );

  // Status tabs as the ERP queues.
  const queues = (
    <div className="flex h-10 shrink-0 items-stretch border-b px-2">
      <div
        role="tablist"
        aria-label={labels.queues}
        className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {REQUEST_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={qs.f === f}
            onClick={() => void setQs({ f, strona: null })}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] transition-colors",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
              qs.f === f
                ? "font-medium text-foreground after:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`filter.${f}`)}
            {f === "yourTurn" && (data.yourTurn ?? 0) > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500/15 px-1 text-[10px] font-semibold tabular-nums text-orange-700 dark:text-orange-300">
                {data.yourTurn}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );

  // Whose requests: the user's own or the whole branch's (beside the filters).
  const scopeSwitch = (
    <div
      role="radiogroup"
      aria-label={t("scope.label")}
      className="inline-flex shrink-0 items-center rounded-md bg-muted p-0.5"
    >
      {(["mine", "branch"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={qs.scope === s}
          onClick={() => void setQs({ scope: s, strona: null })}
          className={cn(
            "inline-flex h-6 items-center whitespace-nowrap rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            qs.scope === s && "bg-background text-foreground shadow-sm"
          )}
        >
          {t(`scope.${s}`)}
        </button>
      ))}
    </div>
  );

  if (ticketId && fullPage) {
    return (
      <main className="flex h-dvh flex-col md:p-4 lg:h-auto lg:min-h-0 lg:flex-1">
        {children}
        {canCreate && <NewRequestDialog scope={scope} open={creating} onOpenChange={setCreating} />}
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col md:p-4 lg:h-auto lg:min-h-0 lg:flex-1">
      <section className="dt-list-view flex min-w-0 flex-col overflow-hidden bg-background md:rounded-lg md:border">
        {header}
        {queues}
        <div className="dt-list-filter-row">
          <FilterBar
            parsers={listParsers}
            fields={fields}
            resetOnChange={["strona"]}
            shallow
            pending={list.isFetching && list.isPlaceholderData}
            order={["ticket", ...layout.map((column) => column.id)].map((id) =>
              id === "ticket_type" ? "typ" : id
            )}
            search={{ label: labels.search ?? "", placeholder: labels.search ?? "" }}
          />
          <div className="dt-list-filter-extras">{scopeSwitch}</div>
        </div>
        <TableNavigationProvider navigate={navigate}>
          <div className="flex min-h-0 min-w-0 flex-1">
            <RequestsTable
              rows={data.items}
              totalCount={data.total}
              page={input.page}
              size={input.size}
              selected={ticketId ?? null}
              set={set}
              layout={layout}
              onLayoutChange={setLayout}
              widths={widths}
              cookie={cookie}
              labels={labels}
              branchNames={branchNames}
              empty={(filtered ? labels.empty : labels.emptyAll) ?? ""}
              loading={false}
              refreshing={list.isFetching && list.isPlaceholderData}
              error={list.isError && !list.data ? list.error.message : null}
              onRetry={() => void list.refetch()}
              rowHref={(row) => (row.id === ticketId ? listHref() : requestHref(row.id))}
              fullHref={(row) => withQuery(requestPath(row.id), { ...query, view: "page" })}
              pageHref={(page) => listHref({ page })}
              sizeHref={(size) => listHref({ size: size as ListRequestsInput["size"], page: 1 })}
              sortOf={(id) => {
                const sort = SORT_OF_COLUMN[id];
                if (!sort) return undefined;
                return {
                  href: listHref({ sort, page: 1 }),
                  direction: input.sort === sort ? "desc" : null,
                };
              }}
              onPrefetch={prefetch}
            />
            {ticketId ? (
              <aside
                aria-label={labels.ticket}
                className="dt-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:max-w-none xl:flex-1 xl:shadow-none"
              >
                {children}
              </aside>
            ) : null}
          </div>
        </TableNavigationProvider>
      </section>
      {canCreate && <NewRequestDialog scope={scope} open={creating} onOpenChange={setCreating} />}
    </main>
  );
}
