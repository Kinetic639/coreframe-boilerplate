/**
 * @vitest-environment node
 *
 * PlanningChecklistTemplatesService with a mocked Supabase client.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/kanban-boards.service", () => ({
  KanbanBoardsService: {
    listChecklists: vi.fn(async () => ({
      success: true,
      data: [{ id: "list-1", task_id: "task-1", title: "Odbiór", position: 0, items: [] }],
    })),
    recordCardActivity: vi.fn(async () => undefined),
  },
}));

import { PlanningChecklistTemplatesService } from "../planning-checklist-templates.service";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";

/** A chainable query that resolves to the given result. */
function chain(result: unknown) {
  const query: any = {};
  for (const name of ["select", "eq", "order", "insert", "update", "delete", "single"]) {
    query[name] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => void) => resolve(result);
  return query;
}

describe("PlanningChecklistTemplatesService", () => {
  it("lists templates and drops items that make no sense", async () => {
    const query = chain({
      data: [
        {
          id: "tpl-1",
          title: "Przyjęcie",
          items: [
            { title: "Sprawdź list przewozowy", assigned_to: "u-1", due_offset_days: 2 },
            { title: "  " },
            { title: "Zrób zdjęcia", due_offset_days: -3 },
            "junk",
          ],
          created_by: "u-1",
          updated_at: "2026-11-18T10:00:00Z",
          creator: { first_name: "Anna", last_name: "Nowak", email: "a@x.pl" },
        },
      ],
      error: null,
    });
    const supabase: any = { from: vi.fn(() => query) };

    const result = await PlanningChecklistTemplatesService.list(supabase, "org-1");

    expect(supabase.from).toHaveBeenCalledWith("planning_checklist_templates");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "tpl-1",
          title: "Przyjęcie",
          items: [
            { title: "Sprawdź list przewozowy", assigned_to: "u-1", due_offset_days: 2 },
            { title: "Zrób zdjęcia", assigned_to: null, due_offset_days: null },
          ],
          created_by: "u-1",
          creator_name: "Anna Nowak",
          updated_at: "2026-11-18T10:00:00Z",
        },
      ],
    });
  });

  it("reports someone else's template as not editable", async () => {
    const query = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
    const supabase: any = { from: vi.fn(() => query) };

    const result = await PlanningChecklistTemplatesService.save(supabase, "org-1", "u-2", {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Przyjęcie",
      items: [],
    });

    expect(query.update).toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "TEMPLATE_NOT_EDITABLE" });
  });

  it("adds a template to a task through the database function", async () => {
    const supabase: any = { rpc: vi.fn(async () => ({ data: "list-1", error: null })) };

    const result = await PlanningChecklistTemplatesService.apply(supabase, "org-1", "u-1", {
      task_id: "task-1",
      template_id: "tpl-1",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("planning_apply_checklist_template", {
      p_task_id: "task-1",
      p_template_id: "tpl-1",
    });
    expect(result).toMatchObject({ success: true, data: { id: "list-1", title: "Odbiór" } });
    expect(KanbanBoardsService.recordCardActivity).toHaveBeenCalledWith(
      supabase,
      "org-1",
      null,
      "task-1",
      "u-1",
      "checklist_added",
      { title: "Odbiór" }
    );
  });
});
