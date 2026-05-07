/**
 * @vitest-environment node
 *
 * Unit tests for WarehouseLayoutSplitNodesService.
 *
 * All Supabase interactions are mocked — no real DB connections.
 * Tests cover:
 *  - removeSplitNode: does not archive/delete linked location
 *  - linkLocation: validates org/branch scope; does not modify inventory/location status
 *  - unlinkLocation: does not delete/archive the location
 *  - resizeSplit: rejects invalid size_value for fixed/ratio modes
 *  - createSplit: validates layout and parent_visual_node org/branch membership
 */

import { describe, it, expect, vi } from "vitest";
import { WarehouseLayoutSplitNodesService } from "../warehouse-layout-split-nodes.service";
import type { LayoutSplitNode } from "@/lib/types/warehouse/locations-v2";

// ─── Test constants ───────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const BRANCH_ID = "branch-222";
const USER_ID = "user-333";
const LAYOUT_ID = "layout-aaa";
const SPLIT_NODE_ID = "split-bbb";
const LOCATION_ID = "loc-ccc";

function makeSplitNode(overrides: Partial<LayoutSplitNode> = {}): LayoutSplitNode {
  return {
    id: SPLIT_NODE_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    layout_id: LAYOUT_ID,
    view_context_location_id: null,
    parent_visual_node_id: null,
    parent_node_id: null,
    node_kind: "cell",
    split_direction: null,
    size_mode: "equal",
    size_value: null,
    sort_order: 0,
    linked_location_id: LOCATION_ID,
    calc_x_mm: null,
    calc_y_mm: null,
    calc_z_mm: null,
    calc_width_mm: null,
    calc_height_mm: null,
    calc_depth_mm: null,
    cache_valid: false,
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

// ─── Mock builder ─────────────────────────────────────────────────────────────

function makeSupabaseMock(
  fromResults: Array<{ data: unknown; error: unknown }>,
  rpcResults: Array<{ data: unknown; error: unknown }> = []
) {
  let fromIndex = 0;
  let rpcIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "neq", "order", "insert", "update", "in", "limit"]) {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WarehouseLayoutSplitNodesService", () => {
  describe("removeSplitNode", () => {
    it("soft-deletes split node without touching warehouse_locations", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLayoutSplitNodesService.removeSplitNode(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(true);
      // Confirm only split nodes table was touched
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      expect(fromCalls.every(([table]: [string]) => table === "warehouse_layout_split_nodes")).toBe(
        true
      );
    });

    it("returns failure on DB error", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: { message: "db error" } }]);
      const result = await WarehouseLayoutSplitNodesService.removeSplitNode(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID
      );
      expect(result.success).toBe(false);
    });
  });

  describe("linkLocation", () => {
    it("rejects when linked location does not belong to split node's org/branch", async () => {
      // Split node fetch → found with branch_id
      // Location check → not found (foreign branch)
      const supabase = makeSupabaseMock([
        { data: { id: SPLIT_NODE_ID, organization_id: ORG_ID, branch_id: BRANCH_ID }, error: null },
        { data: null, error: null }, // location not found in this branch
      ]);
      const result = await WarehouseLayoutSplitNodesService.linkLocation(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        "foreign-location",
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain("Location not found");
    });

    it("links location without touching inventory", async () => {
      const node = makeSplitNode({ linked_location_id: LOCATION_ID });
      const supabase = makeSupabaseMock([
        { data: { id: SPLIT_NODE_ID, organization_id: ORG_ID, branch_id: BRANCH_ID }, error: null },
        { data: { id: LOCATION_ID }, error: null }, // location check
        { data: node, error: null }, // update
      ]);
      const result = await WarehouseLayoutSplitNodesService.linkLocation(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        LOCATION_ID,
        USER_ID
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.linked_location_id).toBe(LOCATION_ID);
      // Verify inventory tables were never touched
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
        ([table]: [string]) => table
      );
      expect(fromCalls).not.toContain("inventory_balances");
      expect(fromCalls).not.toContain("product_location_stock");
    });
  });

  describe("unlinkLocation", () => {
    it("clears linked_location_id without deleting or archiving the location", async () => {
      const unlinked = makeSplitNode({ linked_location_id: null });
      const supabase = makeSupabaseMock([{ data: unlinked, error: null }]);
      const result = await WarehouseLayoutSplitNodesService.unlinkLocation(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.linked_location_id).toBeNull();
      // Verify warehouse_locations never touched
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      expect(fromCalls.every(([table]: [string]) => table === "warehouse_layout_split_nodes")).toBe(
        true
      );
    });
  });

  describe("resizeSplit", () => {
    it("rejects fixed mode with null size_value", async () => {
      const supabase = makeSupabaseMock([]);
      const result = await WarehouseLayoutSplitNodesService.resizeSplit(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        "fixed",
        null,
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain(
          "size_value must be a positive number"
        );
    });

    it("rejects ratio mode with zero size_value", async () => {
      const supabase = makeSupabaseMock([]);
      const result = await WarehouseLayoutSplitNodesService.resizeSplit(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        "ratio",
        0,
        USER_ID
      );
      expect(result.success).toBe(false);
    });

    it("accepts equal mode with null size_value", async () => {
      const node = makeSplitNode({ size_mode: "equal", size_value: null });
      // update + parent cache invalidation (no parent_node_id so no extra call)
      const supabase = makeSupabaseMock([{ data: node, error: null }]);
      const result = await WarehouseLayoutSplitNodesService.resizeSplit(
        supabase as never,
        ORG_ID,
        SPLIT_NODE_ID,
        "equal",
        null,
        USER_ID
      );
      expect(result.success).toBe(true);
    });
  });

  describe("createSplit", () => {
    it("rejects when layout does not belong to org/branch", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: null }]); // layout check fails
      const result = await WarehouseLayoutSplitNodesService.createSplit(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        "foreign-layout",
        { layout_id: "foreign-layout", node_kind: "cell" },
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain("Layout not found");
    });

    it("creates split node successfully", async () => {
      const node = makeSplitNode();
      const supabase = makeSupabaseMock([
        { data: { id: LAYOUT_ID, branch_id: BRANCH_ID }, error: null }, // layout check
        { data: node, error: null }, // insert
      ]);
      const result = await WarehouseLayoutSplitNodesService.createSplit(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        LAYOUT_ID,
        { layout_id: LAYOUT_ID, node_kind: "cell" },
        USER_ID
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(SPLIT_NODE_ID);
    });
  });
});
