/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardsService, resetPlanningViewRpcState } from "../kanban-boards.service";

const ORG = "00000000-0000-0000-0000-000000000001";
const BOARD = "00000000-0000-0000-0000-0000000000b1";
const USER = "00000000-0000-0000-0000-0000000000a1";
const COLUMN = "00000000-0000-0000-0000-0000000000c1";
const TASK = "00000000-0000-0000-0000-0000000000e1";

const person = { first_name: "Ann", last_name: "Lee", email: "ann@example.com" };

const taskRow = {
  id: TASK,
  organization_id: ORG,
  board_id: BOARD,
  column_id: COLUMN,
  task_number: "PT-000001",
  title: "Write the report",
  status: "todo",
  priority: "normal",
  assigned_to: null,
  created_by: USER,
  created_at: "2026-11-20T10:00:00+00:00",
  updated_at: "2026-11-20T10:00:00+00:00",
  deleted_at: null,
  board_position: 0,
  cover_attachment_id: null,
  field_values: [],
  creator: person,
  assignee: null,
  task_labels: [{ label: { id: "l1", name: "Bug", color: "red", position: 0 } }],
  checklist_items: [{ is_done: true }, { is_done: false }],
  watchers: [{ user_id: USER }],
};

const columnRow = {
  id: COLUMN,
  board_id: BOARD,
  organization_id: ORG,
  title: "To do",
  position: 0,
  created_at: "2026-11-20T10:00:00+00:00",
  updated_at: "2026-11-20T10:00:00+00:00",
};

const extrasRow = {
  task_id: TASK,
  comment_count: 3,
  attachment_count: 1,
  has_cover_image: false,
  subtask_total: 2,
  subtask_done: 1,
  blocked_by_open: 0,
};

const boardView = {
  board: {
    id: BOARD,
    organization_id: ORG,
    title: "Sprint",
    visibility: "public",
    created_by: "someone-else",
    created_at: "2026-11-20T10:00:00+00:00",
    updated_at: "2026-11-20T10:00:00+00:00",
    is_template: false,
    creator: person,
    shares: [{ count: 2 }],
  },
  columns: [columnRow],
  cards: [taskRow, { ...taskRow, id: "in-archived-column", column_id: "archived" }],
  members: [
    { user_id: USER, role: "viewer", created_at: "2026-11-20T10:00:00+00:00", user: person },
  ],
  starred: true,
  labels: [{ id: "l1", name: "Bug", color: "red", position: 0 }],
  custom_fields: [
    {
      id: "f1",
      board_id: BOARD,
      name: "Estimate",
      field_type: "number",
      options: null,
      show_on_card: true,
      position: 0,
    },
  ],
  extras: [extrasRow],
};

/** A query builder that answers every chain with `result`. */
function chain(result: unknown) {
  const builder: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return () => builder;
      },
    }
  );
  return builder;
}

function client(rpc: ReturnType<typeof vi.fn>, tables: Record<string, unknown> = {}) {
  const from = vi.fn((table: string) => chain(tables[table] ?? { data: [], error: null }));
  return { rpc, from } as any;
}

const missing = { data: null, error: { code: "PGRST202", message: "not found" } };

