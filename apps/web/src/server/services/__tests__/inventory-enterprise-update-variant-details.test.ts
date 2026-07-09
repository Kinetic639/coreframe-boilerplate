/**
 * @vitest-environment node
 *
 * Focused unit test for InventoryEnterpriseService.updateVariantDetails,
 * covering the default_supplier_id addition (stock-audit implementation
 * plan §10) — a plain column on inventory_variants, distinct from
 * preferred_supplier_id which is stored on the separate
 * inventory_reorder_rules table.
 */
import { describe, expect, it, vi } from "vitest";
import { InventoryEnterpriseService } from "../inventory-enterprise.service";

const ORG_ID = "org-1";
const VARIANT_ID = "variant-1";
const SUPPLIER_ID = "supplier-1";

function makeSupabaseMock(updateResult: { data: unknown; error: unknown }) {
  const updatePayloads: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    updatePayloads.push(payload);
    return chain;
  });
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(updateResult);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    updatePayloads,
    client: { from: vi.fn().mockReturnValue(chain) },
  };
}

describe("InventoryEnterpriseService.updateVariantDetails", () => {
  it("includes default_supplier_id in the UPDATE payload when explicitly provided", async () => {
    const supabase = makeSupabaseMock({ data: { id: VARIANT_ID }, error: null });

    const result = await InventoryEnterpriseService.updateVariantDetails(
      supabase.client as never,
      ORG_ID,
      VARIANT_ID,
      { sku: "SKU-1", name: "Brake pad", default_supplier_id: SUPPLIER_ID }
    );

    expect(result).toEqual({ success: true, data: { id: VARIANT_ID } });
    expect(supabase.updatePayloads[0]).toEqual(
      expect.objectContaining({ default_supplier_id: SUPPLIER_ID })
    );
  });

  it("includes default_supplier_id: null when explicitly clearing it", async () => {
    const supabase = makeSupabaseMock({ data: { id: VARIANT_ID }, error: null });

    await InventoryEnterpriseService.updateVariantDetails(
      supabase.client as never,
      ORG_ID,
      VARIANT_ID,
      {
        sku: "SKU-1",
        name: "Brake pad",
        default_supplier_id: null,
      }
    );

    expect(supabase.updatePayloads[0]).toEqual(
      expect.objectContaining({ default_supplier_id: null })
    );
  });

  it("omits default_supplier_id from the UPDATE payload when not provided (leaves existing value untouched)", async () => {
    const supabase = makeSupabaseMock({ data: { id: VARIANT_ID }, error: null });

    await InventoryEnterpriseService.updateVariantDetails(
      supabase.client as never,
      ORG_ID,
      VARIANT_ID,
      {
        sku: "SKU-1",
        name: "Brake pad",
      }
    );

    expect(supabase.updatePayloads[0]).not.toHaveProperty("default_supplier_id");
  });

  it("propagates a DB error", async () => {
    const supabase = makeSupabaseMock({ data: null, error: { message: "constraint violated" } });

    const result = await InventoryEnterpriseService.updateVariantDetails(
      supabase.client as never,
      ORG_ID,
      VARIANT_ID,
      { sku: "SKU-1", name: "Brake pad", default_supplier_id: SUPPLIER_ID }
    );

    expect(result).toEqual({ success: false, error: "constraint violated" });
  });
});
