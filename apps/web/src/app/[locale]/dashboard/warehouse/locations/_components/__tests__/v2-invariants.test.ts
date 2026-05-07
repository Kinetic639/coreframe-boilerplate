/**
 * @vitest-environment node
 *
 * V2 architectural invariant tests for the top-down plan editor.
 *
 * These tests verify behaviour at the service layer (no React rendering):
 *  - removing a visual node does not archive or delete the location
 *  - placing an unmapped location creates a visual node, not a new location
 *  - moving/resizing an object updates the visual node only
 *  - mapping badge state reflects visual node presence
 */

import { describe, it, expect, vi } from "vitest";
import { WarehouseLocationVisualNodesService } from "@/server/services/warehouse-location-visual-nodes.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import type { LocationVisualNode } from "@/lib/types/warehouse/locations-v2";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG = "org-001";
const BRANCH = "br-002";
const LAYOUT = "lay-003";
const LOC = "loc-004";
const NODE = "node-005";

function makeNode(overrides: Partial<LocationVisualNode> = {}): LocationVisualNode {
  const base = {
    id: NODE,
    organization_id: ORG,
    branch_id: BRANCH,
    layout_id: LAYOUT,
    location_id: LOC,
    view_type: "top_down" as const,
    view_context_location_id: null,
    visualization_type: "rack" as const,
    visual_role: "primary" as const,
    status: "active" as const,
    x_mm: 500,
    y_mm: 500,
    width_mm: 1200,
    height_mm: 600,
    depth_mm: null,
    rotation_deg: 0,
    style: null,
    z_index: 0,
    sort_order: 0,
    created_by: "user-1",
    updated_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  };
  return { ...base, ...overrides } as LocationVisualNode;
}

