"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, Plus, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listKey, parseListParams, toQuery } from "@/server/requests/list-params";
import { PAGE_SIZES, REQUEST_FILTERS, type TicketTypeRef } from "@/server/requests/types";
import {
  detailQuery,
  listQuery,
  requestKeys,
  useRequestsScope,
  type ListData,
} from "@/lib/requests-query";
import { NewRequestDialog, usePrefetchNewRequest } from "./new-request-dialog";
import { RequestCard } from "./request-card";
import { RequestsTable } from "./requests-table";
import { DesktopToolbar, MobileToolbar } from "./requests-toolbar";

/** URL query of the list; shallow, so changing a filter never re-renders the server tree. */
const listParsers = {
  scope: parseAsStringLiteral(["mine", "branch"] as const).withDefault("mine"),
  f: parseAsStringLiteral(REQUEST_FILTERS).withDefault("open"),
  type: parseAsString,
  q: parseAsString,
  sort: parseAsStringLiteral(["activity", "newest"] as const).withDefault("activity"),
  p: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(PAGE_SIZES[0]),
};

/**
 * The requests screen. Desktop: the list as a table in a card; an opened request shows in
 * a panel beside it (the table keeps its key columns) or, with ?view=page, on a full page.
 * Phone: cards, and an opened request replaces the list. Lives in the (requests) layout, so
 * opening another request only renders the detail segment; filters live in the URL (nuqs,
 * shallow) and each list page is a cache entry fetched over GET.
 */
