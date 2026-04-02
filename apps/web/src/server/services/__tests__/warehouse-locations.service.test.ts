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
 *  - update (success, self-parent guard, cycle guard, new parent branch mismatch,
 *            23505, not found, level cascade after reparent)
 *  - softDelete (success, DB error, children reparented to root, grandchild levels cascaded)
 *
 * RLS simulation tests (T-RLS):
 *  - SELECT blocked by RLS (42501) → listByBranch returns failure
 *  - INSERT blocked by RLS (42501) → create returns failure
 *  - UPDATE blocked by RLS (42501) → softDelete returns failure
 *  - Empty result (RLS filter, not error) → getById returns null
 *
 * Branch-isolation invariants (T-BRANCH):
 *  - create: rejects parent from different branch
 *  - update: rejects reparent to parent in different branch
 *  - update: cycle prevention blocks reparenting into descendant
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

// ─── Supabase mock builders ───────────────────────────────────────────────────

/**
 * Each entry in `results` is consumed by one `.from()` call.
 * Supports chained .select/.eq/.is/.order/.maybeSingle/.single and UPDATE/INSERT.
 */
function makeSupabaseMock(results: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "insert", "update", "neq"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    chain.single = vi.fn().mockResolvedValue(result);
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

/**
 * RLS-denied client: all queries resolve with a 42501 permission error.
 * Simulates Postgres RLS blocking access at the DB layer.
 */
function makeRlsDeniedClient(tableName = "warehouse_locations") {
  const rlsError = {
    code: "42501",
    message: `permission denied for table ${tableName}`,
  };
  const errResult = { data: null, error: rlsError };

  function makeChain(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    for (const m of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "neq",
      "is",
      "in",
      "filter",
      "order",
    ]) {
      q[m] = vi.fn().mockImplementation(() => makeChain());
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(errResult);
    q["single"] = vi.fn().mockResolvedValue(errResult);
    q["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(errResult).then(onFulfilled);
    return q;
  }

  return { from: vi.fn().mockImplementation(() => makeChain()) };
}

/**
 * RLS-empty client: all queries return empty data (no rows), no error.
 * Simulates RLS filtering out all rows the caller cannot see.
 */
function makeRlsEmptyClient() {
  const emptyResult = { data: [], error: null };
  const emptyNullResult = { data: null, error: null };

  function makeChain(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "neq", "is", "in", "order"]) {
      q[m] = vi.fn().mockImplementation(() => makeChain());
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(emptyNullResult);
    q["single"] = vi.fn().mockResolvedValue(emptyNullResult);
    q["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(emptyResult).then(onFulfilled);
    return q;
  }

  return { from: vi.fn().mockImplementation(() => makeChain()) };
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

  it("rejects cyclical reparenting (node is ancestor of new parent)", async () => {
    // Tree: A (root) → B → C
    // Attempt: reparent A to C (A's descendant) → would create A → C → ... → A
    //
    // Service calls during update("A", { parent_id: "C" }):
    //   1. getById("A") → current node A (level=0)
    //   2. wouldCreateCycle: currentId="C" !== "A" → getById("C") → C.parent_id="B"
    //   3. wouldCreateCycle: currentId="B" !== "A" → getById("B") → B.parent_id="A"
    //   4. wouldCreateCycle: currentId="A" === "A" → cycle=true (no DB call for this step)
    const nodeA = makeLocation({ id: "A", parent_id: null, level: 0 });
    const nodeC = makeLocation({ id: "C", parent_id: "B", level: 2 });
    const nodeB = makeLocation({ id: "B", parent_id: "A", level: 1 });

    const supabase = makeSupabaseMock([
      { data: nodeA, error: null }, // getById current ("A")
      { data: nodeC, error: null }, // wouldCreateCycle: getById("C")
      { data: nodeB, error: null }, // wouldCreateCycle: getById("B")
      // "A" is detected as cycle at next iteration — no further DB call needed
    ]);

    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "A",
      { parent_id: "C" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/descendants/i);
  });

  it("allows reparenting to a sibling (no cycle)", async () => {
    // Tree: root → A, root → B (siblings)
    // Reparent A to B: no cycle because B is not a descendant of A
    //
    // Service calls:
    //   1. getById("A") → current A (parent=null, level=0)
    //   2. wouldCreateCycle: currentId="B" !== "A" → getById("B") → B.parent_id=null
    //   3. wouldCreateCycle: currentId=null → loop ends, no cycle
    //   4. getById("B") for new parent → B (level=0, same branch)
    //   5. update query → returns updated A
    //   6. cascadeDescendantLevels for A: getChildren("A") → [] (no children)
    const nodeA = makeLocation({ id: "A", parent_id: null, level: 0 });
    const nodeB = makeLocation({ id: "B", parent_id: null, level: 0 });
    const updatedA = makeLocation({ id: "A", parent_id: "B", level: 1 });

    const supabase = makeSupabaseMock([
      { data: nodeA, error: null }, // getById current ("A")
      { data: nodeB, error: null }, // wouldCreateCycle: getById("B") → B.parent_id=null → loop ends
      { data: nodeB, error: null }, // getById new parent "B"
      { data: updatedA, error: null }, // update query
      { data: [], error: null }, // cascadeDescendantLevels: getChildren("A")
    ]);

    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "A",
      { parent_id: "B" },
      USER_ID
    );
    expect(result.success).toBe(true);
  });

  it("cascades level to direct children after reparent", async () => {
    // Tree: A (level=2) has child C (level=3).
    // Reparent A to root (parent_id=null) → A becomes level=0 → C should become level=1.
    //
    // Service calls:
    //   1. getById("A") → current A (level=2, parent_id="X")
    //   2. (parent_id=null, no cycle check needed)
    //   3. update query → returns A at level=0
    //   4. cascadeDescendantLevels("A", 0): getChildren("A") → [C]
    //   5. cascadeDescendantLevels: update C to level=1
    //   6. cascadeDescendantLevels("C", 1): getChildren("C") → [] (leaf)
    const nodeA = makeLocation({ id: "A", parent_id: "X", level: 2 });
    const nodeC = makeLocation({ id: "C", parent_id: "A", level: 3 });
    const updatedA = makeLocation({ id: "A", parent_id: null, level: 0 });

    const supabase = makeSupabaseMock([
      { data: nodeA, error: null }, // getById current ("A")
      { data: updatedA, error: null }, // update A to level=0
      { data: [nodeC], error: null }, // cascadeDescendantLevels: getChildren("A")
      { data: null, error: null }, // cascade: update C to level=1
      { data: [], error: null }, // cascade: getChildren("C") → no grandchildren
    ]);

    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "A",
      { parent_id: null },
      USER_ID
    );
    expect(result.success).toBe(true);
    // Verify the cascade UPDATE was called for child C
    expect(supabase.from).toHaveBeenCalledTimes(5);
  });

  it("rejects when new parent belongs to different branch", async () => {
    const current = makeLocation({ id: "loc-1" });
    const newParent = makeLocation({ id: "p-other", branch_id: "other-branch" });
    const supabase = makeSupabaseMock([
      { data: current, error: null },
      { data: newParent, error: null }, // wouldCreateCycle: getById("p-other") → parent_id=null → no cycle
      { data: newParent, error: null }, // getById new parent
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
  it("returns success on successful deletion (no children)", async () => {
    const supabase = makeSupabaseMock([
      { data: [], error: null }, // getChildren → no children
      { data: null, error: null }, // soft-delete UPDATE
    ]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("explicitly reparents direct children to root before soft-deleting", async () => {
    // Tree: parent P (being deleted) → child C (no grandchildren)
    //
    // Expected DB calls:
    //   1. getChildren(P) → [C]
    //   2. batch UPDATE children: parent_id=null, level=0
    //   3. cascadeDescendantLevels(C, 0): getChildren(C) → [] (leaf)
    //   4. soft-delete UPDATE on P
    const child = makeLocation({ id: "C", parent_id: "P", level: 1 });
    const supabase = makeSupabaseMock([
      { data: [child], error: null }, // getChildren("P")
      { data: null, error: null }, // batch reparent
      { data: [], error: null }, // cascadeDescendantLevels: getChildren("C") → []
      { data: null, error: null }, // soft-delete P
    ]);

    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "P");
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(4);
  });

  it("cascades grandchild levels after reparenting direct children", async () => {
    // Tree: P → C → G
    // Delete P: C gets parent_id=null, level=0; G must be updated to level=1.
    //
    // Expected DB calls:
    //   1. getChildren("P") → [C]
    //   2. batch reparent: UPDATE parent_id=null, level=0 for C
    //   3. cascadeDescendantLevels("C", 0): getChildren("C") → [G]
    //   4. cascade: UPDATE G level=1
    //   5. cascadeDescendantLevels("G", 1): getChildren("G") → [] (leaf)
    //   6. soft-delete P
    const child = makeLocation({ id: "C", parent_id: "P", level: 1 });
    const grandchild = makeLocation({ id: "G", parent_id: "C", level: 2 });
    const supabase = makeSupabaseMock([
      { data: [child], error: null }, // getChildren("P")
      { data: null, error: null }, // batch reparent C
      { data: [grandchild], error: null }, // cascadeDescendantLevels: getChildren("C")
      { data: null, error: null }, // cascade: update G to level=1
      { data: [], error: null }, // cascadeDescendantLevels: getChildren("G") → leaf
      { data: null, error: null }, // soft-delete P
    ]);

    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "P");
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(6);
  });

  it("returns failure on DB error during soft-delete", async () => {
    const supabase = makeSupabaseMock([
      { data: [], error: null }, // getChildren → no children
      { data: null, error: { message: "RLS denied" } }, // soft-delete UPDATE fails
    ]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("RLS denied");
  });

  it("returns failure if getChildren DB error occurs before soft-delete", async () => {
    const supabase = makeSupabaseMock([
      { data: null, error: { message: "getChildren failed" } }, // getChildren fails
    ]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("getChildren failed");
  });

  it("returns failure if reparent UPDATE is blocked by RLS (42501)", async () => {
    const child = makeLocation({ id: "C", parent_id: "P", level: 1 });
    const supabase = makeSupabaseMock([
      { data: [child], error: null }, // getChildren → has children
      {
        data: null,
        error: { code: "42501", message: "permission denied for table warehouse_locations" },
      },
    ]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "P");
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/permission denied/i);
  });
});

// ─── T-RLS: RLS simulation tests ─────────────────────────────────────────────

describe("T-RLS: RLS simulation — listByBranch", () => {
  it("propagates 42501 error as service failure (SELECT blocked)", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await WarehouseLocationsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/permission denied/i);
  });

  it("returns empty array when RLS filters out all rows (no error, no data)", async () => {
    const supabase = makeRlsEmptyClient();
    const result = await WarehouseLocationsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });
});

describe("T-RLS: RLS simulation — create (INSERT blocked)", () => {
  it("propagates 42501 error when INSERT is denied by RLS", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await WarehouseLocationsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Zone A" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/permission denied/i);
  });
});

describe("T-RLS: RLS simulation — softDelete (UPDATE blocked)", () => {
  it("propagates 42501 error when UPDATE is denied by RLS for soft-delete", async () => {
    // getChildren returns empty (no children to reparent), then soft-delete UPDATE is denied
    const supabase = makeSupabaseMock([
      { data: [], error: null }, // getChildren succeeds
      {
        data: null,
        error: { code: "42501", message: "permission denied for table warehouse_locations" },
      }, // soft-delete UPDATE blocked
    ]);
    const result = await WarehouseLocationsService.softDelete(supabase as never, ORG_ID, "loc-1");
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/permission denied/i);
  });
});

describe("T-RLS: RLS simulation — getById (SELECT filtered)", () => {
  it("returns null data when RLS filters the row (no error)", async () => {
    const supabase = makeRlsEmptyClient();
    const result = await WarehouseLocationsService.getById(
      supabase as never,
      ORG_ID,
      "loc-in-other-branch"
    );
    // RLS returns 0 rows → maybeSingle → null (not an error)
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });
});

// ─── T-BRANCH: Branch-isolation invariants ───────────────────────────────────

describe("T-BRANCH: Branch isolation invariants", () => {
  it("create: parent in different branch is rejected", async () => {
    const crossBranchParent = makeLocation({ id: "parent-x", branch_id: "other-branch-999" });
    const supabase = makeSupabaseMock([{ data: crossBranchParent, error: null }]);
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

  it("update: reparenting to a node in a different branch is rejected", async () => {
    const current = makeLocation({ id: "loc-1", branch_id: BRANCH_ID });
    const crossBranchParent = makeLocation({
      id: "parent-other",
      branch_id: "completely-different-branch",
      parent_id: null,
    });
    const supabase = makeSupabaseMock([
      { data: current, error: null }, // getById current loc-1
      { data: crossBranchParent, error: null }, // wouldCreateCycle: getById("parent-other") → parent_id=null → no cycle
      { data: crossBranchParent, error: null }, // getById new parent → different branch
    ]);
    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "loc-1",
      { parent_id: "parent-other" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/different branch/i);
  });

  it("update: cycle detection stops reparenting A into its own subtree (deep chain)", async () => {
    // Chain: A → B → C → D (all same branch). Attempt reparent A to D.
    // wouldCreateCycle("A", "D"):
    //   iter1: currentId="D" !== "A" → getById("D") → D.parent_id="C"
    //   iter2: currentId="C" !== "A" → getById("C") → C.parent_id="B"
    //   iter3: currentId="B" !== "A" → getById("B") → B.parent_id="A"
    //   iter4: currentId="A" === "A" → cycle=true
    const nodeA = makeLocation({ id: "A", parent_id: null, level: 0 });
    const nodeD = makeLocation({ id: "D", parent_id: "C", level: 3 });
    const nodeC = makeLocation({ id: "C", parent_id: "B", level: 2 });
    const nodeB = makeLocation({ id: "B", parent_id: "A", level: 1 });

    const supabase = makeSupabaseMock([
      { data: nodeA, error: null }, // getById current ("A")
      { data: nodeD, error: null }, // wouldCreateCycle: getById("D")
      { data: nodeC, error: null }, // wouldCreateCycle: getById("C")
      { data: nodeB, error: null }, // wouldCreateCycle: getById("B")
    ]);

    const result = await WarehouseLocationsService.update(
      supabase as never,
      ORG_ID,
      "A",
      { parent_id: "D" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/descendants/i);
  });
});