function makeSupabaseMock(fromResults: Array<{ data: unknown; error: unknown }>) {
  let idx = 0;
  const chain = (result: { data: unknown; error: unknown }) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "neq", "order", "update", "insert"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    c.maybeSingle = vi.fn().mockResolvedValue(result);
    c.single = vi.fn().mockResolvedValue(result);
    c.then = (f: unknown, r: unknown) => Promise.resolve(result).then(f as never, r as never);
    return c;
  };
  return {
    from: vi.fn().mockImplementation(() => {
      const res = fromResults[idx] ?? { data: null, error: null };
      idx++;
      return chain(res);
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("V2 top-down plan editor — architectural invariants", () => {
  describe("Remove visual node", () => {
    it("soft-deletes the visual node without touching warehouse_locations", async () => {
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLocationVisualNodesService.softDeleteNode(
        supabase as never,
        ORG,
        NODE
      );
      expect(result.success).toBe(true);
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      expect(fromCalls.every(([t]: [string]) => t === "warehouse_location_visual_nodes")).toBe(
        true
      );
    });

    it("does not call archiveLocation or softDelete on the location", async () => {
      const archiveSpy = vi.spyOn(WarehouseLocationsService, "archiveLocation");
      const deleteSpy = vi.spyOn(WarehouseLocationsService, "softDelete");

      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      await WarehouseLocationVisualNodesService.softDeleteNode(supabase as never, ORG, NODE);

      expect(archiveSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();

      archiveSpy.mockRestore();
      deleteSpy.mockRestore();
    });
  });

  describe("Place unmapped location on map", () => {
    it("upsertNode validates location belongs to org/branch before inserting", async () => {
      // Location check → not found (foreign org)
      const supabase = makeSupabaseMock([{ data: null, error: null }]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG,
        BRANCH,
        {
          layout_id: LAYOUT,
          location_id: "foreign-loc",
          view_type: "top_down",
          x_mm: 1000,
          y_mm: 1000,
          width_mm: 1200,
          height_mm: 600,
        }
      );
      expect(result.success).toBe(false);
    });

    it("upsertNode succeeds when location and layout are valid", async () => {
      const node = makeNode();
      const supabase = makeSupabaseMock([
        { data: { id: LOC, branch_id: BRANCH }, error: null }, // location check
        { data: { id: LAYOUT, branch_id: BRANCH }, error: null }, // layout check
        { data: node, error: null }, // insert
      ]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG,
        BRANCH,
        {
          layout_id: LAYOUT,
          location_id: LOC,
          view_type: "top_down",
          x_mm: 1000,
          y_mm: 1000,
          width_mm: 1200,
          height_mm: 600,
        }
      );
      expect(result.success).toBe(true);
      // Verify no new location was created
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
        ([t]: [string]) => t
      );
      expect(fromCalls).not.toContain("warehouse_layout_shapes"); // V2 must not write shapes
    });
  });

  describe("Move / resize object", () => {
    it("updating x/y/w/h upserts visual node — does not touch warehouse_locations dimensions", async () => {
      const node = makeNode({ x_mm: 2000, y_mm: 3000, width_mm: 1500 });
      const supabase = makeSupabaseMock([
        { data: { id: LOC, branch_id: BRANCH }, error: null },
        { data: { id: LAYOUT, branch_id: BRANCH }, error: null },
        { data: node, error: null },
      ]);
      const result = await WarehouseLocationVisualNodesService.upsertNode(
        supabase as never,
        ORG,
        BRANCH,
        {
          id: NODE,
          layout_id: LAYOUT,
          location_id: LOC,
          view_type: "top_down",
          x_mm: 2000,
          y_mm: 3000,
          width_mm: 1500,
          height_mm: 600,
        }
      );
      expect(result.success).toBe(true);
      // Confirm warehouse_locations was never updated
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
        ([t]: [string]) => t
      );
      const locationsUpdates = fromCalls.filter((t) => t === "warehouse_locations");
      // Only the location ownership check should touch warehouse_locations (read, not write)
      expect(locationsUpdates.length).toBe(1);
    });
  });

  describe("Mapping status", () => {
    it("getMappingStatus returns 'unmapped' when no visual node exists for location", async () => {
      // location check → found; RPC → unmapped
      const supabase = makeSupabaseMock([
        { data: { id: LOC, organization_id: ORG }, error: null }, // org check
      ]);
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          location_id: LOC,
          mapping_status: "unmapped",
          is_mapped: false,
          visual_node_count: 0,
          active_child_count: 0,
          mapped_child_count: 0,
          unmapped_child_count: 0,
          has_top_down: false,
          has_front_or_interior: false,
        },
        error: null,
      });

      const result = await WarehouseLocationsService.getMappingStatus(supabase as never, ORG, LOC);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mapping_status).toBe("unmapped");
        expect(result.data.is_mapped).toBe(false);
      }
    });

    it("getMappingStatus returns 'mapped' when top-down visual node exists", async () => {
      const supabase = makeSupabaseMock([{ data: { id: LOC, organization_id: ORG }, error: null }]);
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          location_id: LOC,
          mapping_status: "mapped",
          is_mapped: true,
          visual_node_count: 1,
          active_child_count: 0,
          mapped_child_count: 0,
          unmapped_child_count: 0,
          has_top_down: true,
          has_front_or_interior: false,
        },
        error: null,
      });

      const result = await WarehouseLocationsService.getMappingStatus(supabase as never, ORG, LOC);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mapping_status).toBe("mapped");
        expect(result.data.has_top_down).toBe(true);
      }
    });
  });

  describe("V2 canvas does not use legacy shape system", () => {
    it("upsertNode never writes to warehouse_layout_shapes", async () => {
      const node = makeNode();
      const supabase = makeSupabaseMock([
        { data: { id: LOC, branch_id: BRANCH }, error: null },
        { data: { id: LAYOUT, branch_id: BRANCH }, error: null },
        { data: node, error: null },
      ]);
      await WarehouseLocationVisualNodesService.upsertNode(supabase as never, ORG, BRANCH, {
        layout_id: LAYOUT,
        location_id: LOC,
        view_type: "top_down",
        x_mm: 0,
        y_mm: 0,
        width_mm: 100,
        height_mm: 100,
      });
      const tables = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
        ([t]: [string]) => t
      );
      expect(tables).not.toContain("warehouse_layout_shapes");
    });
  });
});
