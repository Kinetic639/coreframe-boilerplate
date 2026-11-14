"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter } from "next-intl";
import { useQueryStates } from "nuqs";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { KanbanSquare, List, MessageSquare, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import type { ColumnLayout, ColumnSet, ColumnWidths } from "@/components/data-table/columns";
import { TableNavigationProvider } from "@/components/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/data-table/list-pane";
import { useListKeys } from "@/components/data-table/use-list-keys";
import { getFeedbackAction, listFeedbackAction } from "@/app/actions/platform-feedback";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  type FeedbackDetail,
  type FeedbackListRow,
} from "@/lib/platform-feedback/types";
import { FeedbackKindBadge, FeedbackPriorityBadge, FeedbackStatusBadge } from "./feedback-badges";
import { FeedbackBoard } from "./feedback-board";
import { FeedbackDetailPanel, feedbackDetailKey } from "./feedback-detail-panel";
import { ReportFeedbackDialog } from "./report-feedback-dialog";
import {
  feedbackHref,
  feedbackListInput,
  feedbackListKey,
  feedbackParsers,
  FEEDBACK_PAGE_SIZES,
  type FeedbackScope,
  type FeedbackState,
} from "./feedback-state";

const EMPTY = { rows: [] as FeedbackListRow[], totalCount: 0 };

/**
 * Reports as a data table list, paged by the database, with the open one
 * beside it. "mine": the user's own reports (account page); "all": every
 * organization's reports for the platform admin, who can also switch to a
 * kanban board by status. The address holds the whole state.
 */
