/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HELPDESK_TICKETS_MANAGE,
  PLANNING_BOARDS_UPDATE,
  PLANNING_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import { MODULE_HELPDESK } from "@/lib/constants/modules";

const {
  mockCreateClient,
  mockGetUser,
  mockLoadDashboardContextV2,
  mockGetCalendarData,
  mockUpdateTaskDueAt,
  mockUpdateTicketDueAt,
  mockUpdateCardDueAt,
  mockHasModuleAccess,
  mockGetOrCreatePreferences,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
  mockGetCalendarData: vi.fn(),
  mockUpdateTaskDueAt: vi.fn(),
  mockUpdateTicketDueAt: vi.fn(),
  mockUpdateCardDueAt: vi.fn(),
  mockHasModuleAccess: vi.fn(),
  mockGetOrCreatePreferences: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));

vi.mock("@/server/services/planning-calendar.service", () => ({
  PlanningCalendarService: {
    getCalendarData: mockGetCalendarData,
  },
}));

vi.mock("@/server/services/planning-tasks.service", () => ({
  PlanningTasksService: {
    updateDueAt: mockUpdateTaskDueAt,
  },
}));

vi.mock("@/server/services/helpdesk-tickets.service", () => ({
  HelpdeskTicketsService: {
    updateDueAt: mockUpdateTicketDueAt,
  },
}));

vi.mock("@/server/services/kanban-boards.service", () => ({
  KanbanBoardsService: {
    updateCardDueAt: mockUpdateCardDueAt,
  },
}));

vi.mock("@/server/services/entitlements-service", () => ({
  EntitlementsService: {
    hasModuleAccess: mockHasModuleAccess,
  },
}));

vi.mock("@/server/services/user-preferences.service", () => ({
  UserPreferencesService: {
    getOrCreatePreferences: mockGetOrCreatePreferences,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { getPlanningCalendarDataAction, updateCalendarItemDueDateAction } from "../calendar";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const TICKET_ID = "44444444-4444-4444-8444-444444444444";
const BOARD_ID = "55555555-5555-4555-8555-555555555555";
const CARD_ID = "66666666-6666-4666-8666-666666666666";

function makeContext(allow: string[] = []) {
  return {
    app: { activeOrgId: ORG_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow, deny: [] },
    },
  };
}

function resetAuthorizedContext(allow: string[] = [PLANNING_READ]) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mockLoadDashboardContextV2.mockResolvedValue(makeContext(allow));
  mockGetOrCreatePreferences.mockResolvedValue({ timezone: "Europe/Warsaw" });
  mockGetCalendarData.mockResolvedValue({
    success: true,
    data: { sources: [], events: [], unscheduled: [], hasMoreUnscheduled: false },
  });
  mockUpdateTaskDueAt.mockResolvedValue({ success: true, data: undefined });
  mockUpdateTicketDueAt.mockResolvedValue({ success: true, data: undefined });
  mockUpdateCardDueAt.mockResolvedValue({ success: true, data: undefined });
  mockHasModuleAccess.mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthorizedContext();
});

describe("getPlanningCalendarDataAction", () => {
  it("rejects unauthenticated requests before reading calendar data", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getPlanningCalendarDataAction({
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-30",
    });

    expect(result.success).toBe(false);
    expect(mockGetCalendarData).not.toHaveBeenCalled();
  });

  it("requires planning read permission", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext([]));

    const result = await getPlanningCalendarDataAction({
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-30",
    });

    expect(result.success).toBe(false);
    expect(mockGetCalendarData).not.toHaveBeenCalled();
  });

  it("passes bounded range, visible sources, caps, and user timezone to the service", async () => {
    await getPlanningCalendarDataAction({
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-30",
      visibleSourceIds: ["planning_task"],
      includeUnscheduled: false,
      unscheduledLimit: 20,
    });

    expect(mockGetCalendarData).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({ allow: [PLANNING_READ] }),
      expect.objectContaining({
        rangeStart: "2026-06-01",
        rangeEnd: "2026-06-30",
        visibleSourceIds: ["planning_task"],
        includeUnscheduled: false,
        unscheduledLimit: 20,
        rangeStartIso: "2026-05-31T22:00:00.000Z",
        rangeEndIso: "2026-06-30T21:59:59.999Z",
      }),
      "Europe/Warsaw"
    );
  });

  it("rejects inverted date ranges before calling the service", async () => {
    const result = await getPlanningCalendarDataAction({
      rangeStart: "2026-07-01",
      rangeEnd: "2026-06-01",
    });

    expect(result.success).toBe(false);
    expect(mockGetCalendarData).not.toHaveBeenCalled();
  });
});

