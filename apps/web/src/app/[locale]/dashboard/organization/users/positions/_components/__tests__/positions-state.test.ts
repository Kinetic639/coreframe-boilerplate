import { describe, expect, it } from "vitest";
import type { OrgPosition } from "@/server/services/organization.service";
import { loadPositionState, migratePositionSearchParams, positionPage } from "../positions-state";

const position = (n: number, name: string, description: string | null = null) =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name,
    description,
    created_at: `2026-11-0${n}T10:00:00Z`,
  }) as OrgPosition;

const rows = [
  position(1, "Serwisant"),
  position(2, "Magazynier", "Wydaje części"),
  position(3, "Ćwiczący"),
];

describe("position list address", () => {
  it("sorts by name in Polish order and searches the description", () => {
    expect(positionPage(rows, loadPositionState({})).rows.map((p) => p.name)).toEqual([
      "Ćwiczący",
      "Magazynier",
      "Serwisant",
    ]);
    expect(positionPage(rows, loadPositionState({ q: "czesci" })).rows.map((p) => p.name)).toEqual([
      "Magazynier",
    ]);
  });

  it("translates old DataView links", () => {
    const { params, changed } = migratePositionSearchParams({ search: "x", page: "2" });
    expect(changed).toBe(true);
    expect(params).toMatchObject({ q: "x", strona: "2" });
  });
});
