"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { listTicketsForDataViewAction, getTicketDetailAction } from "@/app/actions/help-desk";
import type {
  HelpdeskTicketListRow,
  HelpdeskTicketDetail,
} from "@/server/services/helpdesk-tickets.service";
import type { HelpdeskTicketType } from "@/server/services/helpdesk-ticket-types.service";
import { TicketStatusBadge } from "@/components/help-desk/ticket-status-badge";
import { TicketPriorityBadge } from "@/components/help-desk/ticket-priority-badge";

const HELPDESK_TICKETS_QUERY_KEY = ["helpdesk-tickets-dataview"];

interface TicketsClientProps {
  initialData: PaginatedResult<HelpdeskTicketListRow>;
  ticketTypes: HelpdeskTicketType[];
  members: Array<{ user_id: string; name: string | null; email: string | null }>;
  canCreate: boolean;
}

async function listFetcher(
  params: DataViewListParams
): Promise<PaginatedResult<HelpdeskTicketListRow>> {
  const result = await listTicketsForDataViewAction(params);
  if (result.success) return result.data;
  throw new Error((result as { success: false; error: string }).error);
}

async function detailFetcher(id: string): Promise<HelpdeskTicketDetail | null> {
  const result = await getTicketDetailAction(id);
  if (!result.success) return null;
  return result.data;
}

function AssigneeAvatars({ assignees }: { assignees: HelpdeskTicketListRow["assignees"] }) {
  if (assignees.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const displayed = assignees.slice(0, 3);
  const extra = assignees.length - displayed.length;
  return (
    <div className="flex items-center gap-1">
      {displayed.map((a) => (
        <span
          key={a.user_id}
          className="bg-muted inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium"
          title={a.name ?? a.email ?? a.user_id}
        >
          {(a.name ?? a.email ?? "?").slice(0, 2).toUpperCase()}
        </span>
      ))}
      {extra > 0 && <span className="text-muted-foreground text-xs">+{extra}</span>}
    </div>
  );
}

export function TicketsClient({
  initialData,
  ticketTypes,
  members,
  canCreate,
}: TicketsClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();

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
                params: { ticketId: row.id },
              })
            }
            className="hover:text-primary text-left font-medium transition-colors"
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
        key: "status",
        header: t("tickets.columns.status"),
        accessor: (row) => <TicketStatusBadge status={row.status} />,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "priority",
        header: t("tickets.columns.priority"),
        accessor: (row) => <TicketPriorityBadge priority={row.priority} />,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "creator",
        header: t("tickets.columns.createdBy"),
        accessor: (row) => (
          <span className="text-sm">{row.creator_name ?? row.creator_email ?? "—"}</span>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "assignees",
        header: t("tickets.columns.responders"),
        accessor: (row) => <AssigneeAvatars assignees={row.assignees} />,
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
    [t, router]
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
        type: "select",
        key: "createdBy",
        label: t("tickets.filters.createdBy"),
        options: memberOptions,
      },
      {
        type: "select",
        key: "assignedTo",
        label: t("tickets.filters.assignedTo"),
        options: memberOptions,
      },
      {
        type: "select",
        key: "status",
        label: t("tickets.filters.status"),
        options: [
          { label: t("tickets.status.open"), value: "open" },
          { label: t("tickets.status.in_progress"), value: "in_progress" },
          { label: t("tickets.status.waiting_response"), value: "waiting_response" },
          { label: t("tickets.status.waiting"), value: "waiting" },
          { label: t("tickets.status.resolved"), value: "resolved" },
          { label: t("tickets.status.closed"), value: "closed" },
          { label: t("tickets.status.cancelled"), value: "cancelled" },
        ],
      },
      {
        type: "select",
        key: "priority",
        label: t("tickets.filters.priority"),
        options: [
          { label: t("tickets.priority.low"), value: "low" },
          { label: t("tickets.priority.medium"), value: "medium" },
          { label: t("tickets.priority.high"), value: "high" },
          { label: t("tickets.priority.urgent"), value: "urgent" },
        ],
      },
      ...(typeOptions.length > 0
        ? [
            {
              type: "select" as const,
              key: "ticketTypeId",
              label: t("tickets.filters.ticketType"),
              options: typeOptions,
            },
          ]
        : []),
    ],
    [t, memberOptions, typeOptions]
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
          getRowId={(row) => row.id}
          renderCompactItem={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">{row.ticket_number}</span>
                <TicketStatusBadge status={row.status} />
              </div>
              <span className="text-sm font-medium">{row.title}</span>
            </div>
          )}
          renderDetail={(detail) => (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-muted-foreground font-mono text-xs">{detail.ticket_number}</p>
                  <h3 className="mt-1 text-base font-semibold">{detail.title}</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = `/dashboard/help-desk/tickets/${detail.id}`)
                  }
                >
                  <Ticket className="mr-1 h-3 w-3" />
                  {t("tickets.viewFull")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <TicketStatusBadge status={detail.status} />
                <TicketPriorityBadge priority={detail.priority} />
              </div>
              {detail.ticket_type_name && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    {t("tickets.columns.type")}
                  </p>
                  <p className="text-sm">{detail.ticket_type_name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs uppercase">
                  {t("tickets.columns.createdBy")}
                </p>
                <p className="text-sm">{detail.creator_name ?? detail.creator_email ?? "—"}</p>
              </div>
              {detail.assignees.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    {t("tickets.columns.responders")}
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {detail.assignees.map((a) => (
                      <span key={a.user_id} className="text-sm">
                        {a.name ?? a.email ?? a.user_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detail.description_plain && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    {t("tickets.description")}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm line-clamp-4">
                    {detail.description_plain}
                  </p>
                </div>
              )}
              <div className="pt-1">
                <p className="text-muted-foreground text-xs">
                  {t("tickets.comments")}: {detail.comments.length}
                </p>
              </div>
            </div>
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