describe("updateCalendarItemDueDateAction", () => {
  it("requires task update permission for planning task mutations", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext([PLANNING_READ]));

    const result = await updateCalendarItemDueDateAction({
      sourceType: "planning_task",
      sourceId: TASK_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(false);
    expect(mockUpdateTaskDueAt).not.toHaveBeenCalled();
  });

  it("updates planning tasks with a timezone-normalized noon timestamp", async () => {
    resetAuthorizedContext([PLANNING_READ, PLANNING_TASKS_UPDATE]);

    const result = await updateCalendarItemDueDateAction({
      sourceType: "planning_task",
      sourceId: TASK_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(true);
    expect(mockUpdateTaskDueAt).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      TASK_ID,
      "2026-06-12T10:00:00.000Z",
      "2026-06-12"
    );
  });

  it("allows clearing planning task due dates with null", async () => {
    resetAuthorizedContext([PLANNING_READ, PLANNING_TASKS_UPDATE]);

    await updateCalendarItemDueDateAction({
      sourceType: "planning_task",
      sourceId: TASK_ID,
      dueDate: null,
    });

    expect(mockUpdateTaskDueAt).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      TASK_ID,
      null,
      null
    );
  });

  it("requires helpdesk manage permission and module entitlement for ticket mutations", async () => {
    resetAuthorizedContext([PLANNING_READ, HELPDESK_TICKETS_MANAGE]);
    mockHasModuleAccess.mockResolvedValue(false);

    const result = await updateCalendarItemDueDateAction({
      sourceType: "helpdesk_ticket",
      sourceId: TICKET_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(false);
    expect(mockHasModuleAccess).toHaveBeenCalledWith(ORG_ID, MODULE_HELPDESK);
    expect(mockUpdateTicketDueAt).not.toHaveBeenCalled();
  });

  it("updates helpdesk ticket due dates after permission and entitlement checks", async () => {
    resetAuthorizedContext([PLANNING_READ, HELPDESK_TICKETS_MANAGE]);

    const result = await updateCalendarItemDueDateAction({
      sourceType: "helpdesk_ticket",
      sourceId: TICKET_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(true);
    expect(mockUpdateTicketDueAt).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      TICKET_ID,
      "2026-06-12T10:00:00.000Z",
      "2026-06-12"
    );
  });

  it("requires board update permission and board id for kanban card mutations", async () => {
    resetAuthorizedContext([PLANNING_READ, PLANNING_BOARDS_UPDATE]);

    const result = await updateCalendarItemDueDateAction({
      sourceType: "kanban_card",
      sourceId: CARD_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(false);
    expect(mockUpdateCardDueAt).not.toHaveBeenCalled();
  });

  it("updates kanban cards through a board-scoped service call and revalidates board routes", async () => {
    resetAuthorizedContext([PLANNING_READ, PLANNING_BOARDS_UPDATE]);

    const result = await updateCalendarItemDueDateAction({
      sourceType: "kanban_card",
      sourceId: CARD_ID,
      boardId: BOARD_ID,
      dueDate: "2026-06-12",
    });

    expect(result.success).toBe(true);
    expect(mockUpdateCardDueAt).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      CARD_ID,
      BOARD_ID,
      "2026-06-12T10:00:00.000Z",
      "2026-06-12"
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/planning/boards");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/planowanie/tablice");
  });
});
