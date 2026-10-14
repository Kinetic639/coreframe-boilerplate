import { describe, expect, it } from "vitest";
import { relationRoute, type RelationItem } from "../types";

const item = (overrides: Partial<RelationItem>): RelationItem => ({
  source: "ticket",
  relation: "mention",
  id: "x1",
  code: null,
  title: null,
  created_at: "2026-10-12T10:00:00Z",
  ...overrides,
});

describe("relationRoute", () => {
  it("tickets and tasks open their own page", () => {
    expect(relationRoute(item({ source: "ticket", id: "t1" }))).toEqual({
      pathname: "/dashboard/help-desk/tickets/t1",
    });
    expect(relationRoute(item({ source: "task", id: "p1" }))).toEqual({
      pathname: "/dashboard/planning/tasks/p1",
    });
  });

  it("a comment opens the object it is on", () => {
    expect(
      relationRoute(item({ source: "comment", target_type: "planning.task", target_id: "p9" }))
    ).toEqual({ pathname: "/dashboard/planning/tasks/p9" });
    expect(
      relationRoute(
        item({ source: "comment", target_type: "workshop.repair_order", target_id: "r1" })
      )
    ).toEqual({ pathname: "/dashboard/workshop/r1" });
    // A target without a page (a kanban card): no link
    expect(
      relationRoute(item({ source: "comment", target_type: "planning.card", target_id: "c1" }))
    ).toBeNull();
  });

  it("a chat message opens its conversation", () => {
    expect(relationRoute(item({ source: "chat", conversation_id: "c1" }))).toEqual({
      pathname: "/dashboard/messages",
      query: { c: "c1" },
    });
    expect(relationRoute(item({ source: "chat" }))).toBeNull();
  });
});