export function RequestsShell({
  initial,
  initialKey,
  renderedAt,
  types,
  canCreate,
  children,
}: {
  initial: ListData;
  initialKey: string;
  /** When the server loaded `initial`, so the cache knows how fresh it is. */
  renderedAt: number;
  types: TicketTypeRef[];
  canCreate: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("requests");
  const { ticketId } = useParams<{ ticketId?: string }>();
  const fullPage = useSearchParams().get("view") === "page";
  const [qs, setQs] = useQueryStates(listParsers, { shallow: true, history: "replace" });

  const input = useMemo(
    () =>
      parseListParams({
        scope: qs.scope,
        f: qs.f,
        type: qs.type ?? undefined,
        q: qs.q ?? undefined,
        sort: qs.sort,
        p: String(qs.p),
        size: String(qs.size),
      }),
    [qs]
  );
  const query = useMemo(() => toQuery(input), [input]);
  const key = listKey(query);

  const scope = useRequestsScope();
  const qc = useQueryClient();
  const {
    data = initial,
    isFetching,
    isPlaceholderData,
  } = useQuery({
    ...listQuery(scope, key, query),
    initialData: key === initialKey ? initial : undefined,
    initialDataUpdatedAt: renderedAt,
    placeholderData: keepPreviousData,
  });
  const pending = isPlaceholderData && isFetching;

  // A server re-render (branch switch, a new request) brings fresh data for its query.
  useEffect(() => {
    qc.setQueryData(requestKeys.list(scope, initialKey), initial, { updatedAt: renderedAt });
  }, [qc, scope, initialKey, initial, renderedAt]);

  /** Opening a request starts loading it on hover, so the click shows it at once. */
  const prefetch = (id: string) => void qc.prefetchQuery(detailQuery(scope, id));

  const [searchText, setSearchText] = useState(qs.q ?? "");
  useEffect(() => {
    const id = setTimeout(() => {
      const value = searchText.trim().slice(0, 80) || null;
      if (value !== (qs.q ?? null)) void setQs({ q: value, p: 1 });
    }, 300);
    return () => clearTimeout(id);
  }, [searchText, qs.q, setQs]);

  const [creating, setCreating] = useState(false);
  const prefetchForm = usePrefetchNewRequest(scope);
  // Sending the form opens the new request: the dialog has done its job.
  useEffect(() => setCreating(false), [ticketId]);

  const panelOpen = !!ticketId && !fullPage;
  const pages = Math.max(1, Math.ceil(data.total / input.size));
  const from = data.total === 0 ? 0 : (input.page - 1) * input.size + 1;
  const to = Math.min(data.total, input.page * input.size);
  const filtered = !!(qs.q || qs.type || qs.f !== "open");

  const toolbar = {
    scope: input.scope,
    filter: input.filter,
    typeId: input.typeId ?? null,
    search: searchText,
    yourTurn: data.yourTurn ?? 0,
    types,
    pending,
    compact: panelOpen,
    onScope: (scope: "mine" | "branch") => void setQs({ scope, p: 1 }),
    onFilter: (f: (typeof REQUEST_FILTERS)[number]) => void setQs({ f, p: 1 }),
    onType: (type: string | null) => void setQs({ type, p: 1 }),
    onSearch: setSearchText,
  };

  const empty = (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {filtered ? <SearchX className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-medium">
        {filtered ? t("empty.filteredTitle") : t("empty.title")}
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {filtered ? t("empty.search") : t("empty.body")}
      </p>
      {filtered ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setSearchText("");
            void setQs({ q: null, type: null, f: "open", p: 1 });
          }}
        >
          {t("empty.clear")}
        </Button>
      ) : (
        canCreate && (
          <Button
            size="sm"
            className="mt-2 hidden lg:inline-flex"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            {t("newLabel")}
          </Button>
        )
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-1 flex-col lg:min-h-0",
        panelOpen && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(460px,42%)]"
      )}
    >
      <section
        aria-label={t("listLabel")}
        className={cn(
          "flex min-w-0 flex-1 flex-col lg:min-h-0 lg:p-6",
          panelOpen && "lg:pr-0",
          ticketId && "max-lg:hidden",
          ticketId && fullPage && "lg:hidden"
        )}
      >
        <div className="flex flex-1 flex-col bg-card lg:min-h-0 lg:rounded-lg lg:border lg:shadow-sm">
          <div className="hidden items-center gap-3 border-b px-6 py-4 lg:flex">
            <h1 className="text-xl font-semibold tracking-tight">{t("heading")}</h1>
            <span className="text-sm text-muted-foreground">{data.total}</span>
            <span className="flex-1" />
            {canCreate && (
              <Button
                onClick={() => setCreating(true)}
                onPointerEnter={prefetchForm}
                onFocus={prefetchForm}
              >
                <Plus className="h-4 w-4" />
                {t("newLabel")}
              </Button>
            )}
          </div>
          <div className="hidden lg:block">
            <DesktopToolbar {...toolbar} />
          </div>
          <div className="sticky top-14 z-10 lg:hidden">
            <MobileToolbar {...toolbar} />
          </div>

          <div
            className={cn(
              "flex-1 transition-opacity lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain",
              pending && "opacity-60"
            )}
          >
            {data.items.length === 0 ? (
              empty
            ) : (
              <>
                <div className="hidden lg:block">
                  <RequestsTable
                    items={data.items}
                    selectedId={ticketId}
                    compact={panelOpen}
                    query={query}
                    onPrefetch={prefetch}
                  />
                </div>
                <ul className="flex flex-col gap-3 bg-muted/40 px-4 py-4 lg:hidden">
                  {data.items.map((item) => (
                    <li key={item.id}>
                      <RequestCard item={item} query={query} onPrefetch={prefetch} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {data.total > 0 && (
            <nav
              aria-label={t("pagination")}
              className="flex items-center justify-end gap-4 border-t px-4 pb-24 pt-3 text-sm text-muted-foreground lg:px-6 lg:pb-3"
            >
              <span className="mr-auto flex items-center gap-1 lg:mr-0">
                <span className="mr-1">{t("rows")}</span>
                {[...PAGE_SIZES]
                  .sort((a, b) => a - b)
                  .map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={input.size === size}
                      onClick={() => void setQs({ size, p: 1 })}
                      className={cn(
                        "h-7 rounded-md px-2 tabular-nums hover:bg-muted hover:text-foreground",
                        input.size === size &&
                          "bg-primary/10 font-medium text-primary hover:bg-primary/10"
                      )}
                    >
                      {size}
                    </button>
                  ))}
              </span>
              <span className="tabular-nums">{t("range", { from, to, total: data.total })}</span>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("prev")}
                  disabled={input.page <= 1}
                  onClick={() => void setQs({ p: input.page - 1 })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("next")}
                  disabled={input.page >= pages}
                  onClick={() => void setQs({ p: input.page + 1 })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </span>
            </nav>
          )}
        </div>
      </section>

      {ticketId && (
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col bg-background lg:min-h-0",
            panelOpen ? "lg:border-l lg:bg-card" : "lg:p-6"
          )}
        >
          {children}
        </div>
      )}

      {!ticketId && canCreate && (
        <Link
          href="/new"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-primary pl-5 pr-6 text-base font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <Plus className="h-5 w-5" />
          {t("newLabel")}
        </Link>
      )}

      {canCreate && <NewRequestDialog scope={scope} open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
