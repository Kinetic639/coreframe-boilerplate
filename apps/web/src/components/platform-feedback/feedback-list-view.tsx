"use client";

import { useCallback, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { KanbanSquare, List, MessageSquare, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/data-view/data-view";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
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
import { FeedbackDetailPanel } from "./feedback-detail-panel";
import { ReportFeedbackDialog } from "./report-feedback-dialog";

function asString(value: string | string[] | boolean | null | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asArray(value: string | string[] | boolean | null | undefined): string[] | undefined {
  if (Array.isArray(value)) return value.length ? value : undefined;
  return typeof value === "string" && value ? [value] : undefined;
}

/**
 * Reports in a DataView (list + detail panel). "mine": the user's own
 * reports (account page); "all": every organization's reports for the
 * platform admin, who can also switch to a kanban board by status.
 */
export function FeedbackListView({
  scope,
  initialData,
}: {
  scope: "mine" | "all";
  initialData: PaginatedResult<FeedbackListRow>;
}) {
  const t = useTranslations("platformFeedback");
  const format = useFormatter();
  const isAdmin = scope === "all";
  const [view, setView] = useState<"list" | "board">("list");
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<FeedbackListRow>> => {
      const result = await listFeedbackAction({
        scope,
        search: params.search || undefined,
        statuses: asArray(params.filters.status),
        kind: asString(params.filters.kind),
        priority: asString(params.filters.priority),
        page: params.page,
        pageSize: params.pageSize,
      });
      if (result.success) return (result as { data: PaginatedResult<FeedbackListRow> }).data;
      throw new Error((result as { error: string }).error);
    },
    [scope]
  );

  const detailFetcher = useCallback(async (id: string): Promise<FeedbackDetail | null> => {
    const result = await getFeedbackAction(id);
    return result.success ? (result as { data: FeedbackDetail | null }).data : null;
  }, []);

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "multi-select",
        key: "status",
        label: t("filters.status"),
        options: FEEDBACK_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
      },
      {
        type: "select",
        key: "kind",
        label: t("filters.kind"),
        options: FEEDBACK_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) })),
      },
      ...(isAdmin
        ? [
            {
              type: "select" as const,
              key: "priority",
              label: t("filters.priority"),
              options: FEEDBACK_PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) })),
            },
          ]
        : []),
    ],
    [isAdmin, t]
  );

  const columns = useMemo<DataViewColumnDef<FeedbackListRow>[]>(
    () => [
      {
        key: "code",
        header: t("columns.code"),
        accessor: (row) => <span className="font-mono text-xs">{row.code}</span>,
        defaultVisible: true,
      },
      {
        key: "title",
        header: t("columns.title"),
        accessor: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <FeedbackKindBadge kind={row.kind} />
            <span className="truncate font-medium">{row.title}</span>
          </div>
        ),
        defaultVisible: true,
      },
      {
        key: "status",
        header: t("columns.status"),
        accessor: (row) => (
          <div className="flex items-center gap-1.5">
            <FeedbackStatusBadge status={row.status} />
            <FeedbackPriorityBadge priority={row.priority} />
          </div>
        ),
        defaultVisible: true,
      },
      ...(isAdmin
        ? [
            {
              key: "reporter",
              header: t("columns.reporter"),
              accessor: (row: FeedbackListRow) => (
                <div className="min-w-0 text-sm">
                  <div className="truncate">{row.reporter_name || row.reporter_email || "—"}</div>
                  {row.organization_name && (
                    <div className="text-muted-foreground truncate text-xs">
                      {row.organization_name}
                    </div>
                  )}
                </div>
              ),
              defaultVisible: true,
            },
          ]
        : []),
      {
        key: "activity",
        header: t("columns.activity"),
        accessor: (row) => (
          <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            {row.message_count > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {row.message_count}
              </span>
            )}
            {row.attachment_count > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />
                {row.attachment_count}
              </span>
            )}
            {format.relativeTime(new Date(row.last_activity_at))}
          </span>
        ),
        defaultVisible: true,
      },
    ],
    [format, isAdmin, t]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(isAdmin ? "pages.admin.title" : "pages.mine.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t(isAdmin ? "pages.admin.subtitle" : "pages.mine.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="bg-muted inline-flex rounded-md p-0.5" role="tablist">
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                className="h-7"
                onClick={() => setView("list")}
                data-testid="feedback-view-list"
              >
                <List className="mr-1.5 h-3.5 w-3.5" />
                {t("views.list")}
              </Button>
              <Button
                size="sm"
                variant={view === "board" ? "default" : "ghost"}
                className="h-7"
                onClick={() => setView("board")}
                data-testid="feedback-view-board"
              >
                <KanbanSquare className="mr-1.5 h-3.5 w-3.5" />
                {t("views.board")}
              </Button>
            </div>
          )}
          {!isAdmin && (
            <Button size="sm" onClick={() => setReportOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("report.open")}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {view === "board" && isAdmin ? (
          <FeedbackBoard />
        ) : (
          <DataView<FeedbackListRow, FeedbackDetail>
            entity={isAdmin ? "platform-feedback-all" : "platform-feedback-mine"}
            scope={dataViewScope.global()}
            columns={columns}
            filters={filters}
            initialData={initialData}
            queryKey={["platform-feedback", scope]}
            listFetcher={listFetcher}
            detailFetcher={detailFetcher}
            getRowId={(row) => row.id}
            refreshToken={refreshToken}
            renderCompactItem={(row) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[11px]">{row.code}</span>
                  <FeedbackStatusBadge status={row.status} />
                </div>
                <span className="truncate text-sm font-medium">{row.title}</span>
                {isAdmin && (
                  <span className="text-muted-foreground truncate text-xs">
                    {row.reporter_name || row.reporter_email || "—"}
                    {row.organization_name ? ` · ${row.organization_name}` : ""}
                  </span>
                )}
              </div>
            )}
            renderDetail={(detail) => (
              <FeedbackDetailPanel
                key={detail.id}
                initial={detail}
                isAdmin={isAdmin}
                onChanged={() => setRefreshToken((n) => n + 1)}
              />
            )}
          />
        )}
      </div>

      {!isAdmin && (
        <ReportFeedbackDialog
          open={reportOpen}
          onOpenChange={(open) => {
            setReportOpen(open);
            if (!open) setRefreshToken((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
