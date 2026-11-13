import { describe, expect, it } from "vitest";
import type { OrgBranch } from "@/server/services/organization.service";
import { branchPage, loadBranchState, migrateBranchSearchParams } from "../branches-state";

const branch = (n: number, patch: Partial<OrgBranch> = {}) =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    branch_number: n,
    name: `Oddział ${n}`,
    slug: null,
    public_warehouse_maps_enabled: false,
    created_at: "2026-11-01T10:00:00Z",
    ...patch,
  }) as OrgBranch;

const rows = [
  branch(1, { name: "Poznań Komorniki", slug: "komorniki" }),
  branch(2, {
    name: "Łódź",
    public_warehouse_maps_enabled: true,
    created_at: "2026-11-12T08:00:00Z",
  }),
  branch(3, { name: "Gdańsk" }),
];
const today = new Date("2026-11-13T12:00:00Z");

describe("branch list address", () => {
  it("sorts by number by default and finds a name without accents", () => {
    expect(branchPage(rows, loadBranchState({}), today).rows.map((b) => b.branch_number)).toEqual([
      1, 2, 3,
    ]);
    expect(branchPage(rows, loadBranchState({ q: "lodz" }), today).rows.map((b) => b.name)).toEqual(
      ["Łódź"]
    );
    expect(
      branchPage(rows, loadBranchState({ sort: "name", direction: "desc" }), today).rows.map(
        (b) => b.branch_number
      )
      // Polish order: Gdańsk, Łódź, Poznań; reversed.
    ).toEqual([1, 2, 3]);
  });

  it("filters by public maps and by the created window", () => {
    expect(branchPage(rows, loadBranchState({ mapy: "tak" }), today).totalCount).toBe(1);
    expect(branchPage(rows, loadBranchState({ mapy: "tak,nie" }), today).totalCount).toBe(3);
    expect(
      branchPage(rows, loadBranchState({ utworzono: "7d" }), today).rows.map((b) => b.id)
    ).toEqual([rows[1].id]);
  });

  it("clamps a page past the end", () => {
    expect(branchPage(rows, loadBranchState({ strona: "9", wierszy: "20" }), today).page).toBe(1);
  });

  it("translates old DataView links", () => {
    const { params, changed } = migrateBranchSearchParams({
      search: "a",
      sort: "name.desc",
      filters: JSON.stringify({ publicMapsEnabled: true, createdFrom: "2026-01-01" }),
    });
    expect(changed).toBe(true);
    expect(loadBranchState(params)).toMatchObject({
      q: "a",
      sort: "name",
      direction: "desc",
      mapy: ["tak"],
      utworzono_od: "2026-01-01",
    });
  });
});
