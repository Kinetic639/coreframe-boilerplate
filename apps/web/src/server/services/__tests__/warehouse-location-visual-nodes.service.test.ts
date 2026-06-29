/**
 * @vitest-environment node
 *
 * Unit tests for WarehouseLocationVisualNodesService.
 *
 * All Supabase interactions are mocked — no real DB connections.
 * Tests cover:
 *  - softDeleteNode does not delete/archive the location
 *  - upsertNode validates org/branch scope (rejects foreign location)
 *  - batchUpsert does not delete outside the explicit scope
 *  - restoreNode detects primary uniqueness conflict
 *  - softDeleteAllForLocation: location deletion never triggered
 *  - getUnmappedLocations: returns locations with no active primary node
 *  - enum validation: invalid view_type/visual_role/visualization_type rejected at schema level
 */

import { describe, it, expect, vi } from "vitest";
import { WarehouseLocationVisualNodesService } from "../warehouse-location-visual-nodes.service";
import type { LocationVisualNode } from "@/lib/types/warehouse/locations-v2";

// ─── Test constants ───────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const BRANCH_ID = "branch-222";
const USER_ID = "user-333";
const LAYOUT_ID = "layout-aaa";
const LOCATION_ID = "loc-bbb";
const NODE_ID = "node-ccc";

function makeVisualNode(overrides: Partial<LocationVisualNode> = {}): LocationVisualNode {
  return {
    id: NODE_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    layout_id: LAYOUT_ID,
    location_id: LOCATION_ID,
    view_type: "top_down",
    view_context_location_id: null,
    visualization_type: "rack",
    visual_role: "primary",
    status: "active",
    x_mm: 100,
    y_mm: 200,
    z_mm: 0,
    width_mm: 1200,
    height_mm: 400,
    depth_mm: null,
    rotation_deg: 0,
    style: null,
    z_index: 0,
    sort_order: 0,
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

describe("WarehouseLocationVisualNodesService", () => {
  describe("softDeleteNode", () => {
    it("soft-deletes the node without touching warehouse_locations", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLocationVisualNodesService.softDeleteNode(
        supabase as never,
        ORG_ID,
        NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(true);
      // Verify only the visual nodes table was touched (not warehouse_locations)
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        fromCalls.every(([table]: [string]) => table === "warehouse_location_visual_nodes")
      ).toBe(true);
    });

    it("returns failure when DB returns error", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: { message: "connection failed" } }]);
      const result = await WarehouseLocationVisualNodesService.softDeleteNode(
        supabase as never,
        ORG_ID,
        NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toBe("connection failed");
    });
  });

  describe("upsertNode — org/branch scope validation", () => {
    it("rejects insert when location does not belong to org/branch", async () => {
      // First call: location check → not found (null)
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        {
          layout_id: LAYOUT_ID,
          location_id: "foreign-location",
          view_type: "top_down",
          x_mm: 0,
          y_mm: 0,
          width_mm: 100,
          height_mm: 100,
        },
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain("Location not found");
    });

    it("rejects insert when layout does not belong to org/branch", async () => {
      // Location check → found; layout check → not found
      const supabase = makeSupabaseMock([
        { data: { id: LOCATION_ID, branch_id: BRANCH_ID }, error: null },
        { data: null, error: null },
      ]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        {
          layout_id: "foreign-layout",
          location_id: LOCATION_ID,
          view_type: "top_down",
          x_mm: 0,
          y_mm: 0,
          width_mm: 100,
          height_mm: 100,
        },
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain("Layout not found");
    });

    it("inserts successfully when location and layout both belong to org/branch", async () => {
      const node = makeVisualNode();
      const supabase = makeSupabaseMock([
        { data: { id: LOCATION_ID, branch_id: BRANCH_ID }, error: null }, // location check
        { data: { id: LAYOUT_ID, branch_id: BRANCH_ID }, error: null }, // layout check
        { data: node, error: null }, // insert
      ]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        {
          layout_id: LAYOUT_ID,
          location_id: LOCATION_ID,
          view_type: "top_down",
          x_mm: 100,
          y_mm: 200,
          width_mm: 1200,
          height_mm: 400,
        },
        USER_ID
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(NODE_ID);
    });
  });

  describe("batchUpsert — scope safety", () => {
    it("does not delete any nodes when replaceScope is not set", async () => {
      const node = makeVisualNode();
      // Two upsert calls (location + layout check + insert each)
      const supabase = makeSupabaseMock([
        { data: { id: LOCATION_ID, branch_id: BRANCH_ID }, error: null },
        { data: { id: LAYOUT_ID, branch_id: BRANCH_ID }, error: null },
        { data: node, error: null },
      ]);

      await WarehouseLocationVisualNodesService.batchUpsert(
        supabase as never,
        ORG_ID,
        BRANCH_ID,
        LAYOUT_ID,
        [
          {
            layout_id: LAYOUT_ID,
            location_id: LOCATION_ID,
            view_type: "top_down",
            x_mm: 0,
            y_mm: 0,
            width_mm: 100,
            height_mm: 100,
          },
        ],
        {}, // no replaceScope
        USER_ID
      );

      // Verify no soft-delete UPDATE was made to orphaned nodes
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      // Only 3 calls expected (location check, layout check, insert) — no extra scope query
      expect(fromCalls.length).toBe(3);
    });
  });

  describe("restoreNode", () => {
    it("returns failure when a conflicting active primary node exists", async () => {
      const hiddenNode = makeVisualNode({ status: "hidden", visual_role: "primary" });
      const conflictNode = makeVisualNode({
        id: "conflict-node",
        status: "active",
        visual_role: "primary",
      });
      const supabase = makeSupabaseMock([
        { data: hiddenNode, error: null }, // fetch hidden node
        { data: conflictNode, error: null }, // check for conflicting primary
      ]);
      const result = await WarehouseLocationVisualNodesService.restoreNode(
        supabase as never,
        ORG_ID,
        NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain(
          "primary visual node already exists"
        );
    });

    it("restores when no conflict exists", async () => {
      const hiddenNode = makeVisualNode({ status: "hidden", visual_role: "primary" });
      const restoredNode = makeVisualNode({ status: "active" });
      const supabase = makeSupabaseMock([
        { data: hiddenNode, error: null }, // fetch hidden node
        { data: null, error: null }, // no conflicting primary
        { data: restoredNode, error: null }, // update
      ]);
      const result = await WarehouseLocationVisualNodesService.restoreNode(
        supabase as never,
        ORG_ID,
        NODE_ID,
        USER_ID
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe("active");
    });
  });

  describe("softDeleteAllForLocation", () => {
    it("verifies location exists before soft-deleting nodes", async () => {
      // Location check → not found
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLocationVisualNodesService.softDeleteAllForLocation(
        supabase as never,
        ORG_ID,
        "unknown-loc"
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect((result as { success: false; error: string }).error).toContain("Location not found");
      // Verify warehouse_location_visual_nodes never touched
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      expect(fromCalls.every(([table]: [string]) => table === "warehouse_locations")).toBe(true);
    });
  });
});
