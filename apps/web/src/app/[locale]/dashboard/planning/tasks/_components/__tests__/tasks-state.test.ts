import { describe, expect, it } from "vitest";
import {
  dueWindow,
  loadTaskState,
  migrateTaskSearchParams,
  taskFilters,
  taskHref,
} from "../tasks-state";

const PERSON = "22222222-2222-4222-8222-222222222222";
const BRANCH = "33333333-3333-4333-8333-333333333333";
const TODAY = new Date("2026-11-13T10:00:00.000Z");

describe("task list state", () => {
  it("reads the address, dropping what it cannot use", () => {
    const state = loadTaskState({
      status: "open,nope",
      priorytet: "urgent",
      przypisani: `brak,${PERSON},x`,
      oddzial: `organizacja,${BRANCH}`,
      termin: "7d",
    });
    expect(state).toMatchObject({
      status: ["open"],
      priorytet: ["urgent"],
      przypisani: ["brak", PERSON],
      oddzial: ["organizacja", BRANCH],
      termin: "7d",
    });
  });

  it("turns the filters into the service's", () => {
    const state = loadTaskState({
      przypisani: `brak,${PERSON}`,
      oddzial: BRANCH,
      termin_od: "2026-11-01",
      termin_do: "2026-11-30",
    });
    expect(taskFilters(state, TODAY)).toEqual({
      status: undefined,
      priority: undefined,
      assignees: [PERSON],
      unassigned: true,
      branch_ids: [BRANCH],
      org_wide: undefined,
      board_ids: [],
      no_board: undefined,
      due_from: "2026-11-01T00:00:00.000Z",
      due_to: "2026-11-30T23:59:59.999Z",
    });
  });

  it("reads the board filter (boards and tasks on no board)", () => {
    const BOARD = "44444444-4444-4444-8444-444444444444";
    const state = loadTaskState({ tablica: `bez,${BOARD},x` });
    expect(state.tablica).toEqual(["bez", BOARD]);
    expect(taskFilters(state, TODAY)).toMatchObject({ board_ids: [BOARD], no_board: true });
  });

  it("reads the visibility filter (one choice filters, both or none do not)", () => {
    expect(taskFilters(loadTaskState({ widocznosc: "prywatne" }), TODAY).visibility).toBe(
      "private"
    );
    expect(taskFilters(loadTaskState({ widocznosc: "wspolne,x" }), TODAY).visibility).toBe(
      "shared"
    );
    expect(
      taskFilters(loadTaskState({ widocznosc: "prywatne,wspolne" }), TODAY).visibility
    ).toBeUndefined();
    expect(taskFilters(loadTaskState({}), TODAY).visibility).toBeUndefined();
  });

  it("reads the ready due ranges as whole days", () => {
    expect(dueWindow(loadTaskState({ termin: "po_terminie" }), TODAY)).toEqual({
      from: null,
      to: "2026-11-12",
    });
    expect(dueWindow(loadTaskState({ termin: "dzis" }), TODAY)).toEqual({
      from: "2026-11-13",
      to: "2026-11-13",
    });
    expect(dueWindow(loadTaskState({ termin: "7d" }), TODAY)).toEqual({
      from: "2026-11-13",
      to: "2026-11-20",
    });
  });

  it("keeps defaults out of the address", () => {
    const state = loadTaskState({});
    expect(taskHref("/dashboard/planowanie/zadania", state)).toBe("/dashboard/planowanie/zadania");
    expect(taskHref("/x", state, { selected: "PT-000042" })).toBe("/x?selected=PT-000042");
  });

  it("translates old DataView and QR links", () => {
    expect(
      migrateTaskSearchParams({
        search: "pompa",
        page: "2",
        sort: "due_at.asc",
        filters: JSON.stringify({ status: ["open"], assigned_to: null, branch_id: BRANCH }),
        highlight: "PT-000042",
      })
    ).toEqual({
      params: {
        q: "pompa",
        strona: "2",
        sort: "due_at",
        direction: "asc",
        status: "open",
        przypisani: "brak",
        oddzial: BRANCH,
        selected: "PT-000042",
      },
      changed: true,
    });
  });

  it("drops the old view parameter (the status board is the boards page now)", () => {
    expect(migrateTaskSearchParams({ widok: "lista", q: "pompa" })).toEqual({
      params: { q: "pompa" },
      changed: true,
    });
  });
});
