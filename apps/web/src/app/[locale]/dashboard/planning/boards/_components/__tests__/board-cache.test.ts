import { describe, expect, it } from "vitest";
import type { KanbanBoardCard, KanbanBoardColumn, KanbanBoardDetail } from "@/lib/types/kanban";
import {
  columnCards,
  findCardPlace,
  moveCard,
  removeColumn,
  reorderColumns,
  upsertCard,
  type BoardCacheState,
} from "../board-cache";

function column(id: string, position: number, extra: Partial<KanbanBoardColumn> = {}) {
  return {
    id,
    board_id: "board-1",
    title: id,
    description: null,
    color: null,
    position,
    status_category: null,
    archived_at: null,
    ...extra,
  } as KanbanBoardColumn;
}

function card(
  id: string,
  columnId: string,
  position: number,
  extra: Partial<KanbanBoardCard> = {}
) {
  return {
    id,
    board_id: columnId ? "board-1" : "",
    column_id: columnId,
    is_inbox: !columnId,
    title: id,
    position,
    status: "open",
    task_number: `TSK-${id}`,
    created_at: `2026-11-16T10:00:0${position}.000Z`,
    archived_at: null,
    ...extra,
  } as KanbanBoardCard;
}

function state(): BoardCacheState {
  const board = {
    id: "board-1",
    columns: [column("todo", 0), column("doing", 1, { status_category: "in_progress" })],
    cards: [card("a", "todo", 0), card("b", "todo", 1), card("c", "doing", 0)],
  } as KanbanBoardDetail;
  return { board, inbox: [card("i1", "", 0), card("i2", "", 1)] };
}

const ids = (cards: KanbanBoardCard[]) => cards.map((item) => item.id);

describe("board cache", () => {
  it("finds a card on the board and in the inbox", () => {
    expect(findCardPlace(state(), "b")).toEqual({ columnId: "todo", index: 1 });
    expect(findCardPlace(state(), "i2")).toEqual({ columnId: null, index: 1 });
    expect(findCardPlace(state(), "missing")).toBeNull();
  });

  it("reorders within a column and renumbers positions", () => {
    const next = moveCard(state(), "b", { columnId: "todo", index: 0 });
    const todo = columnCards(next.board!, "todo");
    expect(ids(todo)).toEqual(["b", "a"]);
    expect(todo.map((item) => item.position)).toEqual([0, 1]);
  });

  it("gives a card the status of a status column it moves into", () => {
    const next = moveCard(state(), "a", { columnId: "doing", index: 1 });
    expect(ids(columnCards(next.board!, "doing"))).toEqual(["c", "a"]);
    expect(next.board!.cards.find((item) => item.id === "a")!.status).toBe("in_progress");
    expect(ids(columnCards(next.board!, "todo"))).toEqual(["b"]);
  });

  it("keeps the status when the column has none", () => {
    const start = state();
    start.board!.cards[2] = { ...start.board!.cards[2], status: "completed" };
    const next = moveCard(start, "c", { columnId: "todo", index: 0 });
    expect(next.board!.cards.find((item) => item.id === "c")!.status).toBe("completed");
  });

  it("moves a card from the board to the inbox and back", () => {
    const toInbox = moveCard(state(), "a", { columnId: null, index: 0 });
    expect(ids(toInbox.inbox!)).toEqual(["a", "i1", "i2"]);
    expect(toInbox.inbox![0].is_inbox).toBe(true);
    expect(toInbox.board!.cards.some((item) => item.id === "a")).toBe(false);

    const back = moveCard(toInbox, "a", { columnId: "todo", index: 1 });
    expect(ids(back.inbox!)).toEqual(["i1", "i2"]);
    expect(ids(columnCards(back.board!, "todo"))).toEqual(["b", "a"]);
    expect(back.board!.cards.find((item) => item.id === "a")!.is_inbox).toBe(false);
  });

  it("undoes a move by moving the card back to where it was", () => {
    const start = state();
    const from = findCardPlace(start, "a")!;
    const moved = moveCard(start, "a", { columnId: "doing", index: 0 });
    const undone = moveCard(moved, "a", from);
    expect(ids(columnCards(undone.board!, "todo"))).toEqual(["a", "b"]);
    expect(ids(columnCards(undone.board!, "doing"))).toEqual(["c"]);
  });

  it("clamps an index past the end", () => {
    const next = moveCard(state(), "a", { columnId: "doing", index: 99 });
    expect(ids(columnCards(next.board!, "doing"))).toEqual(["c", "a"]);
  });

  it("ignores a move to an unknown column", () => {
    const start = state();
    expect(moveCard(start, "a", { columnId: "nope", index: 0 })).toBe(start);
  });

  it("upserts a saved card into its place and drops archived ones", () => {
    const renamed = upsertCard(state(), { ...card("a", "todo", 0), title: "Renamed" });
    expect(renamed.board!.cards.find((item) => item.id === "a")!.title).toBe("Renamed");

    const archived = upsertCard(state(), card("a", "todo", 0, { archived_at: "2026-11-16" }));
    expect(archived.board!.cards.some((item) => item.id === "a")).toBe(false);

    const added = upsertCard(state(), card("n", "", 0));
    expect(ids(added.inbox!)).toEqual(["n", "i1", "i2"]);
  });

  it("removes a column with its cards and reorders columns", () => {
    const board = state().board!;
    const without = removeColumn(board, "todo");
    expect(without.columns.map((item) => item.id)).toEqual(["doing"]);
    expect(ids(without.cards)).toEqual(["c"]);

    const reordered = reorderColumns(board, ["doing", "todo"]);
    expect(reordered.columns.map((item) => item.id)).toEqual(["doing", "todo"]);
  });
});