describe("KanbanBoardsService view RPCs", () => {
  beforeEach(() => {
    resetPlanningViewRpcState();
  });

  describe("getBoard", () => {
    it("loads the board in one request when planning_board_view exists", async () => {
      const rpc = vi.fn(async () => ({ data: boardView, error: null }));
      const supabase = client(rpc);

      const result = await KanbanBoardsService.getBoard(supabase, ORG, BOARD, USER);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("planning_board_view", { p_org_id: ORG, p_board_id: BOARD });
      expect(supabase.from).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (!result.success) return;
      const board = result.data;
      expect(board.title).toBe("Sprint");
      expect(board.visibility).toBe("organization");
      expect(board.my_access).toBe("viewer");
      expect(board.starred).toBe(true);
      expect(board.shared_with).toBe(2);
      expect(board.creator_email).toBe("ann@example.com");
      expect(board.columns.map((c) => c.id)).toEqual([COLUMN]);
      // The card in an archived column stays out of sight.
      expect(board.cards.map((c) => c.id)).toEqual([TASK]);
      expect(board.cards[0]).toMatchObject({
        comment_count: 3,
        attachment_count: 1,
        subtask_total: 2,
        subtask_done: 1,
        cover_url: null,
      });
      expect(board.members[0]).toMatchObject({ user_id: USER, role: "viewer", name: "Ann Lee" });
      expect(board.labels).toEqual([{ id: "l1", name: "Bug", color: "red", position: 0 }]);
      expect(board.custom_fields[0]).toMatchObject({ id: "f1", options: [] });
    });

    it("reports a board it cannot see as not found", async () => {
      const rpc = vi.fn(async () => ({ data: { ...boardView, board: null }, error: null }));
      const result = await KanbanBoardsService.getBoard(client(rpc), ORG, BOARD, USER);
      expect(result).toEqual({ success: false, error: "Board not found" });
    });

    it("falls back to the separate reads while the function is missing, and stops asking", async () => {
      const rpc = vi.fn(async (name: string) =>
        name === "planning_board_view" ? missing : { data: [extrasRow], error: null }
      );
      const supabase = client(rpc, {
        planning_kanban_boards: { data: boardView.board, error: null },
        planning_kanban_columns: { data: [columnRow], error: null },
        planning_tasks: { data: [taskRow], error: null },
      });

      const first = await KanbanBoardsService.getBoard(supabase, ORG, BOARD, USER);
      expect(first.success).toBe(true);
      if (first.success) expect(first.data.cards[0].comment_count).toBe(3);
      expect(supabase.from).toHaveBeenCalled();

      rpc.mockClear();
      await KanbanBoardsService.getBoard(supabase, ORG, BOARD, USER);
      expect(rpc.mock.calls.map(([name]) => name)).not.toContain("planning_board_view");
    });

    it("falls back on any other RPC error but tries the function again next time", async () => {
      const rpc = vi.fn(async (name: string) =>
        name === "planning_board_view"
          ? { data: null, error: { code: "57014", message: "timeout" } }
          : { data: [], error: null }
      );
      const supabase = client(rpc, {
        planning_kanban_boards: { data: boardView.board, error: null },
      });

      expect((await KanbanBoardsService.getBoard(supabase, ORG, BOARD, USER)).success).toBe(true);
      rpc.mockClear();
      await KanbanBoardsService.getBoard(supabase, ORG, BOARD, USER);
      expect(rpc.mock.calls.map(([name]) => name)).toContain("planning_board_view");
    });
  });

  describe("getTaskEditor", () => {
    const editorView = {
      card: taskRow,
      extras: [extrasRow],
      board: { id: BOARD, title: "Sprint", color: null, archived_at: null, created_by: USER },
      my_role: "viewer",
      columns: [columnRow],
      labels: [{ id: "l1", name: "Bug", color: "red", position: 0 }],
      custom_fields: [],
    };

    it("loads the editor in one request when planning_task_editor exists", async () => {
      const rpc = vi.fn(async () => ({ data: editorView, error: null }));
      const supabase = client(rpc);

      const result = await KanbanBoardsService.getTaskEditor(supabase, ORG, USER, "pt-000001");

      expect(rpc).toHaveBeenCalledWith("planning_task_editor", {
        p_org_id: ORG,
        p_ref: "pt-000001",
      });
      expect(supabase.from).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.card).toMatchObject({ id: TASK, comment_count: 3 });
      // The creator owns the board, whatever their member role.
      expect(result.data.board).toEqual({
        id: BOARD,
        title: "Sprint",
        color: null,
        archived_at: null,
        my_access: "owner",
      });
      expect(result.data.columns.map((c) => c.id)).toEqual([COLUMN]);
      expect(result.data.custom_fields).toEqual([]);
    });

    it("opens a task whose board is out of reach without the board", async () => {
      const rpc = vi.fn(async () => ({ data: { ...editorView, board: null }, error: null }));
      const result = await KanbanBoardsService.getTaskEditor(client(rpc), ORG, USER, TASK);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toMatchObject({ board: null, columns: [], labels: [] });
    });

    it("uses the member role for a board the user did not create", async () => {
      const rpc = vi.fn(async () => ({
        data: { ...editorView, board: { ...editorView.board, created_by: "someone-else" } },
        error: null,
      }));
      const result = await KanbanBoardsService.getTaskEditor(client(rpc), ORG, USER, TASK);
      expect(result.success && result.data.board?.my_access).toBe("viewer");
    });

    it("reports a missing task", async () => {
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const result = await KanbanBoardsService.getTaskEditor(client(rpc), ORG, USER, "PT-404");
      expect(result).toEqual({ success: false, error: "Task not found" });
    });

    it("falls back to the separate reads while the function is missing", async () => {
      const rpc = vi.fn(async (name: string) =>
        name === "planning_task_editor" ? missing : { data: [extrasRow], error: null }
      );
      const supabase = client(rpc, {
        planning_tasks: { data: { ...taskRow, board_id: null }, error: null },
      });
      const result = await KanbanBoardsService.getTaskEditor(supabase, ORG, USER, TASK);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.card.comment_count).toBe(3);
      expect(supabase.from).toHaveBeenCalledWith("planning_tasks");
    });
  });
});
