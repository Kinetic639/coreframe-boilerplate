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

function makeSupabaseMock(
  tables: Record<string, Row[]>,
  errors: Record<string, { message: string }> = {}
) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const tableError = errors[table] ?? null;
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
        is(col: string, val: null) {
          builder._filters.push((r: Row) => (r[col] ?? null) === val);
          return builder;
        },
        maybeSingle() {
          if (tableError) return Promise.resolve({ data: null, error: tableError });
          const filtered = rows.filter((r) =>
            builder._filters.every((f: (r: Row) => boolean) => f(r))
          );
          return Promise.resolve({ data: filtered[0] ?? null, error: null });
        },
        then(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => void) {
          if (tableError) {
            resolve({ data: null, error: tableError });
            return;
          }
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

describe("RepairOrderStorageService.getReceivedLines", () => {
  const org = "org-1";
  const branch = "branch-1";
  const ro = "ro-1";
  const recvLoc = { id: "loc-recv", organization_id: org, branch_id: branch, purpose: "receiving" };

  /**
   * External review, third correction pass: this service must never expose
   * UNKNOWN receiving stock as a confident, actionable putaway candidate.
   * These tests are the item-11 A/B/D/E coverage requested by that review.
   */

  it("A: KNOWN receiving stock is actionable", async () => {
    const supabase = makeSupabaseMock({
      warehouse_locations: [recvLoc],
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-recv",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 5,
        },
      ],
      repair_order_location_attribution_uncertain: [],
      inventory_variants: [
        { id: "var-x", sku: "SKU-X", product_name: "Bumper", unit_id: "unit-ea" },
      ],
    });

    const result = await RepairOrderStorageService.getReceivedLines(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines).toHaveLength(1);
    expect(result.data.lines[0].repairOrderLineId).toBe("rol-1");
    expect(result.data.lines[0].availableAtReceiving).toBe(5);
    expect(result.data.unverifiedLineCount).toBe(0);
  });

  it("B: UNKNOWN receiving stock is excluded from actionable lines and counted separately, never shown as a confident candidate", async () => {
    const supabase = makeSupabaseMock({
      warehouse_locations: [recvLoc],
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-recv",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 5,
        },
      ],
      repair_order_location_attribution_uncertain: [
        { organization_id: org, branch_id: branch, location_id: "loc-recv", variant_id: "var-x" },
      ],
      inventory_variants: [
        { id: "var-x", sku: "SKU-X", product_name: "Bumper", unit_id: "unit-ea" },
      ],
    });

    const result = await RepairOrderStorageService.getReceivedLines(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines).toHaveLength(0);
    expect(result.data.unverifiedLineCount).toBe(1);
  });

  it("E: mixed KNOWN and UNKNOWN receiving stock -- KNOWN line stays actionable, UNKNOWN line is excluded and counted (normal known behavior unchanged)", async () => {
    const supabase = makeSupabaseMock({
      warehouse_locations: [recvLoc],
      repair_order_line_locations: [
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-recv",
          variant_id: "var-x",
          repair_order_line_id: "rol-1",
          quantity: 5,
        },
        {
          organization_id: org,
          branch_id: branch,
          repair_order_id: ro,
          location_id: "loc-recv",
          variant_id: "var-y",
          repair_order_line_id: "rol-2",
          quantity: 2,
        },
      ],
      repair_order_location_attribution_uncertain: [
        { organization_id: org, branch_id: branch, location_id: "loc-recv", variant_id: "var-y" },
      ],
      inventory_variants: [
        { id: "var-x", sku: "SKU-X", product_name: "Bumper", unit_id: "unit-ea" },
        { id: "var-y", sku: "SKU-Y", product_name: "Door handle", unit_id: "unit-ea" },
      ],
    });

    const result = await RepairOrderStorageService.getReceivedLines(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines).toHaveLength(1);
    expect(result.data.lines[0].repairOrderLineId).toBe("rol-1");
    expect(result.data.unverifiedLineCount).toBe(1);
  });

  it("D: a genuine read error is distinct from empty/unknown -- surfaced as a failed ServiceResult, not an empty array", async () => {
    const supabase = makeSupabaseMock(
      { warehouse_locations: [recvLoc], repair_order_line_locations: [] },
      { repair_order_line_locations: { message: 'relation "typo" does not exist' } }
    );

    const result = await RepairOrderStorageService.getReceivedLines(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.error).toBe('relation "typo" does not exist');
  });

  it("no receiving location configured -- empty, not an error", async () => {
    const supabase = makeSupabaseMock({ warehouse_locations: [] });

    const result = await RepairOrderStorageService.getReceivedLines(
      supabase as any,
      org,
      branch,
      ro
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ lines: [], unverifiedLineCount: 0 });
  });
});
