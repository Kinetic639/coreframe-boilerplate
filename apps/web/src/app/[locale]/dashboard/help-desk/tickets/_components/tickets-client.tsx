"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Plus, Ticket, Calendar, Clock, Tag, User, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { listTicketsForDataViewAction, getTicketDetailAction } from "@/app/actions/help-desk";
import { useAddTicketCommentMutation, useAcceptTicketMutation } from "@/hooks/queries/help-desk";
import type {
  HelpdeskTicketListRow,
  HelpdeskTicketDetail,
  HelpdeskTicketComment,
  HelpdeskTicketActivity,
} from "@/server/services/helpdesk-tickets.service";
import type { HelpdeskTicketType } from "@/server/services/helpdesk-ticket-types.service";
import {
  TicketStatusBadge,
  type StatusBadgeConfig,
} from "@/components/help-desk/ticket-status-badge";
import {
  TicketPriorityBadge,
  type PriorityBadgeConfig,
} from "@/components/help-desk/ticket-priority-badge";
import { UserAvatarGroup } from "@/components/primitives/avatar/user-avatar-group";
import type { UserAvatarGroupItem } from "@/components/primitives/avatar/user-avatar-group";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { CommentRenderer } from "@/components/primitives/comments/comment-renderer";
import { CommentEditor } from "@/components/primitives/comments/comment-editor";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";

const HELPDESK_TICKETS_QUERY_KEY = ["helpdesk-tickets-dataview"];

interface TicketsClientProps {
  initialData: PaginatedResult<HelpdeskTicketListRow>;
  ticketTypes: HelpdeskTicketType[];
  members: Array<{ user_id: string; name: string | null; email: string | null }>;
  branches: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canManage: boolean;
  currentUserId: string;
  orgId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}

