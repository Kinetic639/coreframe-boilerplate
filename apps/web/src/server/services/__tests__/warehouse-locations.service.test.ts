/**
 * @vitest-environment node
 *
 * Unit tests for WarehouseLocationsService and buildLocationTree.
 *
 * All Supabase interactions are mocked — no real DB connections.
 * Tests cover:
 *  - buildLocationTree pure function (nesting, orphan promotion, sort)
 *  - listByBranch (success, DB error)
 *  - getById (found, not found, DB error)
 *  - getChildren (success, DB error)
 *  - create (success, parent branch mismatch, 23505 duplicate code, parent not found)
 *  - update (success, self-parent guard, new parent branch mismatch, 23505, not found)
 *  - softDelete (success, DB error)
 */

import { describe, it, expect, vi } from "vitest";
import { WarehouseLocationsService, buildLocationTree } from "../warehouse-locations.service";
import type { WarehouseLocation } from "../warehouse-locations.service";

// ─── Test data ────────────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const BRANCH_ID = "branch-222";
const USER_ID = "user-333";

function makeLocation(overrides: Partial<WarehouseLocation> = {}): WarehouseLocation {
  return {
    id: "loc-001",
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    name: "Test Location",
    code: null,
    description: null,
    icon_name: null,
    color: null,
    parent_id: null,
    level: 0,
    sort_order: 0,
    qr_code: "qr-abc",
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

// ─── Supabase mock builder ─────────────────────────────────────────────────────

/**
 * Each entry in `results` is consumed by one `.from()` call.
 * Supports chained .select/.eq/.is/.order/.maybeSingle/.single
 */
function makeSupabaseMock(results: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "insert", "update", "neq"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Terminal methods
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    chain.single = vi.fn().mockResolvedValue(result);
    // Thennable (for queries without terminal method)
    chain.then = (
      onfulfilled: ((v: unknown) => unknown) | null | undefined,
      onrejected: ((r: unknown) => unknown) | null | undefined
    ) => Promise.resolve(result).then(onfulfilled, onrejected);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation(() => {
      const result = results[callIndex] ?? { data: null, error: null };
      callIndex++;
      return makeChain(result);
    }),
  };
}

// ─── buildLocationTree ────────────────────────────────────────────────────────

describe("buildLocationTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildLocationTree([])).toEqual([]);
  });

  it("builds a two-level tree correctly", () => {
    const parent = makeLocation({ id: "p1", name: "Aisle A", level: 0, sort_order: 0 });
    const child = makeLocation({
      id: "c1",
      name: "Shelf 1",
      parent_id: "p1",
      level: 1,
      sort_order: 0,
    });
    const tree = buildLocationTree([parent, child]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("p1");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("c1");
  });

  it("promotes orphaned nodes to root", () => {
    const orphan = makeLocation({ id: "orphan", parent_id: "nonexistent", level: 1 });
    const tree = buildLocationTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("sorts siblings by sort_order then name", () => {
    const a = makeLocation({ id: "a", name: "Zebra", sort_order: 1 });
    const b = makeLocation({ id: "b", name: "Apple", sort_order: 0 });
    const c = makeLocation({ id: "c", name: "Mango", sort_order: 0 });
    const tree = buildLocationTree([a, b, c]);
    expect(tree.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("attaches empty children array to leaf nodes", () => {
    const loc = makeLocation();
    const tree = buildLocationTree([loc]);
    expect(tree[0].children).toEqual([]);
  });
});

// ─── listByBranch ─────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.listByBranch", () => {
  it("returns success with data on valid query", async () => {
    const locs = [makeLocation()];
    const supabase = makeSupabaseMock([{ data: locs, error: null }]);
    const result = await WarehouseLocationsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(locs);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "connection refused" } }]);
    const result = await WarehouseLocationsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("connection refused");
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.getById", () => {
  it("returns the location when found", async () => {
    const loc = makeLocation();
    const supabase = makeSupabaseMock([{ data: loc, error: null }]);
    const result = await WarehouseLocationsService.getById(supabase as never, ORG_ID, loc.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(loc);
  });

  it("returns success with null data when not found", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);
    const result = await WarehouseLocationsService.getById(supabase as never, ORG_ID, "bad-id");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "timeout" } }]);
    const result = await WarehouseLocationsService.getById(supabase as never, ORG_ID, "x");
    expect(result.success).toBe(false);
  });
});

