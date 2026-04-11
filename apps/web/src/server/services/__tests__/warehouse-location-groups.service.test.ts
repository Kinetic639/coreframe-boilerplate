/**
 * @vitest-environment node
 *
 * Unit tests for WarehouseLocationGroupsService.
 *
 * Focuses on the production-hardening paths:
 *  - parent location scope validation
 *  - atomic reorder RPC usage
 *  - atomic soft-delete RPC usage
 */

import { describe, it, expect, vi } from "vitest";
import { WarehouseLocationGroupsService } from "../warehouse-location-groups.service";

const ORG_ID = "org-111";
const BRANCH_ID = "branch-222";
const USER_ID = "user-333";

function makeGroup(
  overrides: Partial<{
    id: string;
    organization_id: string;
    branch_id: string;
    parent_location_id: string | null;
    name: string;
    description: string | null;
    color: string | null;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }> = {}
) {
  return {
    id: "group-001",
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    parent_location_id: null,
    name: "Rack bays",
    description: null,
    color: null,
    sort_order: 0,
    created_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeLocationScope(
  overrides: Partial<{
    id: string;
    organization_id: string;
    branch_id: string;
    deleted_at: string | null;
  }> = {}
) {
  return {
    id: "loc-001",
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    deleted_at: null,
    ...overrides,
  };
}

function makeSupabaseMock(
  fromResults: Array<{ data: unknown; error: unknown }>,
  rpcResults: Array<{ data: unknown; error: unknown }> = []
) {
  let fromIndex = 0;
  let rpcIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "insert", "update", "limit"]) {
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
      const result = fromResults[fromIndex] ?? { data: null, error: null };
      fromIndex++;
      return makeChain(result);
    }),
    rpc: vi.fn().mockImplementation(() => {
      const result = rpcResults[rpcIndex] ?? { data: null, error: null };
      rpcIndex++;
      return Promise.resolve(result);
    }),
  };
}

describe("WarehouseLocationGroupsService.create", () => {
  it("rejects when parent location belongs to a different branch", async () => {
    const parent = makeLocationScope({ id: "parent-1", branch_id: "other-branch" });
    const supabase = makeSupabaseMock([{ data: parent, error: null }]);
    const result = await WarehouseLocationGroupsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Grouped", parent_location_id: "parent-1" },
      USER_ID
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/different branch/i);
  });

  it("creates a group successfully when parent location is in scope", async () => {
    const parent = makeLocationScope({ id: "parent-1" });
    const created = makeGroup({ id: "group-new", parent_location_id: "parent-1" });
    const supabase = makeSupabaseMock([
      { data: parent, error: null },
      { data: null, error: null },
      { data: created, error: null },
    ]);
    const result = await WarehouseLocationGroupsService.create(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      { name: "Grouped", parent_location_id: "parent-1" },
      USER_ID
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parent_location_id).toBe("parent-1");
  });
});

describe("WarehouseLocationGroupsService.update", () => {
  it("rejects when updated parent location belongs to a different branch", async () => {
    const current = makeGroup({ id: "group-1", parent_location_id: "parent-1" });
    const parent = makeLocationScope({ id: "new-parent", branch_id: "other-branch" });
    const supabase = makeSupabaseMock([
      { data: current, error: null },
      { data: parent, error: null },
    ]);
    const result = await WarehouseLocationGroupsService.update(
      supabase as never,
      ORG_ID,
      "group-1",
      { parent_location_id: "new-parent" }
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/different branch/i);
  });
});

describe("WarehouseLocationGroupsService.reorderBatch", () => {
  it("delegates reorder to the atomic RPC", async () => {
    const supabase = makeSupabaseMock([], [{ data: null, error: null }]);
    const items = [
      { id: "group-1", sort_order: 0 },
      { id: "group-2", sort_order: 1 },
    ];
    const result = await WarehouseLocationGroupsService.reorderBatch(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      items
    );
    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("reorder_warehouse_location_groups", {
      p_org_id: ORG_ID,
      p_branch_id: BRANCH_ID,
      p_items: items,
    });
  });
});

describe("WarehouseLocationGroupsService.softDelete", () => {
  it("delegates delete to the atomic RPC", async () => {
    const supabase = makeSupabaseMock([], [{ data: null, error: null }]);
    const result = await WarehouseLocationGroupsService.softDelete(
      supabase as never,
      ORG_ID,
      "group-1"
    );
    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("soft_delete_warehouse_location_group", {
      p_org_id: ORG_ID,
      p_group_id: "group-1",
    });
  });
});
