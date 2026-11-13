"use client";

import { useQueryStates } from "nuqs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validations/helpdesk";
import { cn } from "@/lib/utils";
import {
  activeTicketQueue,
  CREATED_WITHIN,
  ticketParsers,
  ticketQueueFilters,
  TICKET_QUEUES,
  UNASSIGNED,
} from "./tickets-state";
import { ticketListQuery } from "./tickets-query";

type Option = { value: string; label: string };

/** How many tickets the address finds (from the list's cache, no request of its own). */
export function TicketsTotal({ orgId, initial }: { orgId: string; initial: number }) {
  const [state] = useQueryStates(ticketParsers);
  const { data } = useQuery({
    ...ticketListQuery(orgId, state),
    placeholderData: keepPreviousData,
  });
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {data?.totalCount ?? initial}
    </span>
  );
}

/**
 * The handler queues: each sets the filters at once (the search and the sort
 * stay), and the filters below keep working on top of it.
 */
export function TicketQueues({
  userId,
  branchId,
  labels,
}: {
  userId: string;
  branchId: string | null;
  labels: Record<string, string>;
}) {
  const [state, setState] = useQueryStates(ticketParsers, { history: "push" });
  const active = activeTicketQueue(state, { userId, branchId });
  return (
    <div
      role="tablist"
      aria-label={labels.queues}
      className="flex h-10 shrink-0 items-stretch gap-1 overflow-x-auto border-b px-2 [scrollbar-width:none]"
    >
      {TICKET_QUEUES.map((queue) => (
        <button
          key={queue}
          type="button"
          role="tab"
          aria-selected={active === queue}
          onClick={() =>
            void setState({
              ...ticketQueueFilters(queue, { userId, branchId }),
              strona: null,
              selected: null,
            })
          }
          className={cn(
            "relative shrink-0 whitespace-nowrap px-2.5 text-[13px] transition-colors",
            "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
            active === queue
              ? "font-medium text-foreground after:bg-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[`queue_${queue}`]}
        </button>
      ))}
    </div>
  );
}

export function TicketFilters({
  orgId,
  order,
  types,
  members,
  branches,
  labels,
}: {
  orgId: string;
  /** The columns' order: the filters follow it. */
  order: string[];
  types: Option[];
  members: Option[];
  branches: Option[];
  labels: Record<string, string>;
}) {
  const [state] = useQueryStates(ticketParsers);
  // The search box spins while this address's rows come (not for prefetches).
  const fetching = useQuery({
    ...ticketListQuery(orgId, state),
    placeholderData: keepPreviousData,
  }).isFetching;
  const fields: FilterField[] = [
    ...(types.length
      ? [{ kind: "list" as const, id: "typ", label: labels.type, options: types }]
      : []),
    {
      kind: "list",
      id: "status",
      label: labels.status,
      options: TICKET_STATUSES.map((value) => ({
        value,
        label: labels[`status_${value}`] ?? value,
      })),
    },
    {
      kind: "list",
      id: "priorytet",
      label: labels.priority,
      options: TICKET_PRIORITIES.map((value) => ({
        value,
        label: labels[`priority_${value}`] ?? value,
      })),
    },
    ...(branches.length
      ? [{ kind: "list" as const, id: "oddzial", label: labels.branch, options: branches }]
      : []),
    { kind: "list", id: "zglaszajacy", label: labels.createdBy, options: members },
    { kind: "list", id: "przypisani", label: labels.responders, options: members },
    {
      kind: "list",
      id: "przypisanie",
      label: labels.assignment,
      options: [{ value: UNASSIGNED, label: labels.unassigned }],
    },
    {
      kind: "dates",
      id: "created_at",
      label: labels.createdAt,
      options: CREATED_WITHIN.map((value) => ({ value, label: labels[`within_${value}`] })),
      keys: { scope: "utworzono", from: "utworzono_od", to: "utworzono_do" },
    },
  ];
  // The filter ids that are not columns sit where their column is.
  const columnOrder = order.flatMap((id) =>
    id === "ticket_type"
      ? ["typ"]
      : id === "priority"
        ? ["priorytet"]
        : id === "branch"
          ? ["oddzial"]
          : id === "creator"
            ? ["zglaszajacy"]
            : id === "assignees"
              ? ["przypisani", "przypisanie"]
              : [id]
  );
  return (
    <div className="ks-list-filter-row">
      <FilterBar
        parsers={ticketParsers}
        fields={fields}
        resetOnChange={["strona", "selected"]}
        shallow
        pending={fetching}
        order={columnOrder}
        search={{ label: labels.search, placeholder: labels.search }}
      />
    </div>
  );
}
