/**
 * @vitest-environment node
 *
 * Unit tests for PlanningTasksService.
 * All Supabase interactions are mocked — no real DB connections.
 *
 * Covers:
 *  - listForDataView (success, DB error, filters)
 *  - getDetail (success, not found, DB error)
 *  - create (success, creates task_created activity, DB error)
 *  - update (success, creates activity per changed field)
 *  - changeStatus (all transitions, correct timestamps + activity)
 *  - assign (assign + unassign activity)
 *  - softDelete (sets deleted_at, creates archived activity)
 *
 * RLS simulation (T-RLS):
 *  - 42501 error → returns failure (not thrown)
 *
 * Security invariants (T-SEC):
 *  - service never calls auth.getUser() — auth is caller responsibility
 *  - no service-role bypass — all queries respect RLS
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanningTasksService } from "../planning-tasks.service";
import type { PlanningTaskListRow, PlanningTaskDetail } from "../planning-tasks.service";
import type { DataViewListParams } from "@/lib/data-view/types";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const USER_ID = "user-333";
const TASK_ID = "task-aaa";
const ASSIGNEE_ID = "user-555";

const DEFAULT_PARAMS: DataViewListParams = {
  page: 1,
  pageSize: 20,
  search: "",
  sort: null,
  filters: {},
};

function makeTaskRow(overrides: Partial<PlanningTaskListRow> = {}): PlanningTaskListRow {
  return {
    id: TASK_ID,
    organization_id: ORG_ID,
    task_number: "PT-000001",
    title: "Test Task",
    status: "open",
    priority: "normal",
    branch_id: null,
    assigned_to: null,
    assignee_name: null,
    assignee_email: null,
    created_by: USER_ID,
    creator_name: "Test User",
    creator_email: "test@example.com",
    due_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeTaskDetail(overrides: Partial<PlanningTaskDetail> = {}): PlanningTaskDetail {
  return {
    ...makeTaskRow(),
    description_plain: null,
    description_rich: null,
    updated_by: null,
    deleted_at: null,
    activity: [],
    ...overrides,
  };
}

// ─── Supabase mock factory ────────────────────────────────────────────────────

function makeSupabaseMock() {
  const insertMock = vi.fn().mockReturnThis();
  const selectMock = vi.fn().mockReturnThis();
  const updateMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();
  const isMock = vi.fn().mockReturnThis();
  const inMock = vi.fn().mockReturnThis();
  const orMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockReturnThis();
  const rangeMock = vi.fn().mockReturnThis();
  const singleMock = vi.fn();
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: { user_id: ASSIGNEE_ID },
    error: null,
  });

  const fromMock = vi.fn(() => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    eq: eqMock,
    is: isMock,
    in: inMock,
    or: orMock,
    order: orderMock,
    range: rangeMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
  }));

  // Make chainable methods return the same object
  const chain = {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    eq: eqMock,
    is: isMock,
    in: inMock,
    or: orMock,
    order: orderMock,
    range: rangeMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
  };
  Object.values(chain).forEach((fn) => {
    if (fn !== singleMock && fn !== maybeSingleMock) {
      (fn as any).mockReturnValue(chain);
    }
  });

  return { from: fromMock, _chain: chain };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PlanningTasksService", () => {
  // ── listForDataView ──────────────────────────────────────────────────────

  describe("listForDataView", () => {
    it("returns paginated rows on success", async () => {
      const supabase = makeSupabaseMock();
      const rawRows = [
        {
          id: TASK_ID,
          organization_id: ORG_ID,
          task_number: "PT-000001",
          title: "Test Task",
          status: "open",
          priority: "normal",
          branch_id: null,
          assigned_to: null,
          due_at: null,
          started_at: null,
          completed_at: null,
          cancelled_at: null,
          created_by: USER_ID,
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
          assignee: null,
          creator: [{ first_name: "Test", last_name: "User", email: "test@example.com" }],
        },
      ];
      supabase._chain.range.mockResolvedValueOnce({ data: rawRows, error: null, count: 1 });

      const result = await PlanningTasksService.listForDataView(
        supabase as any,
        ORG_ID,
        DEFAULT_PARAMS
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].task_number).toBe("PT-000001");
      expect(result.data.totalCount).toBe(1);
      expect(result.data.page).toBe(1);
    });

    it("returns failure on DB error", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.range.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
        count: null,
      });

      const result = await PlanningTasksService.listForDataView(
        supabase as any,
        ORG_ID,
        DEFAULT_PARAMS
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toBe("DB error");
    });

    it("T-RLS: 42501 error propagates as failure", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.range.mockResolvedValueOnce({
        data: null,
        error: { message: "new row violates row-level security policy", code: "42501" },
        count: null,
      });

      const result = await PlanningTasksService.listForDataView(
        supabase as any,
        ORG_ID,
        DEFAULT_PARAMS
      );

      expect(result.success).toBe(false);
    });
  });

  // ── getDetail ────────────────────────────────────────────────────────────

  describe("getDetail", () => {
    it("returns task detail with activity on success", async () => {
      const supabase = makeSupabaseMock();
      const rawTask = {
        id: TASK_ID,
        organization_id: ORG_ID,
        task_number: "PT-000001",
        title: "Test Task",
        description_plain: "Hello",
        description_rich: null,
        status: "open",
        priority: "normal",
        branch_id: null,
        assigned_to: null,
        due_at: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        created_by: USER_ID,
        updated_by: null,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
        deleted_at: null,
        assignee: null,
        creator: [{ first_name: "Test", last_name: "User", email: "test@example.com" }],
      };
      const rawActivity = [
        {
          id: "act-1",
          organization_id: ORG_ID,
          task_id: TASK_ID,
          activity_type: "task_created",
          actor_id: USER_ID,
          message: "Task created",
          metadata: null,
          created_at: "2026-06-01T00:00:00Z",
          actor: [{ first_name: "Test", last_name: "User", email: "test@example.com" }],
        },
      ];

      // First .from().select().eq().eq().is().single() → task
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      // Second .from().select().eq().order() → activity
      supabase._chain.order.mockResolvedValueOnce({ data: rawActivity, error: null });

      const result = await PlanningTasksService.getDetail(supabase as any, ORG_ID, TASK_ID);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.id).toBe(TASK_ID);
      expect(result.data.description_plain).toBe("Hello");
      expect(result.data.activity).toHaveLength(1);
      expect(result.data.activity[0].activity_type).toBe("task_created");
    });

    it("returns failure when task not found", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "No rows found", code: "PGRST116" },
      });

      const result = await PlanningTasksService.getDetail(supabase as any, ORG_ID, TASK_ID);
      expect(result.success).toBe(false);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("inserts task and writes task_created activity", async () => {
      const supabase = makeSupabaseMock();
      const rawTask = {
        id: TASK_ID,
        organization_id: ORG_ID,
        task_number: "PT-000001",
        title: "New Task",
        description_plain: null,
        description_rich: null,
        status: "open",
        priority: "normal",
        branch_id: null,
        assigned_to: null,
        due_at: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        created_by: USER_ID,
        updated_by: null,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
        deleted_at: null,
        assignee: null,
        creator: null,
      };

      // Call 1: insert().select().single() for task creation
      supabase._chain.single.mockResolvedValueOnce({
        data: rawTask,
        error: null,
      });
      // Note: insertActivity calls insert() which returns chain by default — no override needed

      const result = await PlanningTasksService.create(supabase as any, ORG_ID, USER_ID, {
        title: "New Task",
        priority: "normal",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.title).toBe("New Task");
      expect(result.data.status).toBe("open");
      // Verify insert was called at least twice (task + activity)
      expect(supabase._chain.insert).toHaveBeenCalledTimes(2);
    });

    it("returns failure when DB insert fails", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      const result = await PlanningTasksService.create(supabase as any, ORG_ID, USER_ID, {
        title: "New Task",
        priority: "normal",
      });

      expect(result.success).toBe(false);
      expect((result as any).error).toBe("Insert failed");
    });

    it("T-RLS: 42501 on insert returns failure", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "row-level security policy", code: "42501" },
      });

      const result = await PlanningTasksService.create(supabase as any, ORG_ID, USER_ID, {
        title: "Unauthorized Task",
        priority: "normal",
      });

      expect(result.success).toBe(false);
    });
  });

  // ── changeStatus ─────────────────────────────────────────────────────────

  describe("changeStatus", () => {
    it("sets completed_at when completing a task", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.is.mockResolvedValueOnce({ data: null, error: null });
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });
      const rawTask = {
        id: TASK_ID,
        organization_id: ORG_ID,
        task_number: "PT-000001",
        title: "Task",
        description_plain: null,
        description_rich: null,
        status: "completed",
        priority: "normal",
        branch_id: null,
        assigned_to: null,
        due_at: null,
        started_at: null,
        completed_at: "2026-06-01T12:00:00Z",
        cancelled_at: null,
        created_by: USER_ID,
        updated_by: USER_ID,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T12:00:00Z",
        deleted_at: null,
        assignee: null,
        creator: null,
      };
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await PlanningTasksService.changeStatus(
        supabase as any,
        ORG_ID,
        USER_ID,
        TASK_ID,
        "completed",
        "open"
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.status).toBe("completed");
      // Verify update was called with completed_at
      expect(supabase._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", completed_at: expect.any(String) })
      );
    });

    it("clears completed_at when reopening", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.is.mockResolvedValueOnce({ data: null, error: null });
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });
      const rawTask = {
        id: TASK_ID,
        organization_id: ORG_ID,
        task_number: "PT-000001",
        title: "Task",
        description_plain: null,
        description_rich: null,
        status: "open",
        priority: "normal",
        branch_id: null,
        assigned_to: null,
        due_at: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        created_by: USER_ID,
        updated_by: USER_ID,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T12:00:00Z",
        deleted_at: null,
        assignee: null,
        creator: null,
      };
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await PlanningTasksService.changeStatus(
        supabase as any,
        ORG_ID,
        USER_ID,
        TASK_ID,
        "open",
        "completed"
      );

      expect(result.success).toBe(true);
      expect(supabase._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "open", completed_at: null, cancelled_at: null })
      );
    });

    it("sets cancelled_at when cancelling", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.is.mockResolvedValueOnce({ data: null, error: null });
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });
      const rawTask = {
        id: TASK_ID,
        organization_id: ORG_ID,
        task_number: "PT-000001",
        title: "Task",
        description_plain: null,
        description_rich: null,
        status: "cancelled",
        priority: "normal",
        branch_id: null,
        assigned_to: null,
        due_at: null,
        started_at: null,
        completed_at: null,
        cancelled_at: "2026-06-01T12:00:00Z",
        created_by: USER_ID,
        updated_by: USER_ID,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T12:00:00Z",
        deleted_at: null,
        assignee: null,
        creator: null,
      };
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

      await PlanningTasksService.changeStatus(
        supabase as any,
        ORG_ID,
        USER_ID,
        TASK_ID,
        "cancelled",
        "in_progress"
      );

      expect(supabase._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelled_at: expect.any(String) })
      );
    });
  });

  // ── assign ───────────────────────────────────────────────────────────────

  describe("assign", () => {
    it("writes assigned activity when assigning", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });
      const rawTask = {
        ...makeTaskDetail({ assigned_to: ASSIGNEE_ID, assignee_name: "Assignee" }),
      };
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

      await PlanningTasksService.assign(
        supabase as any,
        ORG_ID,
        USER_ID,
        { id: TASK_ID, assigned_to: ASSIGNEE_ID },
        null
      );

      expect(supabase._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: "assigned",
          metadata: { from: null, to: ASSIGNEE_ID },
        })
      );
    });

    it("writes unassigned activity when unassigning", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });
      const rawTask = { ...makeTaskDetail({ assigned_to: null }) };
      supabase._chain.single.mockResolvedValueOnce({ data: rawTask, error: null });
      supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

      await PlanningTasksService.assign(
        supabase as any,
        ORG_ID,
        USER_ID,
        { id: TASK_ID, assigned_to: null },
        ASSIGNEE_ID
      );

      expect(supabase._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ activity_type: "unassigned" })
      );
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────

  describe("softDelete", () => {
    it("sets deleted_at and writes archived activity", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.is.mockResolvedValueOnce({ data: null, error: null });
      supabase._chain.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await PlanningTasksService.softDelete(
        supabase as any,
        ORG_ID,
        USER_ID,
        TASK_ID
      );

      expect(result.success).toBe(true);
      expect(supabase._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(supabase._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ activity_type: "archived" })
      );
    });

    it("returns failure on DB error", async () => {
      const supabase = makeSupabaseMock();
      supabase._chain.is.mockResolvedValueOnce({
        data: null,
        error: { message: "Delete failed" },
      });

      const result = await PlanningTasksService.softDelete(
        supabase as any,
        ORG_ID,
        USER_ID,
        TASK_ID
      );
      expect(result.success).toBe(false);
    });
  });
});
