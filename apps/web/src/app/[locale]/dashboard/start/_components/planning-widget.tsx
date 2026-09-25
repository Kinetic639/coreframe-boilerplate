import { CalendarDays, Columns3, ListTodo } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import type { ComponentProps, CSSProperties } from "react";
import type { HomeCopy } from "../_lib/copy";
import type { HomePlanningSummary, WidgetResult } from "../_lib/model";

type AppHref = ComponentProps<typeof Link>["href"];

function eventHref(item: HomePlanningSummary["todayItems"][number]): AppHref {
  if (item.sourceType === "planning_task")
    return {
      pathname: "/dashboard/planning/tasks/[taskId]",
      params: { taskId: item.sourceId },
    };
  if (item.sourceType === "helpdesk_ticket")
    return {
      pathname: "/dashboard/help-desk/tickets/[ticketId]",
      params: { ticketId: item.sourceId },
    };
  if (item.sourceType === "kanban_card" && typeof item.metadata.boardId === "string")
    return {
      pathname: "/dashboard/planning/boards",
      query: { board: item.metadata.boardId },
    };
  return "/dashboard/planning";
}

function eventTime(
  item: HomePlanningSummary["todayItems"][number],
  locale: string,
  timeZone: string,
  allDay: string
) {
  if (!item.startAt) return allDay;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(item.startAt));
}

function calendarEventStyle(color: string): CSSProperties {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return {};
  return {
    borderLeftColor: color,
    backgroundColor: `${color}14`,
  };
}

function PanelHeader({ icon: Icon, title }: { icon: typeof CalendarDays; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <h2 className="text-xs font-semibold uppercase tracking-wide">{title}</h2>
    </div>
  );
}

export async function PlanningWidget({
  resultPromise,
  copy,
  locale,
}: {
  resultPromise: Promise<WidgetResult<HomePlanningSummary>>;
  copy: HomeCopy;
  locale: string;
}) {
  const result = await resultPromise;
  if (result.state !== "ready") return null;
  const data = result.data;
  return (
    <section
      aria-label={copy.workPlanning}
      className="grid gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-3"
    >
      <Card className="rounded-none border-0 shadow-none">
        <PanelHeader icon={CalendarDays} title={copy.today} />
        <div className="divide-y px-3">
          {data.todayItems.length ? (
            data.todayItems.map((item) => (
              <Link
                key={item.id}
                href={eventHref(item)}
                className="my-1 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 rounded-sm border-l-2 px-2 py-1.5 text-xs transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={calendarEventStyle(item.calendarColor)}
              >
                <span className="tabular-nums text-muted-foreground">
                  {eventTime(item, locale, data.timeZone, copy.allDay)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.calendarColor }}
                    />
                    <span className="truncate">{item.calendarLabel}</span>
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="py-3 text-xs text-muted-foreground">{copy.todayEmpty}</p>
          )}
        </div>
        <Link
          href="/dashboard/planning"
          className="block border-t px-3 py-2 text-xs font-medium underline-offset-4 hover:underline"
        >
          {copy.openCalendar}
        </Link>
      </Card>

      <Card className="rounded-none border-0 shadow-none">
        <PanelHeader icon={ListTodo} title={copy.tasks} />
        <div className="flex gap-4 border-b px-3 py-2 text-xs">
          <span>
            <strong className="mr-1 tabular-nums">{data.openCount}</strong>
            {copy.openLabel}
          </span>
          <span>
            <strong className="mr-1 tabular-nums">{data.inProgressCount}</strong>
            {copy.inProgressLabel}
          </span>
        </div>
        <div className="divide-y px-3">
          {data.tasks.length ? (
            data.tasks.map((task) => (
              <Link
                key={task.id}
                href={{
                  pathname: "/dashboard/planning/tasks/[taskId]",
                  params: { taskId: task.id },
                }}
                className="flex items-center justify-between gap-2 py-2 text-xs hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate font-medium">{task.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {task.task_number}
                </span>
              </Link>
            ))
          ) : (
            <p className="py-3 text-xs text-muted-foreground">{copy.taskListEmpty}</p>
          )}
        </div>
        <Link
          href="/dashboard/planning/tasks"
          className="block border-t px-3 py-2 text-xs font-medium underline-offset-4 hover:underline"
        >
          {copy.openTasks}
        </Link>
      </Card>

      <Card className="rounded-none border-0 shadow-none">
        <PanelHeader icon={Columns3} title={copy.kanbanSnapshot} />
        {data.board ? (
          <>
            <p className="truncate border-b px-3 py-2 text-xs font-medium">{data.board.title}</p>
            <div className="divide-y px-3">
              {data.board.columns.slice(0, 5).map((column) => (
                <div
                  key={column.id}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
                      style={column.color ? { backgroundColor: column.color } : undefined}
                    />
                    <span className="truncate">{column.title}</span>
                  </span>
                  <strong className="tabular-nums">{column.count}</strong>
                </div>
              ))}
            </div>
            <Link
              href={{ pathname: "/dashboard/planning/boards", query: { board: data.board.id } }}
              className="block border-t px-3 py-2 text-xs font-medium underline-offset-4 hover:underline"
            >
              {copy.openBoard}
            </Link>
          </>
        ) : (
          <>
            <p className="px-3 py-3 text-xs text-muted-foreground">{copy.kanbanEmpty}</p>
            <Link
              href="/dashboard/planning/boards"
              className="block border-t px-3 py-2 text-xs font-medium underline-offset-4 hover:underline"
            >
              {copy.openBoard}
            </Link>
          </>
        )}
      </Card>
    </section>
  );
}
