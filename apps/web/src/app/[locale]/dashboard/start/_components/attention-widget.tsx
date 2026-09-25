import { Link } from "@/i18n/navigation";
import { TicketPriorityBadge } from "@/components/help-desk/ticket-priority-badge";
import { loadAttention } from "../_lib/data";
import { formatActivityDate, ticketListQuery } from "../_lib/model";
import type { HomeCopy } from "../_lib/copy";
import { WidgetFrame, WidgetEmpty, WidgetUnavailable } from "./home-sections";

export async function AttentionWidget({
  orgId,
  branchId,
  locale = "pl",
  copy,
  resultPromise,
}: {
  orgId: string;
  branchId: string;
  locale?: string;
  copy: HomeCopy;
  resultPromise?: ReturnType<typeof loadAttention>;
}) {
  const result = await (resultPromise ?? loadAttention(orgId, branchId));
  return (
    <WidgetFrame
      id="home-attention"
      title={copy.attention}
      description={copy.attentionDescription}
      count={result.state === "ready" ? result.data.totalCount : undefined}
      tone="attention"
    >
      {result.state === "unavailable" ? (
        <WidgetUnavailable copy={copy} />
      ) : result.data.rows.length === 0 ? (
        <WidgetEmpty title={copy.attentionEmpty} description={copy.attentionEmptyDescription} />
      ) : (
        <div className="border-y">
          <div className="hidden grid-cols-[5rem_4.5rem_5.5rem_minmax(6rem,1fr)_5.5rem_5.25rem] gap-2 border-b bg-muted/30 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground xl:grid">
            <span>{copy.columnId}</span>
            <span>{copy.columnPriority}</span>
            <span>{copy.columnType}</span>
            <span>{copy.columnTitle}</span>
            <span>{copy.columnOwner}</span>
            <span>{copy.columnTime}</span>
          </div>
          <ul className="divide-y">
            {result.data.rows.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={{
                    pathname: "/dashboard/help-desk/tickets/[ticketId]",
                    params: { ticketId: ticket.id },
                  }}
                  prefetch={false}
                  className="group block px-2 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="xl:hidden">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-card-foreground/80">
                        {ticket.ticket_number}
                      </span>
                      <TicketPriorityBadge
                        priority={ticket.priority}
                        config={result.data.priorityConfigs?.[ticket.priority]}
                      />
                      {ticket.ticket_type_name ? (
                        <span
                          className="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]"
                          style={{ borderColor: ticket.ticket_type_color ?? undefined }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: ticket.ticket_type_color ?? "#6366f1" }}
                          />
                          {ticket.ticket_type_name}
                        </span>
                      ) : null}
                    </div>
                    <p className="break-words text-sm font-medium group-hover:underline">
                      {ticket.title}
                    </p>
                    {ticket.assignees?.[0]?.name || ticket.updated_at ? (
                      <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                        {ticket.assignees?.[0]?.name ? (
                          <span>{ticket.assignees[0].name}</span>
                        ) : null}
                        {ticket.updated_at ? (
                          <time dateTime={ticket.updated_at}>
                            {formatActivityDate(ticket.updated_at, locale)}
                          </time>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="hidden grid-cols-[5rem_4.5rem_5.5rem_minmax(6rem,1fr)_5.5rem_5.25rem] items-center gap-2 xl:grid">
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {ticket.ticket_number}
                    </span>
                    <TicketPriorityBadge
                      priority={ticket.priority}
                      config={result.data.priorityConfigs?.[ticket.priority]}
                      className="min-w-0 max-w-full"
                    />
                    <span
                      className="inline-flex min-w-0 items-center gap-1 text-[11px]"
                      style={{ color: ticket.ticket_type_color ?? undefined }}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ticket.ticket_type_color ?? "#6366f1" }}
                      />
                      <span className="truncate">{ticket.ticket_type_name ?? "—"}</span>
                    </span>
                    <span className="truncate text-xs font-medium group-hover:underline">
                      {ticket.title}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {ticket.assignees?.[0]?.name ?? "—"}
                    </span>
                    {ticket.updated_at ? (
                      <time
                        dateTime={ticket.updated_at}
                        className="truncate text-[11px] text-muted-foreground"
                      >
                        {formatActivityDate(ticket.updated_at, locale)}
                      </time>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
        {result.state === "ready" ? (
          <span className="text-xs text-card-foreground/80">
            {copy.shown
              .replace("{shown}", String(result.data.rows.length))
              .replace("{total}", String(result.data.totalCount))}
          </span>
        ) : null}
        <Link
          href={{ pathname: "/dashboard/help-desk/tickets", query: ticketListQuery(branchId) }}
          prefetch={false}
          className="rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.queue}
        </Link>
      </div>
    </WidgetFrame>
  );
}
