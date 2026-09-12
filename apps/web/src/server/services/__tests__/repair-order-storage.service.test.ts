import { describe, expect, it } from "vitest";
import { RepairOrderStorageService } from "../repair-order-storage.service";

/**
 * Zone 5 Phase 5 -- unit tests against a mocked Supabase client (no live DB
 * required). This is real, executable verification of the read model's own
 * logic (grouping, ordering, KNOWN/UNKNOWN treatment) -- it does not, and
 * cannot, prove the underlying SQL/RLS behaves identically live; that
 * remains blocked on Supabase MCP per this session's disclosed limitation.
 */

type Row = Record<string, unknown>;

function makeSupabaseMock(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: any = {
        _filters: [] as Array<(r: Row) => boolean>,
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          builder._filters.push((r: Row) => r[col] === val);
          return builder;
        },
        gt(col: string, val: number) {
          builder._filters.push((r: Row) => Number(r[col]) > val);
          return builder;
        },
        in(col: string, vals: unknown[]) {
          builder._filters.push((r: Row) => vals.includes(r[col]));
          return builder;
        },
        then(resolve: (v: { data: Row[]; error: null }) => void) {
          const filtered = rows.filter((r) =>
            builder._filters.every((f: (r: Row) => boolean) => f(r))
          );
          resolve({ data: filtered, error: null });
        },
      };
      return builder;
    },
  };
}

describe("RepairOrderStorageService.getStorageSuggestions", () => {
  const org = "org-1";
  const branch = "branch-1";
  const ro = "ro-1";

  it("returns empty when no projection rows exist for the RepairOrder", async () => {
    const supabase = makeSupabaseMock({ repair_order_line_locations: [] });
    const result = await RepairOrderStorageService.getStorageSuggestions(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("groups by location, sums quantity, counts distinct lines, orders by quantity desc then lines desc", async () => {
    const supabase = makeSupabaseMock({
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-A",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 5,
        },
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-B",
          variant_id: "var-x",
          repair_order_line_id: "rol-2",
          quantity: 8,
        },
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-B",
          variant_id: "var-y",
          repair_order_line_id: "rol-3",
          quantity: 1,
        },
      ],
      repair_order_location_attribution_uncertain: [],
      warehouse_locations: [
        { id: "loc-A", code: "A-01", name: "Bin A-01" },
        { id: "loc-B", code: "B-02", name: "Bin B-02" },
      ],
      inventory_variants: [
        { id: "var-x", sku: "SKU-X", product_name: "Bumper" },
        { id: "var-y", sku: "SKU-Y", product_name: "Door handle" },
      ],
    });

    const result = await RepairOrderStorageService.getStorageSuggestions(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
    // loc-B has quantity 9 (8+1) and 2 distinct lines -> first.
    expect(result.data[0].locationId).toBe("loc-B");
    expect(result.data[0].currentQuantity).toBe(9);
    expect(result.data[0].distinctRepairOrderLines).toBe(2);
    expect(result.data[0].attributionStatus).toBe("known");
    // loc-A has quantity 5, 1 distinct line -> second.
    expect(result.data[1].locationId).toBe("loc-A");
    expect(result.data[1].currentQuantity).toBe(5);
    expect(result.data[1].containerSummary).toBeNull();
  });

  it("marks a location UNKNOWN when ANY of its (location, variant) pairs for this RepairOrder is flagged uncertain -- never partially confident", async () => {
    const supabase = makeSupabaseMock({
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-A",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 5,
        },
      ],
      repair_order_location_attribution_uncertain: [
        { organization_id: org, branch_id: branch, location_id: "loc-A", variant_id: "var-x" },
      ],
      warehouse_locations: [{ id: "loc-A", code: "A-01", name: "Bin A-01" }],
      inventory_variants: [{ id: "var-x", sku: "SKU-X", product_name: "Bumper" }],
    });

    const result = await RepairOrderStorageService.getStorageSuggestions(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].attributionStatus).toBe("unknown");
  });

  it("never re-derives KNOWN from arithmetic -- an UNKNOWN marker's mere presence rules, regardless of quantity shape", async () => {
    // Even though the numbers here would look "unambiguous" if recomputed
    // (a single line, quantity matches), an active marker must still win.
    const supabase = makeSupabaseMock({
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-A",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 3,
        },
      ],
      repair_order_location_attribution_uncertain: [
        { organization_id: org, branch_id: branch, location_id: "loc-A", variant_id: "var-x" },
      ],
      warehouse_locations: [{ id: "loc-A", code: "A-01", name: "Bin A-01" }],
      inventory_variants: [],
    });
    const result = await RepairOrderStorageService.getStorageSuggestions(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].attributionStatus).toBe("unknown");
  });

  it("surfaces a Supabase error as a failed ServiceResult rather than throwing", async () => {
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gt: () => Promise.resolve({ data: null, error: { message: "boom" } }),
                }),
              }),
            }),
          }),
        };
      },
    };
    const result = await RepairOrderStorageService.getStorageSuggestions(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.error).toBe("boom");
  });
});
