import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { PlanningWidget } from "../_components/planning-widget";
import { homeCopy } from "../_lib/copy";
import type { HomePlanningSummary, WidgetResult } from "../_lib/model";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: unknown; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);
const copy = homeCopy("pl");

function ready(data: HomePlanningSummary): Promise<WidgetResult<HomePlanningSummary>> {
  return Promise.resolve({ state: "ready", data });
}

describe("planning dashboard summary", () => {
  it("renders real calendar, task and board values", async () => {
    const data = {
      timeZone: "Europe/Warsaw",
      todayItems: [
        {
          id: "planning_task:task-1",
          title: "Przygotuj części",
          startAt: "2026-09-12T06:00:00.000Z",
          allDay: false,
          color: "#0d9488",
          category: "task",
          calendarSourceId: "source:planning_tasks",
          sourceModule: "planning",
          sourceType: "planning_task",
          sourceId: "task-1",
          metadata: {},
          calendarLabel: "Zadania",
          calendarColor: "#0d9488",
        },
      ],
      tasks: [{ id: "task-1", task_number: "PT-000001", title: "Przygotuj części" }],
      openCount: 3,
      inProgressCount: 1,
      board: {
        id: "board-1",
        title: "Serwis",
        columns: [{ id: "column-1", title: "W toku", color: "#0d9488", count: 2 }],
      },
    } as HomePlanningSummary;

    render(await PlanningWidget({ resultPromise: ready(data), copy, locale: "pl" }));
    expect(screen.getAllByText("Przygotuj części")).toHaveLength(2);
    const calendarLabel = screen.getAllByText("Zadania").find((node) => node.closest("a"));
    expect(calendarLabel).toBeInTheDocument();
    expect(calendarLabel?.closest("a")).toHaveStyle({
      borderLeftColor: "#0d9488",
      backgroundColor: "#0d948814",
    });
    expect(screen.getByText("Serwis")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.openCalendar })).toBeInTheDocument();
  });

  it("uses compact truthful empty states", async () => {
    const data = {
      timeZone: "UTC",
      todayItems: [],
      tasks: [],
      openCount: 0,
      inProgressCount: 0,
      board: null,
    } as HomePlanningSummary;
    render(await PlanningWidget({ resultPromise: ready(data), copy, locale: "pl" }));
    expect(screen.getByText(copy.todayEmpty)).toBeInTheDocument();
    expect(screen.getByText(copy.taskListEmpty)).toBeInTheDocument();
    expect(screen.getByText(copy.kanbanEmpty)).toBeInTheDocument();
  });

  it("omits planning content when its authorized read is unavailable", async () => {
    const result = Promise.resolve({ state: "unavailable" } as const);
    expect(await PlanningWidget({ resultPromise: result, copy, locale: "pl" })).toBeNull();
  });
});
