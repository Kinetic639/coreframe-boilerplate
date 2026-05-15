/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { InventoryProductsService } from "../inventory-products.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const VARIANT_ID = "33333333-3333-4333-8333-333333333333";
const UNIT_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

type Operation = {
  table: string;
  action: string;
  payload?: Record<string, unknown>;
};

function createChain(
  table: string,
  operations: Operation[],
  state: { failOptionGroupRead?: boolean }
) {
  const chain = {
    data: table === "inventory_option_groups" ? [] : null,
    error: null as { message: string } | null,
    update(payload: Record<string, unknown>) {
      operations.push({ table, action: "update", payload });
      return chain;
    },
    insert(payload: Record<string, unknown>) {
      operations.push({ table, action: "insert", payload });
      return chain;
    },
    select() {
      operations.push({ table, action: "select" });
      if (table === "inventory_option_groups" && state.failOptionGroupRead) {
        chain.error = { message: "option group read failed" };
      }
      return chain;
    },
    eq() {
      return chain;
    },
    is() {
      return chain;
    },
    in() {
      return chain;
    },
    order() {
      return chain;
    },
    single() {
      return chain;
    },
    maybeSingle() {
      return chain;
    },
    upsert(payload: Record<string, unknown>) {
      operations.push({ table, action: "upsert", payload });
      return chain;
    },
  };
  return chain;
}

function createSupabaseMock(state: { failOptionGroupRead?: boolean } = {}) {
  const operations: Operation[] = [];
  return {
    operations,
    client: {
      rpc: vi.fn().mockResolvedValue({
        data: { product_id: PRODUCT_ID, variant_id: VARIANT_ID, sku: "SKU-1" },
        error: null,
      }),
      from: vi.fn((table: string) => createChain(table, operations, state)),
    },
  };
}

describe("InventoryProductsService.createEnhancedProduct", () => {
  it("creates the catalog through the transactional enhanced product RPC", async () => {
    const supabase = createSupabaseMock();
    supabase.client.rpc = vi.fn().mockResolvedValue({
      data: { product_id: PRODUCT_ID, variant_ids: [VARIANT_ID], sku: "SKU-1" },
      error: null,
    });

    const result = await InventoryProductsService.createEnhancedProduct(
      supabase.client as never,
      ORG_ID,
      {
        name: "Brake pad",
        product_type: "stocked",
        base_unit_id: UNIT_ID,
        sku: "SKU-1",
        attributes: [{ name: "Color", values: ["Black"] }],
        variants: [{ name: "Brake pad - Black", sku: "SKU-1", options: { Color: "Black" } }],
      },
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(supabase.client.rpc).toHaveBeenCalledWith(
      "inventory_create_enhanced_product",
      expect.objectContaining({
        p_organization_id: ORG_ID,
        p_actor_user_id: USER_ID,
        p_attributes: [{ name: "Color", values: ["Black"] }],
      })
    );
  });
});