// ─── getChildren ──────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.getChildren", () => {
  it("returns children list on success", async () => {
    const children = [
      makeLocation({ id: "c1", parent_id: "p1" }),
      makeLocation({ id: "c2", parent_id: "p1" }),
    ];
    const supabase = makeSupabaseMock([{ data: children, error: null }]);
    const result = await WarehouseLocationsService.getChildren(supabase as never, ORG_ID, "p1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(2);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "fail" } }]);
    const result = await WarehouseLocationsService.getChildren(supabase as never, ORG_ID, "p1");
    expect(result.success).toBe(false);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.create", () => {
  it("creates a root location (no parent) and returns it", async () => {
    const newLoc = makeLocation({ id: "new-1", level: 0 });
    const supabase = makeSupabaseMock([{ data: newLoc, error: null }]);
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "New Root" },
      USER_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.level).toBe(0);
  });

  it("computes level from parent (+1)", async () => {
    const parent = makeLocation({ id: "parent-1", level: 2 });
    const newLoc = makeLocation({ id: "child-1", parent_id: "parent-1", level: 3 });
    // First call: getById for parent; second call: insert
    const supabase = makeSupabaseMock([
      { data: parent, error: null },
      { data: newLoc, error: null },
    ]);
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Child", parent_id: "parent-1" },
      USER_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.level).toBe(3);
  });

  it("rejects if parent belongs to different branch", async () => {
    const parent = makeLocation({ id: "parent-x", branch_id: "other-branch" });
    const supabase = makeSupabaseMock([{ data: parent, error: null }]);
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Child", parent_id: "parent-x" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/different branch/i);
  });

  it("returns friendly error on 23505 (duplicate code)", async () => {
    const supabase = makeSupabaseMock([
      { data: null, error: { message: "unique constraint", code: "23505" } },
    ]);
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Dup", code: "A01" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/already exists/i);
  });

  it("returns failure when parent not found", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Orphan", parent_id: "missing-id" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/not found/i);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.update", () => {
  it("updates a location successfully", async () => {
    const current = makeLocation({ id: "loc-1" });
    const updated = makeLocation({ id: "loc-1", name: "Updated" });
    const supabase = makeSupabaseMock([
      { data: current, error: null }, // getById current
      { data: updated, error: null }, // update query
    ]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "loc-1",
      { name: "Updated" },
      USER_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Updated");
  });

  it("rejects self-parent assignment", async () => {
    const current = makeLocation({ id: "loc-self" });
    const supabase = makeSupabaseMock([{ data: current, error: null }]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "loc-self",
      { parent_id: "loc-self" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/own parent/i);
  });

  it("rejects when new parent belongs to different branch", async () => {
    const current = makeLocation({ id: "loc-1" });
    const newParent = makeLocation({ id: "p-other", branch_id: "other-branch" });
    const supabase = makeSupabaseMock([
      { data: current, error: null },
      { data: newParent, error: null },
    ]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "loc-1",
      { parent_id: "p-other" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/different branch/i);
  });

  it("returns failure on location not found", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "missing",
      { name: "X" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/not found/i);
  });

  it("returns friendly error on 23505 (duplicate code)", async () => {
    const current = makeLocation({ id: "loc-1" });
    const supabase = makeSupabaseMock([
      { data: current, error: null },
      { data: null, error: { message: "unique", code: "23505" } },
    ]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "loc-1",
      { code: "TAKEN" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/already exists/i);
  });
});

// ─── softDelete ───────────────────────────────────────────────────────────────

describe("WarehouseLocationsService.softDelete", () => {
  it("returns success on successful deletion", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(true);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "RLS denied" } }]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("RLS denied");
  });
});