export function FeedbackListView({
  scope,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
}: {
  scope: FeedbackScope;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
}) {
  const format = useFormatter();
  const isAdmin = scope === "all";
  const queryClient = useQueryClient();
  const [state] = useQueryStates(feedbackParsers);
  const [layout, setLayout] = useState(savedLayout);
  const [reportOpen, setReportOpen] = useState(false);

  const list = useQuery({
    queryKey: feedbackListKey(scope, state),
    queryFn: async () => {
      const result = await listFeedbackAction(feedbackListInput(scope, state));
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
  const data = list.data ?? EMPTY;
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ["platform-feedback"] }),
    [queryClient]
  );

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<FeedbackState>) => feedbackHref(path, state, patch),
    [path, state]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [navigate, href]
  );
  const keys = useMemo(() => data.rows.map((row) => row.id), [data.rows]);
  useListKeys(keys, state.selected, preview);

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) window.history.replaceState(null, "", href({ strona: last }));
  }, [href, list.data, list.isPlaceholderData, state.strona, state.wierszy]);

  const detail = useQuery({
    queryKey: feedbackDetailKey(state.selected ?? ""),
    enabled: Boolean(state.selected),
    queryFn: async (): Promise<FeedbackDetail | null> => {
      const result = await getFeedbackAction(state.selected!);
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    staleTime: 15 * 1000,
  });

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: labels.filter_status,
      options: FEEDBACK_STATUSES.map((value) => ({ value, label: labels[`status_${value}`] })),
    },
    {
      kind: "list",
      id: "rodzaj",
      label: labels.filter_kind,
      single: true,
      options: FEEDBACK_KINDS.map((value) => ({ value, label: labels[`kind_${value}`] })),
    },
    ...(isAdmin
      ? [
          {
            kind: "list" as const,
            id: "priorytet",
            label: labels.filter_priority,
            single: true,
            options: FEEDBACK_PRIORITIES.map((value) => ({
              value,
              label: labels[`priority_${value}`],
            })),
          },
        ]
      : []),
  ];
  const filtered =
    Boolean(state.q) || state.status.length + state.rodzaj.length + state.priorytet.length > 0;
  const rowHref = (row: FeedbackListRow) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const reporter = (row: FeedbackListRow) => row.reporter_name || row.reporter_email || "—";
  const value = (row: FeedbackListRow, id: string) => {
    if (id === "code") return <span className="font-mono text-xs">{row.code}</span>;
    if (id === "status")
      return (
        <span className="flex items-center gap-1.5">
          <FeedbackStatusBadge status={row.status} />
          <FeedbackPriorityBadge priority={row.priority} />
        </span>
      );
    if (id === "reporter")
      return (
        <span className="block min-w-0 text-sm">
          <span className="block truncate">{reporter(row)}</span>
          {row.organization_name ? (
            <span className="block truncate text-xs text-muted-foreground">
              {row.organization_name}
            </span>
          ) : null}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {row.message_count > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="size-3" />
            {row.message_count}
          </span>
        ) : null}
        {row.attachment_count > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <Paperclip className="size-3" />
            {row.attachment_count}
          </span>
        ) : null}
        {format.relativeTime(new Date(row.last_activity_at))}
      </span>
    );
  };
  const open = data.rows.find((row) => row.id === state.selected);
  const board = isAdmin && state.widok === "tablica";

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="dt-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
              {board ? null : (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {data.totalCount}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="inline-flex rounded-md bg-muted p-0.5" role="group">
                <Button
                  size="sm"
                  variant={board ? "ghost" : "default"}
                  className="h-7"
                  aria-pressed={!board}
                  onClick={() => navigate(href({ widok: "lista" }))}
                  data-testid="feedback-view-list"
                >
                  <List className="mr-1.5 size-3.5" />
                  {labels.viewList}
                </Button>
                <Button
                  size="sm"
                  variant={board ? "default" : "ghost"}
                  className="h-7"
                  aria-pressed={board}
                  onClick={() => navigate(href({ widok: "tablica", selected: null }))}
                  data-testid="feedback-view-board"
                >
                  <KanbanSquare className="mr-1.5 size-3.5" />
                  {labels.viewBoard}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setReportOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                {labels.report}
              </Button>
            )}
          </div>
        </header>
        {board ? (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <FeedbackBoard />
          </div>
        ) : (
          <>
            <div className="dt-list-filter-row">
              <FilterBar
                parsers={feedbackParsers}
                fields={fields}
                resetOnChange={["strona", "selected"]}
                shallow
                pending={list.isFetching}
                search={{ label: labels.search, placeholder: labels.search }}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1">
              <ListPane
                rows={data.rows}
                totalCount={data.totalCount}
                page={state.strona}
                size={state.wierszy}
                sizes={FEEDBACK_PAGE_SIZES}
                selected={state.selected}
                rowKey={(row) => row.id}
                rowHref={rowHref}
                pageHref={(strona) => href({ strona, selected: null })}
                sizeHref={(wierszy) =>
                  href({
                    wierszy: wierszy as FeedbackState["wierszy"],
                    strona: 1,
                    selected: null,
                  })
                }
                set={set}
                layout={layout}
                widths={widths}
                cookie={cookie}
                onLayoutChange={setLayout}
                sortOf={() => undefined}
                identity={(row) => (
                  <>
                    <FeedbackKindBadge kind={row.kind} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium" title={row.title}>
                        {row.title}
                      </span>
                      {isAdmin ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {reporter(row)}
                          {row.organization_name ? ` · ${row.organization_name}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </>
                )}
                value={value}
                badge={(row) => <FeedbackStatusBadge status={row.status} />}
                labels={labels}
                empty={filtered ? labels.empty : labels.emptyAll}
                loading={list.isPending}
                refreshing={list.isFetching && !list.isPending}
                error={list.error ? list.error.message : null}
                onRetry={() => void list.refetch()}
                onPreview={preview}
              />
              {state.selected ? (
                <ListSidePanel
                  titleId="feedback-panel-title"
                  title={
                    open
                      ? `${open.code} · ${open.title}`
                      : detail.data
                        ? `${detail.data.code} · ${detail.data.title}`
                        : detail.isPending
                          ? labels.loading
                          : labels.notFound
                  }
                  backLabel={labels.title}
                  closeLabel={labels.close}
                  onClose={() => preview(null)}
                >
                  {detail.data ? (
                    <div className="p-5">
                      <FeedbackDetailPanel
                        key={detail.data.id}
                        initial={detail.data}
                        isAdmin={isAdmin}
                        onChanged={refresh}
                      />
                    </div>
                  ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      {detail.isPending ? labels.loading : labels.notFound}
                    </p>
                  )}
                </ListSidePanel>
              ) : null}
            </div>
          </>
        )}
      </section>

      {!isAdmin ? (
        <ReportFeedbackDialog
          open={reportOpen}
          onOpenChange={(next) => {
            setReportOpen(next);
            if (!next) refresh();
          }}
        />
      ) : null}
    </TableNavigationProvider>
  );
}