function TicketDetailPanel({
  detail,
  canManage,
  currentUserId,
  statusConfigs,
  priorityConfigs,
}: {
  detail: HelpdeskTicketDetail;
  canManage: boolean;
  currentUserId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}) {
  const t = useTranslations("modules.helpDesk");
  const [comments, setComments] = useState<HelpdeskTicketComment[]>(detail.comments);
  const [activity, setActivity] = useState<HelpdeskTicketActivity[]>(detail.activity);
  const [commentValue, setCommentValue] = useState<RichTextValue>(createEmptyRichText);

  const [acceptedAt, setAcceptedAt] = useState<string | null>(detail.accepted_at);
  const [acceptedByName, setAcceptedByName] = useState<string | null>(detail.accepted_by_name);

  const addCommentMutation = useAddTicketCommentMutation(detail.ticket_number);
  const acceptMutation = useAcceptTicketMutation(detail.ticket_number);
  const canComment = detail.status !== "closed" && detail.status !== "cancelled";
  const canAccept =
    detail.requires_acceptance &&
    !acceptedAt &&
    (canManage || detail.acceptors.some((a) => a.user_id === currentUserId));

  const handleAddComment = useCallback(
    (value: RichTextValue) => {
      const bodyPlain = extractPlainText(value);
      if (!bodyPlain.trim()) return;
      addCommentMutation.mutate(
        { ticket_id: detail.id, body: bodyPlain.trim(), body_rich: value, is_internal: false },
        {
          onSuccess: async () => {
            setCommentValue(createEmptyRichText());
            // Refetch to get fresh comments + activity with signed avatars
            const fresh = await getTicketDetailAction(detail.ticket_number, detail.org_id);
            if (fresh.success && fresh.data) {
              setComments(fresh.data.comments);
              setActivity(fresh.data.activity);
            }
          },
        }
      );
    },
    [addCommentMutation, detail.id]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <p className="text-muted-foreground font-mono text-xs">{detail.ticket_number}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug">{detail.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={detail.status} config={statusConfigs?.[detail.status]} />
          <TicketPriorityBadge
            priority={detail.priority}
            config={priorityConfigs?.[detail.priority]}
          />
          {detail.ticket_type_name && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: detail.ticket_type_color ?? undefined }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: detail.ticket_type_color ?? "#6366f1" }}
              />
              {detail.ticket_type_name}
            </span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        {/* Main: description + comments */}
        <div className="min-w-0 flex-1 space-y-4">
          {(detail.description_rich || detail.description_plain) && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                {t("tickets.description")}
              </p>
              <RichTextRenderer
                value={normalizeRichText(detail.description_rich)}
                emptyText={detail.description_plain ?? undefined}
                prose
                className="break-words"
              />
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">
              {t("tickets.comments")} ({comments.length})
            </h4>
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("tickets.noComments")}</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <CommentRenderer
                    key={c.id}
                    value={normalizeRichText(c.body_rich) ?? undefined}
                    author={{
                      name: c.creator_name ?? c.creator_email ?? "Unknown",
                      email: c.creator_email ?? undefined,
                      avatarUrl: c.creator_avatar_url ?? undefined,
                      profileHref: c.creator_profile_href ?? undefined,
                    }}
                    createdAt={new Date(c.created_at).toLocaleString()}
                    emptyText={c.body}
                    density="compact"
                  />
                ))}
              </div>
            )}
            {canComment && (
              <CommentEditor
                value={commentValue}
                onChange={setCommentValue}
                onSubmit={handleAddComment}
                placeholder={t("tickets.commentPlaceholder")}
                submitLabel={t("tickets.addComment")}
                submitting={addCommentMutation.isPending}
                density="compact"
              />
            )}
          </div>
        </div>

        {/* Sidebar: view button + details */}
        <div className="w-full shrink-0 space-y-3 self-start lg:w-52">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              (window.location.href = `/dashboard/help-desk/tickets/${detail.ticket_number}`)
            }
          >
            <Ticket className="mr-1.5 h-3.5 w-3.5" />
            {t("tickets.viewFull")}
          </Button>

          {/* Acceptance card */}
          {detail.requires_acceptance && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-muted-foreground text-[10px] uppercase font-medium">
                {t("tickets.acceptance.label")}
              </p>
              {acceptedAt ? (
                <div className="space-y-1">
                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {t("tickets.acceptance.accepted")}
                  </span>
                  {acceptedByName && (
                    <p className="truncate text-xs text-muted-foreground">{acceptedByName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(acceptedAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  {t("tickets.acceptance.pending")}
                </span>
              )}
              {detail.acceptors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {t("tickets.acceptance.authorizedAcceptors")}
                  </p>
                  {detail.acceptors.map((a) => (
                    <div key={a.user_id} className="flex items-center gap-2">
                      <UserAvatar
                        className="h-5 w-5"
                        fullName={a.name}
                        email={a.email}
                        src={a.avatar_url}
                        profileHref={a.profile_href}
                      />
                      <span className="truncate text-xs">{a.name ?? a.email}</span>
                    </div>
                  ))}
                </div>
              )}
              {canAccept && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={acceptMutation.isPending}
                  onClick={() =>
                    acceptMutation.mutate(
                      { ticket_id: detail.id },
                      {
                        onSuccess: async () => {
                          const fresh = await getTicketDetailAction(
                            detail.ticket_number,
                            detail.org_id
                          );
                          if (fresh.success && fresh.data) {
                            setAcceptedAt(fresh.data.accepted_at);
                            setAcceptedByName(fresh.data.accepted_by_name);
                            setComments(fresh.data.comments);
                            setActivity(fresh.data.activity);
                          }
                        },
                      }
                    )
                  }
                >
                  {acceptMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("tickets.acceptance.acceptButton")}
                </Button>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start gap-2">
              <User className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase">
                  {t("tickets.columns.createdBy")}
                </p>
                <p className="truncate text-xs">
                  {detail.creator_name ?? detail.creator_email ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase">
                  {t("tickets.columns.createdAt")}
                </p>
                <p className="text-xs">{new Date(detail.created_at).toLocaleString()}</p>
              </div>
            </div>

            {detail.due_at && (
              <div className="flex items-start gap-2">
                <Clock className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    {t("tickets.fields.dueAt")}
                  </p>
                  <p className="text-xs">{new Date(detail.due_at).toLocaleString()}</p>
                </div>
              </div>
            )}

            {detail.ticket_type_name && (
              <div className="flex items-start gap-2">
                <Tag className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    {t("tickets.columns.type")}
                  </p>
                  <p className="truncate text-xs">{detail.ticket_type_name}</p>
                </div>
              </div>
            )}

            {detail.assignees.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1.5 text-[10px] uppercase">
                    {t("tickets.columns.responders")}
                  </p>
                  <div className="space-y-1.5">
                    {detail.assignees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-2">
                        <UserAvatar
                          className="h-5 w-5"
                          fullName={a.name}
                          email={a.email}
                          src={a.avatar_url}
                          profileHref={a.profile_href ?? undefined}
                        />
                        <span className="truncate text-xs">{a.name ?? a.email ?? a.user_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {activity.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="text-xs font-semibold">{t("tickets.activityLabel")}</h4>
              <div className="space-y-2">
                {activity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 pt-0.5">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {a.actor_name ?? "System"}
                      </span>{" "}
                      {t(`tickets.activity.${a.event_type}`, { defaultValue: a.event_type })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssigneeAvatars({ assignees }: { assignees: HelpdeskTicketListRow["assignees"] }) {
  if (assignees.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const users: UserAvatarGroupItem[] = assignees.map((a) => ({
    id: a.user_id,
    fullName: a.name ?? undefined,
    email: a.email ?? undefined,
    src: a.avatar_url ?? undefined,
    profileHref: a.profile_href ?? undefined,
  }));
  return <UserAvatarGroup users={users} max={3} size="sm" popoverSide="top" />;
}

export function TicketsClient({
  initialData,
  ticketTypes,
  members,
  branches,
  canCreate,
  canManage,
  currentUserId,
  orgId,
  statusConfigs,
  priorityConfigs,
}: TicketsClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<HelpdeskTicketListRow>> => {
      const result = await listTicketsForDataViewAction(params, orgId);
      if (result.success) return result.data;
      throw new Error((result as { success: false; error: string }).error);
    },
    [orgId]
  );

  const detailFetcher = useCallback(
    async (ticketNumber: string): Promise<HelpdeskTicketDetail | null> => {
      const result = await getTicketDetailAction(ticketNumber, orgId);
      if (!result.success) return null;
      return result.data;
    },
    [orgId]
  );

  const typeOptions = useMemo(
    () => ticketTypes.map((tt) => ({ label: tt.name, value: tt.id })),
    [ticketTypes]
  );

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        label: m.name || m.email || m.user_id,
        value: m.user_id,
      })),
    [members]
  );

  const branchOptions = useMemo(
    () => branches.map((b) => ({ label: b.name, value: b.id })),
    [branches]
  );

  const branchNameMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const columns = useMemo<DataViewColumnDef<HelpdeskTicketListRow>[]>(
    () => [
      {
        key: "ticket_number",
        header: t("tickets.columns.number"),
        accessor: (row) => (
          <span className="text-muted-foreground font-mono text-xs">{row.ticket_number}</span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "title",
        header: t("tickets.columns.title"),
        accessor: (row) => (
          <button
            onClick={() =>
              router.push({
                pathname: "/dashboard/help-desk/tickets/[ticketId]",
                params: { ticketId: row.ticket_number },
              })
            }
            className="hover:text-primary max-w-[28ch] truncate text-left font-medium transition-colors"
            title={row.title}
          >
            {row.title}
          </button>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "ticket_type",
        header: t("tickets.columns.type"),
        accessor: (row) =>
          row.ticket_type_name ? (
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: row.ticket_type_color ?? undefined }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: row.ticket_type_color ?? "#6366f1" }}
              />
              {row.ticket_type_name}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "branch",
        header: t("tickets.columns.branch"),
        accessor: (row) =>
          row.branch_id ? (
            <span className="text-sm">{branchNameMap.get(row.branch_id) ?? "—"}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortable: false,
        defaultVisible: branchOptions.length > 0,
      },
      {
        key: "status",
        header: t("tickets.columns.status"),
        accessor: (row) => (
          <TicketStatusBadge status={row.status} config={statusConfigs?.[row.status]} />
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "priority",
        header: t("tickets.columns.priority"),
        accessor: (row) => (
          <TicketPriorityBadge priority={row.priority} config={priorityConfigs?.[row.priority]} />
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "acceptance",
        header: t("tickets.columns.acceptance"),
        accessor: (row) =>
          row.requires_acceptance ? (
            row.accepted_at ? (
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {t("tickets.acceptance.accepted")}
              </span>
            ) : (
              <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                {t("tickets.acceptance.pending")}
              </span>
            )
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "creator",
        header: t("tickets.columns.createdBy"),
        accessor: (row) =>
          row.creator_name || row.creator_email ? (
            <div className="flex justify-center">
              <UserAvatar
                className="h-6 w-6"
                fullName={row.creator_name}
                email={row.creator_email}
                src={row.creator_avatar_url}
                profileHref={row.creator_profile_href ?? undefined}
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="text-muted-foreground text-xs">—</span>
            </div>
          ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "assignees",
        header: t("tickets.columns.responders"),
        accessor: (row) => (
          <div className="flex justify-center">
            <AssigneeAvatars assignees={row.assignees} />
          </div>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "created_at",
        header: t("tickets.columns.createdAt"),
        accessor: (row) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "updated_at",
        header: t("tickets.columns.updatedAt"),
        accessor: (row) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.updated_at).toLocaleDateString()}
          </span>
        ),
        sortable: true,
        defaultVisible: false,
      },
    ],
    [t, router, branchNameMap, branchOptions.length, statusConfigs, priorityConfigs]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "date-range",
        key: "createdAt",
        label: t("tickets.filters.createdAt"),
        fromKey: "createdAtFrom",
        toKey: "createdAtTo",
      },
      {
        type: "multi-select",
        key: "createdBy",
        label: t("tickets.filters.createdBy"),
        options: memberOptions,
      },
      {
        type: "multi-select",
        key: "assignedTo",
        label: t("tickets.filters.assignedTo"),
        options: memberOptions,
      },
      {
        type: "multi-select",
        key: "status",
        label: t("tickets.filters.status"),
        options: [
          { label: statusConfigs?.["open"]?.label ?? t("tickets.status.open"), value: "open" },
          {
            label: statusConfigs?.["in_progress"]?.label ?? t("tickets.status.in_progress"),
            value: "in_progress",
          },
          {
            label:
              statusConfigs?.["waiting_response"]?.label ?? t("tickets.status.waiting_response"),
            value: "waiting_response",
          },
          {
            label: statusConfigs?.["waiting"]?.label ?? t("tickets.status.waiting"),
            value: "waiting",
          },
          {
            label: statusConfigs?.["resolved"]?.label ?? t("tickets.status.resolved"),
            value: "resolved",
          },
          {
            label: statusConfigs?.["closed"]?.label ?? t("tickets.status.closed"),
            value: "closed",
          },
          {
            label: statusConfigs?.["cancelled"]?.label ?? t("tickets.status.cancelled"),
            value: "cancelled",
          },
        ],
      },
      {
        type: "multi-select",
        key: "priority",
        label: t("tickets.filters.priority"),
        options: [
          { label: priorityConfigs?.["low"]?.label ?? t("tickets.priority.low"), value: "low" },
          {
            label: priorityConfigs?.["medium"]?.label ?? t("tickets.priority.medium"),
            value: "medium",
          },
          { label: priorityConfigs?.["high"]?.label ?? t("tickets.priority.high"), value: "high" },
          {
            label: priorityConfigs?.["urgent"]?.label ?? t("tickets.priority.urgent"),
            value: "urgent",
          },
        ],
      },
      ...(typeOptions.length > 0
        ? [
            {
              type: "multi-select" as const,
              key: "ticketTypeId",
              label: t("tickets.filters.ticketType"),
              options: typeOptions,
            },
          ]
        : []),
      ...(branchOptions.length > 0
        ? [
            {
              type: "multi-select" as const,
              key: "branchId",
              label: t("tickets.filters.branch"),
              options: branchOptions,
            },
          ]
        : []),
    ],
    [t, memberOptions, typeOptions, branchOptions, statusConfigs, priorityConfigs]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.tickets.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pages.tickets.subtitle")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/dashboard/help-desk/tickets/new")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("tickets.createTicket")}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataView<HelpdeskTicketListRow, HelpdeskTicketDetail>
          entity="helpdesk-tickets"
          columns={columns}
          filters={filters}
          initialData={initialData}
          queryKey={HELPDESK_TICKETS_QUERY_KEY}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.ticket_number}
          renderCompactItem={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs">{row.ticket_number}</span>
                <TicketStatusBadge status={row.status} config={statusConfigs?.[row.status]} />
              </div>
              <span className="truncate text-sm font-medium" title={row.title}>
                {row.title}
              </span>
            </div>
          )}
          renderDetail={(detail) => (
            <TicketDetailPanel
              key={detail.id}
              detail={detail}
              canManage={canManage}
              currentUserId={currentUserId}
              statusConfigs={statusConfigs}
              priorityConfigs={priorityConfigs}
            />
          )}
          renderToolbarControls={() =>
            canCreate ? (
              <Button size="sm" onClick={() => router.push("/dashboard/help-desk/tickets/new")}>
                <Plus className="mr-2 h-4 w-4" />
                {t("tickets.createTicket")}
              </Button>
            ) : null
          }
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
