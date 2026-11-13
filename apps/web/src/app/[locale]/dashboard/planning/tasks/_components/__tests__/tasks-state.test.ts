import { describe, expect, it } from "vitest";
import {
  dueWindow,
  loadTaskState,
  migrateTaskSearchParams,
  taskFilters,
  taskHref,
  taskMatches,
} from "../tasks-state";

const PERSON = "22222222-2222-4222-8222-222222222222";
const BRANCH = "33333333-3333-4333-8333-333333333333";
const TODAY = new Date("2026-11-13T10:00:00.000Z");

const task = (overrides: Record<string, unknown> = {}) => ({
  task_number: "PT-000042",
  title: "Wymiana łożyska",
  status: "open",
  priority: "high",
  assigned_to: PERSON,
  assignee_name: "Anna Nowak",
  assignee_email: "anna@example.com",
  branch_id: null,
  due_at: "2026-11-15T12:00:00.000Z",
  ...overrides,
});

describe("task list state", () => {
  it("reads the address, dropping what it cannot use", () => {
    const state = loadTaskState({
      widok: "tablica",
      status: "open,nope",
      priorytet: "urgent",
      przypisani: `brak,${PERSON},x`,
      oddzial: `organizacja,${BRANCH}`,
      termin: "7d",
    });
    expect(state).toMatchObject({
      widok: "tablica",
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
      due_from: "2026-11-01T00:00:00.000Z",
      due_to: "2026-11-30T23:59:59.999Z",
    });
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

  it("matches the board's tasks the same way", () => {
    expect(taskMatches(task(), loadTaskState({ q: "lozysk" }), TODAY)).toBe(true);
    expect(taskMatches(task(), loadTaskState({ q: "nowak" }), TODAY)).toBe(true);
    expect(taskMatches(task(), loadTaskState({ przypisani: "brak" }), TODAY)).toBe(false);
    expect(
      taskMatches(task({ assigned_to: null }), loadTaskState({ przypisani: "brak" }), TODAY)
    ).toBe(true);
    expect(taskMatches(task(), loadTaskState({ oddzial: "organizacja" }), TODAY)).toBe(true);
    expect(taskMatches(task(), loadTaskState({ oddzial: BRANCH }), TODAY)).toBe(false);
    expect(taskMatches(task(), loadTaskState({ termin: "7d" }), TODAY)).toBe(true);
    expect(taskMatches(task(), loadTaskState({ termin: "po_terminie" }), TODAY)).toBe(false);
    expect(taskMatches(task({ due_at: null }), loadTaskState({ termin: "7d" }), TODAY)).toBe(false);
  });

  it("keeps defaults out of the address", () => {
    const state = loadTaskState({});
    expect(taskHref("/dashboard/planowanie/zadania", state)).toBe("/dashboard/planowanie/zadania");
    expect(taskHref("/x", state, { widok: "tablica", selected: "PT-000042" })).toBe(
      "/x?widok=tablica&selected=PT-000042"
    );
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
});
