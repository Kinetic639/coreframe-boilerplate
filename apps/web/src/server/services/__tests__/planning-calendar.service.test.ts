/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HELPDESK_TICKETS_READ,
  PLANNING_BOARDS_READ,
  PLANNING_TASKS_READ,
} from "@/lib/constants/permissions";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import { PlanningCalendarService } from "../planning-calendar.service";
import { PlanningTasksService } from "../planning-tasks.service";
import { HelpdeskTicketsService } from "../helpdesk-tickets.service";
import { KanbanBoardsService } from "../kanban-boards.service";
import { EntitlementsService } from "../entitlements-service";

vi.mock("../planning-tasks.service", () => ({
  PlanningTasksService: {
    listForCalendar: vi.fn(),
  },
}));

vi.mock("../helpdesk-tickets.service", () => ({
  HelpdeskTicketsService: {
    listForCalendar: vi.fn(),
  },
}));

vi.mock("../kanban-boards.service", () => ({
  KanbanBoardsService: {
    listBoards: vi.fn(),
    listCardsForCalendar: vi.fn(),
  },
}));

vi.mock("../entitlements-service", () => ({
  EntitlementsService: {
    hasModuleAccess: vi.fn(),
  },
}));

const ORG_ID = "org-1";
const USER_ID = "user-1";
const INPUT = {
  rangeStart: "2026-06-01",
  rangeEnd: "2026-06-30",
  rangeStartIso: "2026-06-01T00:00:00.000Z",
  rangeEndIso: "2026-06-30T23:59:59.999Z",
  includeUnscheduled: true,
  unscheduledLimit: 50,
};

function snapshot(allow: string[]) {
  return { allow, deny: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(EntitlementsService.hasModuleAccess).mockResolvedValue(true);
  vi.mocked(PlanningTasksService.listForCalendar).mockResolvedValue({
    success: true,
    data: {
      scheduled: [],
      unscheduled: [],
      hasMoreUnscheduled: false,
    },
  });
  vi.mocked(HelpdeskTicketsService.listForCalendar).mockResolvedValue({
    success: true,
    data: {
      scheduled: [],
      unscheduled: [],
      hasMoreUnscheduled: false,
    },
  });
  vi.mocked(KanbanBoardsService.listBoards).mockResolvedValue({
    success: true,
    data: [],
  });
  vi.mocked(KanbanBoardsService.listCardsForCalendar).mockResolvedValue({
    success: true,
    data: {
      scheduled: [],
      unscheduled: [],
      hasMoreUnscheduled: false,
    },
  });
});

describe("PlanningCalendarService", () => {
  it("does not load task data without planning task read permission", async () => {
    const result = await PlanningCalendarService.getCalendarData(
      {} as never,
      ORG_ID,
      USER_ID,
      snapshot([]),
      INPUT,
      "UTC"
    );

    expect(result.success).toBe(true);
    expect(PlanningTasksService.listForCalendar).not.toHaveBeenCalled();
  });

  it("does not load ticket data without helpdesk entitlement", async () => {
    vi.mocked(EntitlementsService.hasModuleAccess).mockResolvedValue(false);

    await PlanningCalendarService.getCalendarData(
      {} as never,
      ORG_ID,
      USER_ID,
      snapshot([HELPDESK_TICKETS_READ]),
      INPUT,
      "UTC"
    );

    expect(HelpdeskTicketsService.listForCalendar).not.toHaveBeenCalled();
  });

  it("passes bounded range params to enabled source queries", async () => {
    await PlanningCalendarService.getCalendarData(
      {} as never,
      ORG_ID,
      USER_ID,
      snapshot([PLANNING_TASKS_READ, HELPDESK_TICKETS_READ, PLANNING_BOARDS_READ]),
      INPUT,
      "UTC"
    );

    expect(PlanningTasksService.listForCalendar).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      INPUT
    );
    expect(HelpdeskTicketsService.listForCalendar).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      INPUT
    );
    expect(KanbanBoardsService.listBoards).toHaveBeenCalledWith(expect.anything(), ORG_ID, USER_ID);
  });

  it("keeps sources discoverable while skipping hidden source data queries", async () => {
    const result = await PlanningCalendarService.getCalendarData(
      {} as never,
      ORG_ID,
      USER_ID,
      snapshot([PLANNING_TASKS_READ, HELPDESK_TICKETS_READ]),
      {
        ...INPUT,
        visibleSourceIds: [PLANNING_TASKS_SOURCE_ID],
      },
      "UTC"
    );

    expect(result.success).toBe(true);
    expect(result.success ? result.data.sources.map((source) => source.id) : []).toEqual([
      PLANNING_TASKS_SOURCE_ID,
      HELPDESK_TICKETS_SOURCE_ID,
    ]);
    expect(PlanningTasksService.listForCalendar).toHaveBeenCalled();
    expect(HelpdeskTicketsService.listForCalendar).not.toHaveBeenCalled();
  });

  it("maps scheduled date columns to date-only DTO fields", async () => {
    vi.mocked(PlanningTasksService.listForCalendar).mockResolvedValue({
      success: true,
      data: {
        scheduled: [
          {
            id: "task-1",
            task_number: "PT-000001",
            title: "Scheduled task",
            due_date: "2026-06-12",
            status: "open",
            priority: "normal",
            assigned_to: null,
          },
        ],
        unscheduled: [],
        hasMoreUnscheduled: false,
      },
    });

    const result = await PlanningCalendarService.getCalendarData(
      {} as never,
      ORG_ID,
      USER_ID,
      snapshot([PLANNING_TASKS_READ]),
      INPUT,
      "Europe/Warsaw"
    );

    expect(result.success).toBe(true);
    expect(result.success ? result.data.events[0]?.dueDate : null).toBe("2026-06-12");
  });
});
